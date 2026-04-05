from typing import Any

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from shared.env_bootstrap import bootstrap_runtime_env

bootstrap_runtime_env()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    # Hosts often set GEMINI_API_KEY; google-genai also accepts GOOGLE_API_KEY.
    GEMINI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    USE_VERTEX_AI: bool = False
    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_CLOUD_LOCATION: str = "us-central1"

    # When True, ignore X-Gemini-Api-Key (deployment: server secret only).
    DISABLE_CLIENT_GEMINI_KEY_HEADER: bool = False

    ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Any) -> list[str]:
        if v is None:
            return []
        if isinstance(v, str):
            parts = [x.strip() for x in v.split(",") if x.strip()]
            return parts
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return []

    @model_validator(mode="after")
    def merge_gemini_into_google_key(self):
        g = (self.GOOGLE_API_KEY or "").strip()
        m = (self.GEMINI_API_KEY or "").strip()
        if m and not g:
            return self.model_copy(update={"GOOGLE_API_KEY": m})
        return self


settings = Settings()
