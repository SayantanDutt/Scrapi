from functools import lru_cache
from pathlib import Path
import os
from dotenv import load_dotenv
from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

origins = os.getenv("ALLOWED_ORIGINS", "https://scrapi-two.vercel.app").split(",")
class Settings(BaseSettings):
    APP_NAME: str = "Automated Web Scraper API"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    SECRET_KEY: str = "replace-with-a-long-random-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    MONGO_URI: str = Field(
        default="mongodb://localhost:27017",
        validation_alias=AliasChoices("MONGO_URI", "MONGODB_URI"),
    )
    MONGO_DB_NAME: str = Field(
        default="automated_web_scraper",
        validation_alias=AliasChoices("MONGO_DB_NAME", "MONGODB_DB_NAME"),
    )
    MONGO_SERVER_SELECTION_TIMEOUT_MS: int = 3000

    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    USER_AGENT: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    )
    REQUEST_TIMEOUT_SECONDS: int = 15

    RATE_LIMIT_REQUESTS: int = 30
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    USE_SELENIUM_FALLBACK: bool = False
    SELENIUM_PAGELOAD_TIMEOUT: int = 20
    SELENIUM_WAIT_SECONDS: int = 3

    ALLOWED_TARGET_TAGS: list[str] = Field(
        default_factory=lambda: [
            "div",
            "span",
            "p",
            "a",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "table",
            "li",
            "article",
            "section",
        ]
    )

    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("ALLOWED_TARGET_TAGS", mode="before")
    @classmethod
    def parse_allowed_tags(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [tag.strip().lower() for tag in value.split(",") if tag.strip()]
        return [tag.lower() for tag in value]


@lru_cache
def get_settings() -> Settings:
    return Settings()
