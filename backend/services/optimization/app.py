"""
Standalone CV tailoring service (full JSON rewrite).

  cd backend && PYTHONPATH=. uvicorn services.optimization.app:app --host 0.0.0.0 --port 8004

Env: ``APP_ENV=production`` skips loading ``.env`` files (use platform secrets for keys).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.optimization.router import router as optimization_router
from shared.cors import get_cors_middleware_kwargs
from shared.startup_validation import require_gemini_credentials


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        require_gemini_credentials()
        yield

    app = FastAPI(title="CV Tailoring Service", version="1.0.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, **get_cors_middleware_kwargs())
    app.include_router(optimization_router, tags=["Optimization"])

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "optimization"}

    return app


app = create_app()
