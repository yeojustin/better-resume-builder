"""
Single-process gateway: all domain routers in one FastAPI app (default local dev).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.analysis.router import router as analysis_router
from services.ingestion.router import router as ingestion_router
from services.jd.router import router as jd_router
from services.optimization.router import router as optimization_router
from shared.cors import get_cors_middleware_kwargs
from shared.startup_validation import require_gemini_credentials


def create_embedded_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        require_gemini_credentials()
        yield

    application = FastAPI(
        title="Better Resume Builder API",
        description="Gateway: resume ingestion, JD ingestion, lexical+LLM analysis, optional full CV tailor.",
        version="2.0.0",
        lifespan=lifespan,
    )
    application.add_middleware(CORSMiddleware, **get_cors_middleware_kwargs())
    application.include_router(ingestion_router, tags=["Ingestion"])
    application.include_router(jd_router, tags=["JD"])
    application.include_router(analysis_router, tags=["Analysis"])
    application.include_router(optimization_router, tags=["Optimization"])

    @application.get("/")
    async def health_check():
        return {
            "status": "Better Resume Builder — API gateway online",
            "mode": "embedded",
            "services": ["ingestion", "jd", "analysis", "optimization"],
        }

    @application.get("/health")
    async def health():
        return {"status": "ok", "mode": "embedded"}

    return application
