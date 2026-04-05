"""
Standalone JD ingestion service (deploy separately: uvicorn from repo `backend/`).

  cd backend && PYTHONPATH=. uvicorn services.jd.app:app --host 0.0.0.0 --port 8002
"""
import os

from dotenv import load_dotenv

load_dotenv()
if os.getenv("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.jd.router import router as jd_router


def create_app() -> FastAPI:
    app = FastAPI(title="JD Ingestion Service", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(jd_router, tags=["JD"])
    return app


app = create_app()
