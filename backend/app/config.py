"""
config.py
Centralized application settings, loaded from environment variables.
Never hard-code secrets — everything sensitive comes from `.env` / the
hosting platform's environment configuration.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ---- App ----
    app_env: str = "development"
    demo_mode: bool = True
    allowed_origins: str = "http://localhost:5500"

    # ---- Supabase ----
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "documents"

    # ---- AI extraction ----
    ai_provider: str = "mock"
    ai_api_key: str = ""
    ai_model: str = "claude-sonnet-4-6"

    # ---- OCR ----
    ocr_provider: str = "mock"
    ocr_api_key: str = ""

    # ---- Uploads ----
    max_upload_size_mb: int = 15

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
