from typing import Any, List

from pydantic import BaseModel, Field, field_validator


class ScrapeRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)
    use_selenium_fallback: bool = True

    @field_validator("url")
    @classmethod
    def strip_url(cls, value: str) -> str:
        return value.strip()


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
    final_url: str
    created_at: str

    # Smart extraction
    records: list[dict[str, Any]]
    columns: list[str]
    record_count: int
    detection_method: str
    detected_pattern: str

    # Classic extraction (backward compat)
    headings: list[dict[str, Any]]
    paragraphs: list[dict[str, Any]]
    links: list[dict[str, Any]]
    tables: list[dict[str, Any]]

    # Metadata
    dynamic_content_detected: bool
    used_selenium: bool
    metrics: ScrapeMetrics
    csv_download_url: str
    json_download_url: str


class HistoryItem(BaseModel):
    id: str
    url: str
    created_at: str
    dynamic_content_detected: bool
    used_selenium: bool
    record_count: int
    detection_method: str
    detected_pattern: str
    metrics: ScrapeMetrics
    csv_download_url: str
    json_download_url: str


class HistoryResponse(BaseModel):
    items: List[HistoryItem]
