"""HTTP API for resume vs JD analysis."""

from fastapi import APIRouter, Header

from services.analysis.service import AnalyzeRequest, analyze_resume_vs_jd

router = APIRouter()


@router.post("/analyze-resume")
async def analyze_resume_endpoint(
    req: AnalyzeRequest,
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-Api-Key"),
):
    key = (x_gemini_api_key or "").strip() or None
    return await analyze_resume_vs_jd(
        resume_json=req.resume_json,
        job_description=req.job_description,
        jd_json=req.jd_json,
        groundedness_percent=req.groundedness_percent,
        creativity_percent=req.creativity_percent,
        temperature=req.temperature,
        professionalism=req.professionalism,
        gemini_api_key=key,
    )
