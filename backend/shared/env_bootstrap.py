"""
Runtime environment loading.

- **Production / deployment** (`APP_ENV=production`): do not read `.env` files. Use only
  process environment (e.g. platform secrets: `GEMINI_API_KEY` / `GOOGLE_API_KEY`).
- **Development** (default): load `.env` from `backend/.env` and repo root `.env` when present.

Idempotent: safe to call from every entrypoint.
"""

from __future__ import annotations

import os
from pathlib import Path

_bootstrapped = False


def _backend_root() -> Path:
    return Path(__file__).resolve().parent.parent


def bootstrap_runtime_env() -> None:
    global _bootstrapped
    if _bootstrapped:
        return
    _bootstrapped = True

    app_env = os.getenv("APP_ENV", "development").lower()
    force_dotenv = os.getenv("LOAD_DOTENV", "").lower() in ("1", "true", "yes")
    skip_dotenv = os.getenv("SKIP_DOTENV", "").lower() in ("1", "true", "yes")

    if app_env in ("production", "prod") and not force_dotenv:
        _sync_gemini_to_google_env()
        return

    if skip_dotenv and not force_dotenv:
        _sync_gemini_to_google_env()
        return

    try:
        from dotenv import load_dotenv
    except ImportError:
        _sync_gemini_to_google_env()
        return

    backend = _backend_root()
    load_dotenv(backend / ".env")
    load_dotenv(backend.parent / ".env")
    _sync_gemini_to_google_env()


def _sync_gemini_to_google_env() -> None:
    """google-genai uses GOOGLE_API_KEY; we accept GEMINI_API_KEY from hosts that only set that."""
    gemini = (os.getenv("GEMINI_API_KEY") or "").strip()
    google = (os.getenv("GOOGLE_API_KEY") or "").strip()
    if gemini and not google:
        os.environ["GOOGLE_API_KEY"] = gemini
