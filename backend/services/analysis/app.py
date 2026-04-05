"""
Standalone analysis service.

  cd backend && PYTHONPATH=. uvicorn services.analysis.app:app --host 0.0.0.0 --port 8003
"""
import os

from dotenv import load_dotenv

load_dotenv()
if os.getenv("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.analysis.router import router as analysis_router


def create_app() -> FastAPI:
    app = FastAPI(title="Resume Analysis Service", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(analysis_router, tags=["Analysis"])
    return app


app = create_app()
