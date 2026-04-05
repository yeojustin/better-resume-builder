"""HTTP API for full CV rewrite vs JD (optional; analysis lives in services.analysis)."""

from fastapi import APIRouter, Header

from services.optimization.service import OptimizeRequest, optimize_cv_against_jd

router = APIRouter()


@router.post("/optimize-cv")
async def optimize_cv_endpoint(
    req: OptimizeRequest,
    x_gemini_api_key: str | None = Header(default=None, alias="X-Gemini-Api-Key"),
):
    key = (x_gemini_api_key or "").strip() or None
    return await optimize_cv_against_jd(
        master_cv=req.master_cv, job_description=req.job_description, gemini_api_key=key
    )
