"""Fail fast at process start when Gemini cannot be configured."""

from shared.config import settings


def require_gemini_credentials() -> None:
    """
    For processes that call Gemini via this codebase.

    - Vertex: requires ``GOOGLE_CLOUD_PROJECT``.
    - AI Studio + ``DISABLE_CLIENT_GEMINI_KEY_HEADER``: requires a server API key.
    - AI Studio with client header allowed: server key optional (e.g. session ``X-Gemini-Api-Key``).
    """
    if settings.USE_VERTEX_AI:
        if not (settings.GOOGLE_CLOUD_PROJECT or "").strip():
            raise RuntimeError(
                "USE_VERTEX_AI=true requires GOOGLE_CLOUD_PROJECT in the environment."
            )
        return
    if settings.DISABLE_CLIENT_GEMINI_KEY_HEADER and not (
        settings.GOOGLE_API_KEY or ""
    ).strip():
        raise RuntimeError(
            "Missing GEMINI_API_KEY or GOOGLE_API_KEY. "
            "Set it as a platform secret (not a committed .env). "
            "With APP_ENV=production, .env files are not loaded."
        )
