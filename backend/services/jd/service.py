import json
import logging

from fastapi import HTTPException
from google.genai import types
from pydantic import BaseModel, Field

from shared.client_factory import get_gemini_client
from shared.schemas.jd import GEMINI_JD_JSON_SCHEMA

logger = logging.getLogger(__name__)


class ParseJDTextBody(BaseModel):
    text: str = Field(..., min_length=1, description="Raw job description text")


def _jd_mime_type(filename: str | None) -> str:
    lower = (filename or "").lower()
    if lower.endswith(".pdf"):
        return "application/pdf"
    if lower.endswith(".docx"):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if lower.endswith(".doc"):
        return "application/msword"
    return "application/octet-stream"


async def parse_jd_structured_from_text(*, text: str, gemini_api_key: str | None = None) -> dict:
    logger.info("JD: structured parse from text (%s chars)", len(text))
    try:
        client = get_gemini_client(gemini_api_key)
        prompt = (
            "You are parsing a job description. Extract structured data into the JSON schema. "
            "Preserve wording in section bodies. "
            "For mustHaveKeywords and niceToHaveKeywords, use short canonical phrases "
            "(e.g. 'Kubernetes', 'SQL', 'CI/CD'). "
            f"Job description:\n\n{text.strip()}"
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GEMINI_JD_JSON_SCHEMA,
                temperature=0.0,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        logger.exception("JD structured parse failed")
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            raise HTTPException(
                status_code=429,
                detail="Gemini API rate limit reached. Please wait and try again.",
            ) from e
        raise HTTPException(status_code=500, detail=err_str) from e


async def parse_jd_structured_from_bytes(
    *, content: bytes, filename: str | None, gemini_api_key: str | None = None
) -> dict:
    mime = _jd_mime_type(filename)
    logger.info("JD: structured parse from file %s [%s]", filename, mime)
    try:
        client = get_gemini_client(gemini_api_key)
        prompt = (
            "Extract the job description from this document and fill the JSON schema. "
            "Section bodies must be plain text. "
            "mustHaveKeywords = explicit requirements; niceToHaveKeywords = preferred/bonus."
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[types.Part.from_bytes(data=content, mime_type=mime), prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GEMINI_JD_JSON_SCHEMA,
                temperature=0.0,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        logger.exception("JD file structured parse failed")
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            raise HTTPException(
                status_code=429,
                detail="Gemini API rate limit reached. Please wait and try again.",
            ) from e
        raise HTTPException(status_code=500, detail=err_str) from e


def jd_plain_text(jd_json: dict) -> str:
    """Flatten structured JD to a single string for matching / LLM context."""
    lines: list[str] = []
    for key in ("title", "company", "location", "employmentType", "summary"):
        v = jd_json.get(key)
        if isinstance(v, str) and v.strip():
            lines.append(v.strip())
    for sec in jd_json.get("sections") or []:
        if not isinstance(sec, dict):
            continue
        t = sec.get("title")
        b = sec.get("body")
        if isinstance(t, str) and t.strip():
            lines.append(t.strip())
        if isinstance(b, str) and b.strip():
            lines.append(b.strip())
    for kw in jd_json.get("mustHaveKeywords") or []:
        if isinstance(kw, str) and kw.strip():
            lines.append(kw.strip())
    for kw in jd_json.get("niceToHaveKeywords") or []:
        if isinstance(kw, str) and kw.strip():
            lines.append(kw.strip())
    return "\n".join(lines)
