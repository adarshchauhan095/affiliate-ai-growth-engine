import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    APP_ENV: str = Field(default="development")
    LOG_LEVEL: str = Field(default="INFO")
    SECRET_KEY: str = Field(default="dev-secret-key-32-chars-long-local-growth-engine")
    PORT: int = Field(default=8000)
    HOST: str = Field(default="127.0.0.1")
    APPROVAL_MODE: str = Field(default="SEMI_AUTOMATIC")  # MANUAL, SEMI_AUTOMATIC, AUTONOMOUS

    # Affiliate settings
    AMAZON_ASSOCIATE_TAG: str = Field(default="mybudgetdeal9-21")
    AMAZON_MARKETPLACE: str = Field(default="IN")
    DISCOVERY_PROVIDER: str = Field(default="seed_catalog")  # seed_catalog, manual_url, amazon_paapi
    AMAZON_PAAPI_ACCESS_KEY: str = Field(default="")
    AMAZON_PAAPI_SECRET_KEY: str = Field(default="")

    # Local Storage paths
    STORAGE_BASE_DIR: str = Field(default=str(BASE_DIR / "storage"))
    MEDIA_RENDER_DIR: str = Field(default=str(BASE_DIR / "storage" / "media" / "renders"))
    MEDIA_TEMP_DIR: str = Field(default=str(BASE_DIR / "storage" / "media" / "temp"))
    DATA_DIR: str = Field(default=str(BASE_DIR / "storage" / "data"))

    # AI Configuration
    AI_PROVIDER: str = Field(default="local_template")  # local_template, gemini_free, groq, ollama
    GEMINI_API_KEY: str = Field(default="")
    GROQ_API_KEY: str = Field(default="")
    OLLAMA_HOST: str = Field(default="http://localhost:11434")

    # Social & Publishing
    INSTAGRAM_ACCOUNT_ID: str = Field(default="")
    INSTAGRAM_ACCESS_TOKEN: str = Field(default="")
    FACEBOOK_PAGE_ID: str = Field(default="")
    FACEBOOK_PAGE_ACCESS_TOKEN: str = Field(default="")
    YOUTUBE_CLIENT_ID: str = Field(default="")
    YOUTUBE_CLIENT_SECRET: str = Field(default="")
    PINTEREST_ACCESS_TOKEN: str = Field(default="")
    PINTEREST_BOARD_ID: str = Field(default="")
    GITHUB_TOKEN: str = Field(default="")
    GITHUB_REPO: str = Field(default="adarshchauhan095/my-budget-deal-99")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure directories exist
for directory in [
    Path(settings.STORAGE_BASE_DIR),
    Path(settings.MEDIA_RENDER_DIR),
    Path(settings.MEDIA_TEMP_DIR),
    Path(settings.DATA_DIR),
]:
    directory.mkdir(parents=True, exist_ok=True)
