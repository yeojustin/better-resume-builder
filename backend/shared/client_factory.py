from google import genai

from shared.config import settings


def get_gemini_client(api_key: str | None = None) -> genai.Client:
    """
    Gemini client for Google AI Studio (api key) or Vertex when configured.

    If ``api_key`` is a non-empty string (e.g. from ``X-Gemini-Api-Key`` on a request),
    it is used for this client only and must not be logged or persisted.
    Otherwise ``settings.GOOGLE_API_KEY`` is used.

    When ``DISABLE_CLIENT_GEMINI_KEY_HEADER`` is True (typical production deploy),
    request overrides are ignored and only the server key is used.
    """
    if settings.USE_VERTEX_AI:
        return genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.GOOGLE_CLOUD_LOCATION,
        )
    if settings.DISABLE_CLIENT_GEMINI_KEY_HEADER:
        override = ""
    else:
        override = (api_key or "").strip()
    resolved = override or (settings.GOOGLE_API_KEY or "").strip()
    return genai.Client(api_key=resolved)
