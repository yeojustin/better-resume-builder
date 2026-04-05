"""
Runtime environment loading.

- **Production / deployment** (`APP_ENV=production`): do not read `.env` files. Use only
  process environment (e.g. platform secrets: `GEMINI_API_KEY` / `GOOGLE_API_KEY`).
- **Development** (default): load `.env` from `backend/.env` and repo root `.env` when present.
- **Local Gemini (default in development)**: unless `GEMINI_SESSION_ONLY=false`, strip
  `GEMINI_API_KEY` and `GOOGLE_API_KEY` from the process environment after loading so the
  UI session key (`X-Gemini-Api-Key`) is used instead of `.env` or shell. Production never strips.

Idempotent: safe to call from every entrypoint.
"""

from __future__ import annotations

import os
from pathlib import Path

_bootstrapped = False


def _backend_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _gemini_session_only_effective() -> bool:
    """Strip server-side Gemini keys so only per-request ``X-Gemini-Api-Key`` is used."""
    app_env = os.getenv("APP_ENV", "development").lower()
    if app_env in ("production", "prod"):
        return False
    raw = (os.getenv("GEMINI_SESSION_ONLY") or "").strip().lower()
    if raw in ("0", "false", "no"):
        return False
    if raw in ("1", "true", "yes"):
        return True
    return True


def _apply_gemini_session_only_stripping() -> None:
    if not _gemini_session_only_effective():
        return
    os.environ.pop("GEMINI_API_KEY", None)
    os.environ.pop("GOOGLE_API_KEY", None)


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
        _apply_gemini_session_only_stripping()
        return

    try:
        from dotenv import load_dotenv
    except ImportError:
        _sync_gemini_to_google_env()
        _apply_gemini_session_only_stripping()
        return

    backend = _backend_root()
    load_dotenv(backend / ".env")
    load_dotenv(backend.parent / ".env")
    _sync_gemini_to_google_env()
    _apply_gemini_session_only_stripping()


def _sync_gemini_to_google_env() -> None:
    """google-genai uses GOOGLE_API_KEY; we accept GEMINI_API_KEY from hosts that only set that."""
    gemini = (os.getenv("GEMINI_API_KEY") or "").strip()
    google = (os.getenv("GOOGLE_API_KEY") or "").strip()
    if gemini and not google:
        os.environ["GOOGLE_API_KEY"] = gemini
