"""
Deterministic resume ↔ JD lexical analysis (TF–IDF cosine + token overlap).

Used alongside LLM analysis for transparent, deployable scoring.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

# sklearn is optional at import time for tests/tools; service runtime should install it.
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    _HAS_SK = True
except ImportError:  # pragma: no cover
    _HAS_SK = False

_STOP = frozenset(
    """
    a an the and or but if in on at to for of as is was are were be been being
    with by from that this these those it its we you they he she them their our your
    will can may might must should could would about into over after before under
    all any both each few more most other some such no nor not only same so than too
    very just also then once here there when where why how what which who whom
    while during through between against among within without per via etc eg ie
    """.split()
)


def _tokenize(text: str) -> list[str]:
    text = (text or "").lower()
    return [t for t in re.findall(r"[a-z0-9][a-z0-9+.#-]{1,}", text) if t not in _STOP]


def resume_to_plain_text(resume: dict[str, Any]) -> str:
    parts: list[str] = []
    pi = resume.get("personalInfo") or {}
    if isinstance(pi, dict):
        for _k, v in pi.items():
            if isinstance(v, str) and v.strip():
                parts.append(v)
    for sec in resume.get("sections") or []:
        if not isinstance(sec, dict):
            continue
        st = sec.get("sectionTitle")
        if isinstance(st, str) and st.strip():
            parts.append(st)
        for it in sec.get("items") or []:
            if not isinstance(it, dict):
                continue
            for key in ("heading", "subheading", "date", "location"):
                v = it.get(key)
                if isinstance(v, str) and v.strip():
                    parts.append(v)
            for b in it.get("bullets") or []:
                if isinstance(b, str) and b.strip():
                    parts.append(b)
    return "\n".join(parts)


def strict_score_percent(p: int) -> int:
    """
    Stricter reporting curve: compresses inflated-looking scores (used for ML, LLM fit, combined).
    Example: 85 → ~77, 50 → ~41 (exponent > 1 pulls mid/high scores down).
    """
    x = max(0.0, min(100.0, float(p)))
    return int(round(100.0 * ((x / 100.0) ** 1.18)))


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _normalize_phrase(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[\/_]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    # Lightweight synonyms/aliases for common JD terms.
    alias = {
        "js": "javascript",
        "ts": "typescript",
        "node": "nodejs",
        "node.js": "nodejs",
        "react.js": "react",
        "next.js": "nextjs",
        "ci cd": "cicd",
        "ci/cd": "cicd",
        "k8s": "kubernetes",
        "gcp": "google cloud",
        "aws cloud": "aws",
        "ml": "machine learning",
        "ai": "artificial intelligence",
    }
    return alias.get(s, s)


def _stem_token(t: str) -> str:
    t = t.strip().lower()
    if len(t) <= 4:
        return t
    for suf in ("ization", "ations", "ation", "ities", "ments", "ment", "ingly", "edly", "ing", "ers", "ies", "ied", "ed", "es", "s"):
        if t.endswith(suf) and len(t) - len(suf) >= 3:
            return t[: -len(suf)] + ("y" if suf in ("ies", "ied") else "")
    return t


def _phrase_tokens(s: str) -> set[str]:
    toks = _tokenize(_normalize_phrase(s))
    return {_stem_token(t) for t in toks if t}


def _phrase_match(a: str, b: str) -> bool:
    na = _normalize_phrase(a)
    nb = _normalize_phrase(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    ta = _phrase_tokens(na)
    tb = _phrase_tokens(nb)
    if ta and tb:
        ov = len(ta & tb)
        ratio = ov / max(1, min(len(ta), len(tb)))
        if ratio >= 0.6:
            return True
    # Soft fallback for close spelling/phrasing variations.
    return SequenceMatcher(None, na, nb).ratio() >= 0.87


def compute_llm_keyword_ml_score(
    jd_keywords: list[Any],
    resume_keywords: list[Any],
    *,
    fallback_lexical_percent: int,
) -> dict[str, Any]:
    """
    Lexical match score after LLM has extracted keyword lists from JD and resume.
    Uses set overlap (Jaccard + JD recall blend). Falls back to TF–IDF headline if lists empty.
    """

    def _norm_list(raw: list[Any]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for x in raw:
            if isinstance(x, str):
                t = _normalize_phrase(x)
                if len(t) >= 2:
                    if t not in seen:
                        out.append(t)
                        seen.add(t)
        return out

    j_list = _norm_list(jd_keywords)
    r_list = _norm_list(resume_keywords)
    j_set = set(j_list)
    r_set = set(r_list)

    if not j_set and not r_set:
        fb = max(0, min(100, int(fallback_lexical_percent)))
        return {
            "ml_score_percent": fb,
            "matched_keywords": [],
            "missing_keywords": [],
            "jd_keyword_count": 0,
            "resume_keyword_count": 0,
            "jaccard_percent": fb,
            "keyword_recall_percent": fb,
            "method_notes": "ml_keywords_empty_fallback_tfidf",
        }

    exact_inter = j_set & r_set
    # JD-centric soft matching: gives credit for close concepts, not only exact strings.
    soft_matched_jd: set[str] = set()
    for j in j_list:
        if j in exact_inter:
            soft_matched_jd.add(j)
            continue
        for r in r_list:
            if _phrase_match(j, r):
                soft_matched_jd.add(j)
                break

    # Token-level coverage for more holistic fit.
    j_tok: set[str] = set()
    r_tok: set[str] = set()
    for k in j_list:
        j_tok |= _phrase_tokens(k)
    for k in r_list:
        r_tok |= _phrase_tokens(k)

    token_recall = len(j_tok & r_tok) / len(j_tok) if j_tok else 1.0
    recall_jd = len(soft_matched_jd) / len(j_set) if j_set else 1.0
    exact_jaccard = len(exact_inter) / len(j_set | r_set) if (j_set or r_set) else 1.0

    # Holistic blend: emphasize JD coverage, include token-level semantic-ish overlap.
    blended = 0.20 * exact_jaccard + 0.50 * recall_jd + 0.30 * token_recall
    ml_pct = int(round(100 * max(0.0, min(1.0, blended)) * 0.98))
    ml_pct = max(0, min(100, ml_pct))

    matched = sorted(soft_matched_jd)
    missing = sorted(j_set - soft_matched_jd)

    return {
        "ml_score_percent": ml_pct,
        "matched_keywords": matched[:80],
        "missing_keywords": missing[:80],
        "jd_keyword_count": len(j_set),
        "resume_keyword_count": len(r_set),
        "jaccard_percent": int(round(100 * exact_jaccard)),
        "keyword_recall_percent": int(round(100 * recall_jd)),
        "method_notes": "llm_keywords_soft_phrase_and_token_recall",
    }


def compute_lexical_metrics(resume_text: str, jd_text: str) -> dict[str, Any]:
    r_tokens = _tokenize(resume_text)
    j_tokens = _tokenize(jd_text)
    r_set = set(r_tokens)
    j_set = set(j_tokens)

    matched = sorted(w for w in j_set if w in r_set)
    missing = sorted(w for w in j_set if w not in r_set)

    unigram_jaccard = round(100 * _jaccard(r_set, j_set))

    tfidf_cosine_0_1 = None
    if _HAS_SK and resume_text.strip() and jd_text.strip():
        try:
            vec = TfidfVectorizer(
                max_features=800,
                stop_words="english",
                ngram_range=(1, 2),
                lowercase=True,
            )
            m = vec.fit_transform([resume_text, jd_text])
            tfidf_cosine_0_1 = float(cosine_similarity(m[0:1], m[1:2])[0][0])
        except ValueError:
            # e.g. empty vocabulary when texts are only stop words / too short
            tfidf_cosine_0_1 = None

    lexical_similarity_percent = (
        int(round(100 * max(0.0, min(1.0, tfidf_cosine_0_1))))
        if tfidf_cosine_0_1 is not None
        else unigram_jaccard
    )

    # Blend Jaccard and TF–IDF for a single headline score when both exist
    headline_score = lexical_similarity_percent
    if tfidf_cosine_0_1 is not None:
        headline_score = int(round(0.55 * (100 * tfidf_cosine_0_1) + 0.45 * unigram_jaccard))

    if tfidf_cosine_0_1 is not None:
        method_notes = "tfidf_cosine + token_overlap"
    elif _HAS_SK:
        method_notes = "token_overlap_only (tf-idf skipped: very short or stop-word-only text)"
    else:
        method_notes = "token_overlap_only (install scikit-learn for tf-idf cosine)"

    return {
        "lexical_similarity_percent": max(0, min(100, headline_score)),
        "tfidf_cosine_similarity": tfidf_cosine_0_1,
        "unigram_jaccard_percent": unigram_jaccard,
        "matched_terms": matched[:80],
        "missing_terms": missing[:80],
        "resume_token_count": len(r_tokens),
        "jd_token_count": len(j_tokens),
        "method_notes": method_notes,
    }
