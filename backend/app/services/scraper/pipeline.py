"""
Main scraping pipeline orchestrator.

Executes: fetch → parse → detect → extract → clean
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from .clean import normalize_records, get_columns
from .detect import detect_patterns
from .dynamic import fetch_html_with_selenium
from .extract import (
    detect_dynamic_content,
    extract_classic,
    extract_lists,
    extract_records_from_pattern,
    extract_tables,
)
from .fetch import fetch_html

logger = logging.getLogger(__name__)

MIN_PATTERN_RECORDS = 3


@dataclass
class ScrapeResult:
    url: str
    final_url: str = ""
    status_code: int = 0

    # Smart extraction (primary output)
    records: List[Dict[str, Any]] = field(default_factory=list)
    columns: List[str] = field(default_factory=list)
    record_count: int = 0
    detection_method: str = "classic"  # "pattern" | "table" | "list" | "classic"
    detected_pattern: str = ""

    # Classic extraction (secondary / backward-compat)
    headings: List[Dict] = field(default_factory=list)
    paragraphs: List[Dict] = field(default_factory=list)
    links: List[Dict] = field(default_factory=list)
    tables: List[Dict] = field(default_factory=list)

    # Metadata
    dynamic_content_detected: bool = False
    used_selenium: bool = False
    traversed_nodes: int = 0
    extracted_nodes: int = 0
    error: Optional[str] = None


async def run_pipeline(
    url: str,
    use_selenium_fallback: bool = True,
) -> ScrapeResult:
    """
    Full scraping pipeline:
    1. HTTP fetch with retry logic
    2. Initial parse and dynamic content detection
    3. Optional Selenium render for JS-heavy pages
    4. Pattern detection on DOM
    5. Smart record extraction
    6. Normalization and cleaning
    """
    result = ScrapeResult(url=url)

    # ── 1. Fetch ───────────────────────────────────────────────────────────────
    fetch_result = await asyncio.to_thread(fetch_html, url)
    result.status_code = fetch_result.status_code
    result.final_url = fetch_result.final_url or url

    html = fetch_result.html
    if not html:
        result.error = "Failed to fetch page content"
        return result

    # ── 2. Initial parse ───────────────────────────────────────────────────────
    soup = BeautifulSoup(html, "lxml")
    result.traversed_nodes = len(soup.find_all(True))

    # ── 3. Dynamic content detection ──────────────────────────────────────────
    is_dynamic = detect_dynamic_content(soup)
    result.dynamic_content_detected = is_dynamic

    # ── 4. Selenium fallback ───────────────────────────────────────────────────
    if is_dynamic and use_selenium_fallback:
        try:
            rendered_html = await asyncio.to_thread(
                fetch_html_with_selenium, result.final_url
            )
            if rendered_html:
                html = rendered_html
                soup = BeautifulSoup(html, "lxml")
                result.traversed_nodes = len(soup.find_all(True))
                result.used_selenium = True
                result.dynamic_content_detected = detect_dynamic_content(soup)
        except Exception as e:
            logger.warning("Selenium fallback failed for %s: %s", url, e)

    # Strip noise nodes before extraction
    for noise in soup.find_all(["script", "style", "noscript", "svg", "iframe"]):
        noise.decompose()

    # ── 5. Pattern detection + extraction ──────────────────────────────────────
    records: List[Dict] = []
    detection_method = "classic"
    detected_pattern_str = ""

    patterns = detect_patterns(soup)
    if patterns:
        best = patterns[0]
        raw_records = extract_records_from_pattern(soup, best, result.final_url)
        if len(raw_records) >= MIN_PATTERN_RECORDS:
            records = normalize_records(raw_records)
            if records:
                detection_method = "pattern"
                cls_str = ".".join(best.classes)
                detected_pattern_str = (
                    f"{best.tag}.{cls_str}" if cls_str else best.tag
                )

    # ── 6. Table fallback ──────────────────────────────────────────────────────
    tables_data: List[Dict] = []
    if not records:
        tables_data = extract_tables(soup)
        if tables_data:
            largest = max(tables_data, key=lambda t: len(t["records"]))
            if len(largest["records"]) >= 3:
                records = normalize_records(largest["records"])
                if records:
                    detection_method = "table"
                    detected_pattern_str = largest.get("caption") or "HTML Table"
                    result.tables = tables_data

    # ── 7. List fallback ───────────────────────────────────────────────────────
    if not records:
        list_records = extract_lists(soup, result.final_url)
        if len(list_records) >= 5:
            records = normalize_records(list_records)
            if records:
                detection_method = "list"
                detected_pattern_str = "List Items"

    # ── 8. Classic extraction (always run for full data) ───────────────────────
    classic = extract_classic(soup, result.final_url)
    result.headings = classic["headings"]
    result.paragraphs = classic["paragraphs"]
    result.links = classic["links"]

    # Populate tables if not already set
    if not result.tables:
        if not tables_data:
            tables_data = extract_tables(soup)
        result.tables = tables_data

    # ── 9. Last-resort: classic data → records ─────────────────────────────────
    if not records:
        if result.tables:
            largest = max(result.tables, key=lambda t: len(t.get("records", [])))
            records = normalize_records(largest.get("records", []))
            detection_method = "table"
            detected_pattern_str = largest.get("caption") or "HTML Table"
        elif classic["headings"]:
            records = normalize_records(
                [{"level": h["level"], "heading": h["text"]} for h in classic["headings"]]
            )
            detection_method = "classic"
        elif classic["paragraphs"]:
            records = normalize_records(
                [{"text": p["text"]} for p in classic["paragraphs"][:50]]
            )
            detection_method = "classic"
        elif classic["links"]:
            records = normalize_records(
                [{"text": l["text"], "url": l["href"]} for l in classic["links"][:50]]
            )
            detection_method = "classic"

    # ── 10. Finalize ───────────────────────────────────────────────────────────
    result.records = records
    result.columns = get_columns(records)
    result.record_count = len(records)
    result.detection_method = detection_method
    result.detected_pattern = detected_pattern_str
    result.extracted_nodes = len(records)

    return result
