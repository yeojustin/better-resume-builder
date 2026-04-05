"""HTTP API for job description → structured JSON."""

from fastapi import APIRouter, File, Header, UploadFile

from services.jd.service import ParseJDTextBody, jd_plain_text, parse_jd_structured_from_bytes, parse_jd_structured_from_text

router = APIRouter()


@router.post("/parse-jd")
async def parse_jd_upload(
    file: UploadFile = File(...),
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-Api-Key"),
):
    content = await file.read()
    key = (x_gemini_api_key or "").strip() or None
    jd_json = await parse_jd_structured_from_bytes(content=content, filename=file.filename, gemini_api_key=key)
    return {"jd_json": jd_json, "jd_text": jd_plain_text(jd_json)}


@router.post("/parse-jd-text")
async def parse_jd_paste(
    body: ParseJDTextBody,
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-Api-Key"),
):
    key = (x_gemini_api_key or "").strip() or None
    jd_json = await parse_jd_structured_from_text(text=body.text, gemini_api_key=key)
    return {"jd_json": jd_json, "jd_text": jd_plain_text(jd_json)}
