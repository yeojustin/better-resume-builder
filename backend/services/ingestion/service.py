import json
import logging

from fastapi import HTTPException
from google.genai import types
from shared.client_factory import get_gemini_client

from shared.schemas.resume import GEMINI_RESUME_JSON_SCHEMA

logger = logging.getLogger(__name__)


def _mime_type_for_filename(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return "application/pdf"
    if lower.endswith(".docx"):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return "application/msword"


def validate_resume_upload(filename: str) -> None:
    lower = (filename or "").lower()
    if not (lower.endswith(".pdf") or lower.endswith(".doc") or lower.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Only PDF or Word (.doc/.docx) files are supported.",
        )


def build_resume_outline(resume_json: dict) -> dict:
    """Human-facing summary of parsed sections (derived from JSON, no extra LLM)."""
    sections_out: list[dict] = []
    for i, s in enumerate(resume_json.get("sections") or []):
        if not isinstance(s, dict):
            continue
        items = s.get("items") or []
        bullet_count = 0
        if isinstance(items, list):
            for it in items:
                if isinstance(it, dict):
                    bullets = it.get("bullets") or []
                    if isinstance(bullets, list):
                        bullet_count += sum(1 for b in bullets if isinstance(b, str) and b.strip())
        sections_out.append(
            {
                "index": i,
                "sectionTitle": (s.get("sectionTitle") or "").strip(),
                "itemCount": len(items) if isinstance(items, list) else 0,
                "bulletCount": bullet_count,
            }
        )
    raw_pi = resume_json.get("personalInfo")
    pi: dict = raw_pi if isinstance(raw_pi, dict) else {}
    keys = ("name", "email", "phone", "location", "linkedin", "portfolio", "summary")
    personal_info_present = {k: bool(isinstance(pi.get(k), str) and pi.get(k).strip()) for k in keys}
    return {"sections": sections_out, "personalInfoPresent": personal_info_present}


async def parse_resume_bytes(*, content: bytes, filename: str, gemini_api_key: str | None = None) -> dict:
    """
    Multimodal ingestion: map PDF/Word bytes to structured resume JSON via Gemini.
    """
    mime_type = _mime_type_for_filename(filename)
    logger.info("Ingestion: received %s [%s]", filename, mime_type)

    try:
        client = get_gemini_client(gemini_api_key)
        prompt = (
            "Extract EVERYTHING from this document exactly as written into the requested JSON schema. "
            "Leave fields empty string if not found. Do not omit any jobs, skills, or bullet points."
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[types.Part.from_bytes(data=content, mime_type=mime_type), prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GEMINI_RESUME_JSON_SCHEMA,
                temperature=0.0,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        logger.exception("Resume ingestion failed")
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Gemini API rate limit reached. Please wait a moment and try again, "
                    "or check your API quota at https://ai.dev/rate-limit"
                ),
            ) from e
        raise HTTPException(status_code=500, detail=err_str) from e
