"""
API gateway (BFF): mounts domain microservices in one process for local dev.

Deploy separately later:
  services.ingestion.app   (8001)
  services.jd.app          (8002)
  services.analysis.app    (8003)
  services.optimization.app (8004)
"""
import os

from dotenv import load_dotenv

load_dotenv()
if os.getenv("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.analysis.router import router as analysis_router
from services.ingestion.router import router as ingestion_router
from services.jd.router import router as jd_router
from services.optimization.router import router as optimization_router


def create_app() -> FastAPI:
    application = FastAPI(
        title="Better Resume Builder API",
        description="Gateway: resume ingestion, JD ingestion, lexical+LLM analysis, optional full CV tailor.",
        version="2.0.0",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(ingestion_router, tags=["Ingestion"])
    application.include_router(jd_router, tags=["JD"])
    application.include_router(analysis_router, tags=["Analysis"])
    application.include_router(optimization_router, tags=["Optimization"])

    @application.get("/")
    async def health_check():
        return {
            "status": "Better Resume Builder — API gateway online",
            "services": ["ingestion", "jd", "analysis", "optimization"],
        }

    return application


app = create_app()
