"""
Standalone CV tailoring service (full JSON rewrite).

  cd backend && PYTHONPATH=. uvicorn services.optimization.app:app --host 0.0.0.0 --port 8004
"""
import os

from dotenv import load_dotenv

load_dotenv()
if os.getenv("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.getenv("GEMINI_API_KEY")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.optimization.router import router as optimization_router


def create_app() -> FastAPI:
    app = FastAPI(title="CV Tailoring Service", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(optimization_router, tags=["Optimization"])
    return app


app = create_app()
