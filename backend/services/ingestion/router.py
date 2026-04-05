"""HTTP API for document ingestion (CV → structured JSON)."""

from fastapi import APIRouter, File, Header, UploadFile

from services.ingestion.service import build_resume_outline, parse_resume_bytes, validate_resume_upload

router = APIRouter()


@router.post("/parse-resume")
async def upload_and_parse_endpoint(
    file: UploadFile = File(...),
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-Api-Key"),
):
    validate_resume_upload(file.filename or "")
    content = await file.read()
    key = (x_gemini_api_key or "").strip() or None
    resume_json = await parse_resume_bytes(content=content, filename=file.filename or "upload", gemini_api_key=key)
    return {
        "resume_json": resume_json,
        "resume_outline": build_resume_outline(resume_json),
    }
