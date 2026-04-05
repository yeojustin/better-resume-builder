"""
Deterministic resume ↔ JD lexical analysis (TF–IDF cosine + token overlap).

Used alongside LLM analysis for transparent, deployable scoring.
"""

from __future__ import annotations

import re
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

    def _norm_set(raw: list[Any]) -> set[str]:
        out: set[str] = set()
        for x in raw:
            if isinstance(x, str):
                t = x.strip().lower()
                if len(t) >= 2:
                    out.add(t)
        return out

    j_set = _norm_set(jd_keywords)
    r_set = _norm_set(resume_keywords)

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

    inter = j_set & r_set
    union = j_set | r_set
    jaccard = len(inter) / len(union) if union else 0.0
    recall_jd = len(inter) / len(j_set) if j_set else 1.0
    # Slightly stricter blend: JD recall matters; dampen optimistic overlap
    blended = 0.36 * jaccard + 0.54 * recall_jd
    ml_pct = int(round(100 * max(0.0, min(1.0, blended)) * 0.96))
    ml_pct = max(0, min(100, ml_pct))

    matched = sorted(inter)
    missing = sorted(j_set - r_set)

    return {
        "ml_score_percent": ml_pct,
        "matched_keywords": matched[:80],
        "missing_keywords": missing[:80],
        "jd_keyword_count": len(j_set),
        "resume_keyword_count": len(r_set),
        "jaccard_percent": int(round(100 * jaccard)),
        "keyword_recall_percent": int(round(100 * recall_jd)),
        "method_notes": "llm_keyword_sets_jaccard_recall",
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
