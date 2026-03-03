from typing import Any

from pydantic import BaseModel, Field, field_validator


class ScrapeRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)
    target_tag: str | None = Field(default=None, max_length=50)
    class_name: str | None = Field(default=None, max_length=120)
    use_selenium_fallback: bool = False

    @field_validator("url")
    @classmethod
    def strip_url(cls, value: str) -> str:
        return value.strip()

    @field_validator("target_tag")
    @classmethod
    def normalize_tag(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        return cleaned or None

    @field_validator("class_name")
    @classmethod
    def normalize_class_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ScrapeMetrics(BaseModel):
    runtime_seconds: float
    memory_usage_mb: float
    traversed_nodes: int
    extracted_nodes: int
    efficiency_ratio: float
    complexity_note: str


class ScrapeResponse(BaseModel):
    id: str
    url: str
    created_at: str
    dynamic_content_detected: bool
    used_selenium: bool
    data: dict[str, Any]
    metrics: ScrapeMetrics
    csv_download_url: str


class HistoryItem(BaseModel):
    id: str
    url: str
    created_at: str
    runtime_seconds: float
    memory_usage_mb: float
    traversed_nodes: int
    extracted_nodes: int
    efficiency_ratio: float
    dynamic_content_detected: bool
    used_selenium: bool


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
