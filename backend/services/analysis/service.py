import json
import logging
from typing import Literal

from fastapi import HTTPException
from google.genai import types
from pydantic import BaseModel, Field

from shared.client_factory import get_gemini_client
from shared.matching.keyword_engine import (
    compute_lexical_metrics,
    compute_llm_keyword_ml_score,
    resume_to_plain_text,
    strict_score_percent,
)
from shared.schemas.analysis_llm import GEMINI_DEEP_ANALYSIS_SCHEMA

logger = logging.getLogger(__name__)


def _apply_strict_llm_scores(llm_block: dict) -> None:
    """Tighten LLM-reported fit and section scores for a stricter rubric."""
    try:
        fit = int(llm_block.get("fit_score_llm", 0))
    except (TypeError, ValueError):
        fit = 0
    llm_block["fit_score_llm"] = strict_score_percent(fit)
    for r in llm_block.get("section_rankings") or []:
        if not isinstance(r, dict):
            continue
        try:
            rs = int(r.get("relevance_score", 0))
        except (TypeError, ValueError):
            rs = 0
        r["relevance_score"] = strict_score_percent(rs)


def _section_plain_text(sec: dict) -> str:
    parts: list[str] = []
    t = sec.get("sectionTitle")
    if isinstance(t, str) and t.strip():
        parts.append(t.strip())
    for it in sec.get("items") or []:
        if not isinstance(it, dict):
            continue
        for k in ("heading", "subheading", "date", "location"):
            v = it.get(k)
            if isinstance(v, str) and v.strip():
                parts.append(v.strip())
        for b in it.get("bullets") or []:
            if isinstance(b, str) and b.strip():
                parts.append(b.strip())
    return "\n".join(parts)


def _build_section_scorecard(
    resume_json: dict,
    jd_text: str,
    llm_block: dict,
    overall_lexical: int,
) -> list[dict]:
    sections = [s for s in (resume_json.get("sections") or []) if isinstance(s, dict)]
    lexical_by_norm: dict[str, int] = {}
    for sec in sections:
        raw_title = (sec.get("sectionTitle") or "").strip() or "Untitled"
        key = raw_title.lower()
        sm = compute_lexical_metrics(_section_plain_text(sec), jd_text)
        lexical_by_norm[key] = sm["lexical_similarity_percent"]

    rankings = llm_block.get("section_rankings") or []
    seen: set[str] = set()
    scorecard: list[dict] = []

    for r in rankings:
        if not isinstance(r, dict):
            continue
        title = (r.get("section_title") or "").strip() or "Section"
        key = title.lower()
        seen.add(key)
        llm_p = max(0, min(100, int(r.get("relevance_score") or 0)))
        lex_p = lexical_by_norm.get(key, overall_lexical)
        comb = int(round(0.5 * lex_p + 0.5 * llm_p))
        comment = r.get("comment")
        scorecard.append(
            {
                "section_title": title,
                "llm_percent": llm_p,
                "lexical_percent": lex_p,
                "combined_percent": max(0, min(100, comb)),
                "comment": (comment if isinstance(comment, str) else "")[:800],
            }
        )

    llm_fallback = max(0, min(100, int(llm_block.get("fit_score_llm") or 0)))
    for sec in sections:
        raw_title = (sec.get("sectionTitle") or "").strip() or "Untitled"
        key = raw_title.lower()
        if key in seen:
            continue
        lex_p = lexical_by_norm.get(key, overall_lexical)
        comb = int(round(0.5 * lex_p + 0.5 * llm_fallback))
        scorecard.append(
            {
                "section_title": raw_title,
                "llm_percent": llm_fallback,
                "lexical_percent": lex_p,
                "combined_percent": max(0, min(100, comb)),
                "comment": "",
            }
        )

    return scorecard


def _expected_section_titles(resume_json: dict) -> list[str]:
    titles: list[str] = []
    pi = resume_json.get("personalInfo")
    if isinstance(pi, dict):
        keys = ("name", "email", "phone", "location", "linkedin", "portfolio", "summary")
        if any(isinstance(pi.get(k), str) and str(pi.get(k)).strip() for k in keys):
            titles.append("Contact & summary")
    for s in resume_json.get("sections") or []:
        if isinstance(s, dict):
            t = (s.get("sectionTitle") or "").strip() or "Untitled"
            titles.append(t)
    return titles


def _norm_st(s: str) -> str:
    return (s or "").strip().lower()


def _bucket_edits_by_section(resume_json: dict, edits_list: list[dict]) -> tuple[dict[str, list[dict]], list[dict]]:
    titles = _expected_section_titles(resume_json)
    buckets: dict[str, list[dict]] = {t: [] for t in titles}
    orphans: list[dict] = []

    for e in edits_list:
        et = _norm_st(str(e.get("section_title") or ""))
        placed = False
        for t in titles:
            nt = _norm_st(t)
            if et == nt or (et and (et in nt or nt in et)):
                buckets[t].append(e)
                placed = True
                break
        if not placed and "Contact & summary" in buckets:
            if any(x in et for x in ("contact", "summary", "personal", "linkedin", "portfolio", "email")):
                buckets["Contact & summary"].append(e)
                placed = True
        if not placed:
            orphans.append(e)
    return buckets, orphans


def _default_review_why(section_title: str, has_edits: bool) -> str:
    if has_edits:
        return "Suggested wording updates below — copy any line you agree with."
    return (
        "No line-level edits for this part of your uploaded resume. "
        "Scores still show how well this block lines up with the job text."
    )


def _find_section_dict(resume_json: dict, section_title: str) -> dict | None:
    want = _norm_st(section_title)
    for s in resume_json.get("sections") or []:
        if not isinstance(s, dict):
            continue
        t = _norm_st(str(s.get("sectionTitle") or ""))
        if want == t or (want and (want in t or t in want)):
            return s
    return None


def _personal_info_blob(pi: dict) -> str:
    lines: list[str] = []
    for k in ("name", "email", "phone", "location", "linkedin", "portfolio", "summary"):
        v = pi.get(k)
        if isinstance(v, str) and v.strip():
            lines.append(v.strip())
    return "\n".join(lines)


def _item_full_text(it: dict) -> str:
    lines: list[str] = []
    for k in ("heading", "subheading", "date", "location"):
        v = it.get(k)
        if isinstance(v, str) and v.strip():
            lines.append(v.strip())
    for b in it.get("bullets") or []:
        if isinstance(b, str) and b.strip():
            lines.append(f"• {b.strip()}")
    return "\n".join(lines)


def enrich_line_edits_with_item_context(resume_json: dict, line_edits: list[dict]) -> None:
    """Attach which experience/item a line edit belongs to and the full entry text for UI."""
    raw_pi = resume_json.get("personalInfo")
    pi: dict = raw_pi if isinstance(raw_pi, dict) else {}
    contact_blob = _personal_info_blob(pi)

    for e in line_edits:
        before = e.get("before") or ""
        before_st = before.strip()
        sec_title = (e.get("section_title") or "").strip()

        e["item_index"] = None
        e["item_heading"] = ""
        e["item_subheading"] = ""
        e["item_date"] = ""
        e["full_item_text"] = ""

        if not before_st:
            continue

        is_contact = _norm_st(sec_title) == _norm_st("Contact & summary")
        in_contact_blob = before_st in contact_blob if contact_blob else False
        in_summary = isinstance(pi.get("summary"), str) and before_st in str(pi.get("summary") or "")
        if is_contact or in_contact_blob or in_summary:
            e["item_index"] = 0
            e["item_heading"] = "Contact & summary"
            e["full_item_text"] = contact_blob[:8000]
            continue

        sec = _find_section_dict(resume_json, sec_title)
        if not sec:
            continue

        items = [x for x in (sec.get("items") or []) if isinstance(x, dict)]
        best_i: int | None = None
        for idx, it in enumerate(items):
            blob = _item_full_text(it)
            if before_st in blob:
                best_i = idx
                break
        if best_i is None:
            for idx, it in enumerate(items):
                blob = _item_full_text(it)
                for line in blob.split("\n"):
                    line_st = line.strip()
                    if len(line_st) > 6 and (line_st in before_st or before_st in line_st):
                        best_i = idx
                        break
                if best_i is not None:
                    break

        if best_i is None:
            e["item_heading"] = "Unmapped entry"
            continue

        it = items[best_i]
        e["item_index"] = best_i
        e["item_heading"] = (it.get("heading") or "").strip() or "(No role title)"
        e["item_subheading"] = (it.get("subheading") or "").strip()
        e["item_date"] = (it.get("date") or "").strip()
        e["full_item_text"] = _item_full_text(it)[:8000]


def _coerce_keyword_list(val, max_n: int = 50) -> list[str]:
    if not isinstance(val, list):
        return []
    seen: set[str] = set()
    out: list[str] = []
    for x in val:
        if not isinstance(x, str):
            continue
        t = x.strip()[:100]
        if len(t) < 2:
            continue
        low = t.lower()
        if low in seen:
            continue
        seen.add(low)
        out.append(t)
        if len(out) >= max_n:
            break
    return out


def normalize_llm_analysis_block(resume_json: dict, llm_block: dict) -> list[dict]:
    """Coerce shapes and ensure section_review covers every resume section (model drift fallback)."""
    fit = llm_block.get("fit_score_llm")
    try:
        llm_block["fit_score_llm"] = max(0, min(100, int(fit if fit is not None else 0)))
    except (TypeError, ValueError):
        llm_block["fit_score_llm"] = 0

    le_raw = llm_block.get("line_edits")
    if not isinstance(le_raw, list):
        le_raw = []
    line_edits: list[dict] = [e for e in le_raw if isinstance(e, dict)]
    llm_block["line_edits"] = line_edits

    sr_raw = llm_block.get("section_rankings")
    if not isinstance(sr_raw, list):
        sr_raw = []
    llm_block["section_rankings"] = [r for r in sr_raw if isinstance(r, dict)]

    expected = _expected_section_titles(resume_json)
    buckets, _orph = _bucket_edits_by_section(resume_json, line_edits)

    rev_raw = llm_block.get("section_review")
    if not isinstance(rev_raw, list):
        rev_raw = []
    emap: dict[str, dict] = {}
    for r in rev_raw:
        if isinstance(r, dict) and r.get("section_title"):
            emap[_norm_st(str(r["section_title"]))] = r

    merged: list[dict] = []
    for t in expected:
        k = _norm_st(t)
        eds = buckets.get(t) or []
        has_from_edits = len(eds) > 0
        if k in emap:
            row = dict(emap[k])
            row["section_title"] = t
            has_llm = bool(row.get("has_suggested_edits"))
            row["has_suggested_edits"] = bool(has_from_edits or has_llm)
            why = (row.get("why") or "").strip() if isinstance(row.get("why"), str) else ""
            if not why:
                row["why"] = _default_review_why(t, row["has_suggested_edits"])
            else:
                row["why"] = why[:400]
            merged.append(row)
        else:
            merged.append(
                {
                    "section_title": t,
                    "has_suggested_edits": has_from_edits,
                    "why": _default_review_why(t, has_from_edits),
                }
            )
    llm_block["section_review"] = merged
    llm_block["jd_keywords"] = _coerce_keyword_list(llm_block.get("jd_keywords"))
    llm_block["resume_keywords"] = _coerce_keyword_list(llm_block.get("resume_keywords"))
    return line_edits


def build_section_change_view(
    resume_json: dict,
    line_edits: list,
    llm_block: dict,
    section_scorecard: list[dict],
) -> list[dict]:
    titles = _expected_section_titles(resume_json)
    edits_list = [e for e in (line_edits or []) if isinstance(e, dict)]
    buckets, orphans = _bucket_edits_by_section(resume_json, edits_list)

    review_map: dict[str, dict] = {}
    for r in llm_block.get("section_review") or []:
        if isinstance(r, dict) and r.get("section_title"):
            review_map[_norm_st(str(r["section_title"]))] = r

    score_map: dict[str, dict] = {}
    for r in section_scorecard or []:
        if isinstance(r, dict) and r.get("section_title"):
            score_map[_norm_st(str(r["section_title"]))] = r

    ranking_map: dict[str, dict] = {}
    for r in llm_block.get("section_rankings") or []:
        if isinstance(r, dict) and r.get("section_title"):
            ranking_map[_norm_st(str(r["section_title"]))] = r

    def pick_why(title: str, eds: list) -> str:
        k = _norm_st(title)
        rv = review_map.get(k)
        if isinstance(rv, dict):
            w = (rv.get("why") or "").strip()
            if w:
                return w[:400]
        sc = score_map.get(k)
        if isinstance(sc, dict):
            c = (sc.get("comment") or "").strip()
            if c:
                return c[:400]
        rk = ranking_map.get(k)
        if isinstance(rk, dict):
            c = (rk.get("comment") or "").strip()
            if c:
                return c[:400]
        if eds:
            return "Suggested wording updates below — copy any line you agree with."
        return (
            "No line-level edits for this part of your uploaded resume. "
            "Scores still show how well this block lines up with the job text."
        )

    out: list[dict] = []
    for t in titles:
        eds = buckets.get(t) or []
        out.append({"section_title": t, "why": pick_why(t, eds), "line_edits": eds})

    if orphans:
        out.append(
            {
                "section_title": "Other suggestions",
                "why": "These lines did not match a section title exactly; review before using.",
                "line_edits": orphans,
            }
        )
    return out


def _prompt_controls(
    *,
    groundedness_percent: int,
    creativity_percent: int,
    professionalism: str,
) -> str:
    g = max(70, min(100, int(groundedness_percent)))
    c = max(0, min(100, int(creativity_percent)))
    prof = professionalism if professionalism in ("direct", "professional", "formal") else "professional"
    return f"""USER SETTINGS (follow closely):
- Groundedness {g}% (70–100): At 100, every "before" is an exact substring from the Resume JSON and "after" must not add employers, degrees, tools, or dates not already present or clearly implied. Lower values allow more paraphrase but never invent major credentials.
- Creativity {c}% (0–100): Low = minimal edits for JD fit. High = stronger rewrite while respecting groundedness.
- Professionalism = {prof}: tone for all "after" text — direct=plain and short; professional=standard workplace; formal=conservative and polished.
- section_review: include exactly one entry per section title listed below (match section_title strings exactly, including "Contact & summary" if listed). Each entry must state has_suggested_edits true/false and a short why (max ~22 words)."""


class AnalyzeRequest(BaseModel):
    resume_json: dict = Field(..., description="Structured resume from /parse-resume")
    job_description: str = Field(..., min_length=1, description="Plain JD text for matching")
    jd_json: dict | None = Field(
        default=None,
        description="Optional structured JD from /parse-jd for richer LLM context",
    )
    groundedness_percent: int = Field(100, ge=70, le=100)
    creativity_percent: int = Field(35, ge=0, le=100)
    temperature: float = Field(0.22, ge=0.0, le=0.95)
    professionalism: Literal["direct", "professional", "formal"] = "professional"


async def analyze_resume_vs_jd(
    *,
    resume_json: dict,
    job_description: str,
    jd_json: dict | None,
    groundedness_percent: int = 100,
    creativity_percent: int = 35,
    temperature: float = 0.22,
    professionalism: str = "professional",
    gemini_api_key: str | None = None,
) -> dict:
    resume_plain = resume_to_plain_text(resume_json)
    metrics = compute_lexical_metrics(resume_plain, job_description)

    jd_extra = ""
    if jd_json:
        jd_extra = "\nStructured JD JSON (for context):\n" + json.dumps(jd_json, ensure_ascii=False)[:12000]

    metrics_blob = json.dumps(metrics, ensure_ascii=False)
    expected_titles = _expected_section_titles(resume_json)
    titles_instruction = json.dumps(expected_titles, ensure_ascii=False)
    ctrl = _prompt_controls(
        groundedness_percent=groundedness_percent,
        creativity_percent=creativity_percent,
        professionalism=professionalism,
    )
    temp = max(0.0, min(0.95, float(temperature)))

    prompt = f"""Compare ONLY the provided Resume JSON to the Job description. Output JSON per schema. Be concise.

{ctrl}

CORE RULES:
- section_rankings: section_title matches resume sections[].sectionTitle when possible (exact string).
- line_edits: "before" must be exact text from the Resume JSON when groundedness is high; relax only as groundedness allows.
- note: max ~14 words or "".
- section_review must cover every title in this list (same spelling): {titles_instruction}
- jd_keywords: extract from the job description text only (skills, tools, stack, domain terms). resume_keywords: extract only from the Resume JSON content. Then the server lexically compares these two lists for the ML score.

STRICT SCORING & JD FIT:
- fit_score_llm and each section relevance_score: use a demanding rubric (avoid grade inflation). 90+ only for near-perfect JD alignment; strong but imperfect candidates often land in the 60s–low 80s; clear gaps in must-have themes or tools → lower.
- line_edits: actively propose changes wherever JD-aligned wording would improve fit (keywords, impact, tools the JD stresses). Do not skip helpful rewrites just to return fewer edits; stay grounded in facts already in the resume.

Lexical / TF–IDF reference (for debugging; headline ML uses your keyword lists):
{metrics_blob}

Resume JSON:
{json.dumps(resume_json, ensure_ascii=False)[:28000]}

Job description:
{job_description[:16000]}
{jd_extra}

fit_score_llm: 0–100 holistic STRICT fit from this resume + JD only.

JSON only. No markdown.
"""

    try:
        client = get_gemini_client(gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GEMINI_DEEP_ANALYSIS_SCHEMA,
                temperature=temp,
            ),
        )
        llm_block = json.loads(response.text)
    except Exception as e:
        logger.exception("Analysis LLM failed")
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            raise HTTPException(
                status_code=429,
                detail="Gemini API rate limit reached. Please wait and try again.",
            ) from e
        raise HTTPException(status_code=500, detail=err_str) from e

    normalize_llm_analysis_block(resume_json, llm_block)
    enrich_line_edits_with_item_context(resume_json, llm_block["line_edits"])

    ml_metrics = compute_llm_keyword_ml_score(
        llm_block.get("jd_keywords") or [],
        llm_block.get("resume_keywords") or [],
        fallback_lexical_percent=int(metrics["lexical_similarity_percent"]),
    )
    ml_metrics["ml_score_percent"] = strict_score_percent(int(ml_metrics["ml_score_percent"]))
    _apply_strict_llm_scores(llm_block)

    combined = int(
        round(0.5 * int(ml_metrics["ml_score_percent"]) + 0.5 * int(llm_block.get("fit_score_llm", 0)))
    )
    combined = max(0, min(100, combined))

    section_scorecard = _build_section_scorecard(
        resume_json,
        job_description,
        llm_block,
        int(ml_metrics["ml_score_percent"]),
    )

    line_edits = llm_block["line_edits"]
    section_change_view = build_section_change_view(
        resume_json,
        line_edits,
        llm_block,
        section_scorecard,
    )

    settings_used = {
        "groundedness_percent": max(70, min(100, int(groundedness_percent))),
        "creativity_percent": max(0, min(100, int(creativity_percent))),
        "temperature": temp,
        "professionalism": professionalism if professionalism in ("direct", "professional", "formal") else "professional",
    }

    return {
        "combined_score_percent": combined,
        "lexical_metrics": metrics,
        "ml_metrics": ml_metrics,
        "llm": llm_block,
        "section_scorecard": section_scorecard,
        "section_change_view": section_change_view,
        "settings_used": settings_used,
    }
