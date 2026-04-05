"""
Standalone resume ingestion service.

  cd backend && PYTHONPATH=. uvicorn services.ingestion.app:app --host 0.0.0.0 --port 8001
"""
import os

from dotenv import load_dotenv

load_dotenv()
if os.getenv("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.ingestion.router import router as ingestion_router


def create_app() -> FastAPI:
    app = FastAPI(title="Resume Ingestion Service", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(ingestion_router, tags=["Ingestion"])
    return app


app = create_app()
