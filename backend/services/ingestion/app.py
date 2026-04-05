"""
Standalone resume ingestion service.

  cd backend && PYTHONPATH=. uvicorn services.ingestion.app:app --host 0.0.0.0 --port 8001

Env: ``APP_ENV=production`` skips loading ``.env`` files (use platform secrets for keys).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.ingestion.router import router as ingestion_router
from shared.cors import get_cors_middleware_kwargs
from shared.startup_validation import require_gemini_credentials


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        require_gemini_credentials()
        yield

    app = FastAPI(title="Resume Ingestion Service", version="1.0.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, **get_cors_middleware_kwargs())
    app.include_router(ingestion_router, tags=["Ingestion"])

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "ingestion"}

    return app


app = create_app()
