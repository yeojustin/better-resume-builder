"""CORS defaults derived from ``ALLOWED_ORIGINS`` (comma-separated in env)."""

from shared.config import settings


def get_cors_middleware_kwargs() -> dict:
    origins = settings.ALLOWED_ORIGINS
    if not origins:
        return {
            "allow_origins": ["*"],
            "allow_credentials": False,
            "allow_methods": ["*"],
            "allow_headers": ["*"],
        }
    return {
        "allow_origins": list(origins),
        "allow_credentials": False,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
