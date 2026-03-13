"""
Smart content extraction from HTML.

Supports three extraction modes:
1. Pattern-based: structured records from repeating HTML elements
2. Table-based: HTML tables as record arrays
3. Classic: headings, paragraphs, links fallback
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, List
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Tag

from .detect import DetectedPattern


# ── Text normalisation ────────────────────────────────────────────────────────

def _clean_text(value: str) -> str:
    """Collapse whitespace and strip Unicode control characters."""
    value = "".join(
        ch for ch in value
        if not unicodedata.category(ch).startswith("C") or ch in "\n\t"
    )
    return " ".join(value.split())


def _norm_header(text: str) -> str:
    """Convert a table header to a clean snake_case key."""
    text = _clean_text(text).lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", "_", text.strip())
    return text or "column"


# ── Field extractors ──────────────────────────────────────────────────────────

def _extract_title(el: Tag) -> str:
    """Extract a title/name field from an element."""
    heading = el.find(re.compile(r"^h[1-6]$"))
    if heading:
        return _clean_text(heading.get_text())

    strong = el.find("strong") or el.find("b")
    if strong:
        t = _clean_text(strong.get_text())
        if t:
            return t

    title_kws = ("title", "name", "heading", "label", "product-name", "item-name")
    for candidate in el.find_all(True):
        cls_str = " ".join(candidate.get("class", [])).lower()
        if any(kw in cls_str for kw in title_kws):
            t = _clean_text(candidate.get_text())
            if t and len(t) < 200:
                return t

    a = el.find("a")
    if a:
        t = _clean_text(a.get_text())
        if t:
            return t

    return ""


def _extract_price(el: Tag) -> str:
    text = el.get_text(separator=" ")
    m = re.search(
        r"[\$£€¥₹]\s*[\d,]+(?:\.\d{1,2})?|\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:USD|EUR|GBP|INR)",
        text,
    )
    return m.group(0).strip() if m else ""


def _extract_link(el: Tag, base_url: str = "") -> str:
    anchors = el.find_all("a", href=True)
    for a in anchors:
        href = str(a["href"]).strip()
        if href.startswith(("javascript:", "mailto:", "tel:", "#")):
            continue
        if base_url and not href.startswith(("http", "//")):
            href = urljoin(base_url, href)
        return href
    return ""


def _extract_image(el: Tag, base_url: str = "") -> str:
    img = el.find("img")
    if not img:
        return ""
    src = (
        img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        or img.get("data-original") or ""
    )
    src = str(src).strip()
    if not src or src.startswith("data:"):
        return ""
    if base_url and not src.startswith(("http", "//")):
        src = urljoin(base_url, src)
    return src


def _extract_date(el: Tag) -> str:
    time_el = el.find("time")
    if time_el:
        dt = time_el.get("datetime", "")
        return str(dt).strip() if dt else _clean_text(time_el.get_text())
    text = el.get_text(separator=" ")
    m = re.search(
        r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b"
        r"|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b"
        r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s+\d{4}",
        text, re.I,
    )
    return m.group(0).strip() if m else ""


def _extract_rating(el: Tag) -> str:
    for candidate in el.find_all(True):
        aria = candidate.get("aria-label", "")
        if re.search(r"\d.*star", str(aria), re.I):
            return str(aria).strip()
    text = el.get_text(separator=" ")
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:/\s*(?:5|10)|stars?|\s*★)", text, re.I)
    return m.group(0).strip() if m else ""


def _extract_description(el: Tag, title: str = "") -> str:
    desc_kws = ("desc", "summary", "excerpt", "body", "content", "text", "detail", "info")
    for candidate in el.find_all(["p", "span", "div"]):
        cls_str = " ".join(candidate.get("class", [])).lower()
        if any(kw in cls_str for kw in desc_kws):
            t = _clean_text(candidate.get_text())
            if len(t) > 20 and t != title:
                return t[:400]
    p = el.find("p")
    if p:
        t = _clean_text(p.get_text())
        if len(t) > 20 and t != title:
            return t[:400]
    return ""


# ── Pattern-based record extraction ──────────────────────────────────────────

def extract_records_from_pattern(
    soup: BeautifulSoup,
    pattern: DetectedPattern,
    base_url: str = "",
) -> List[Dict[str, Any]]:
    """
    Extract structured records from all elements matching a pattern.
    Each matching element becomes one record with semantic field names.
    """
    candidates = soup.find_all(pattern.tag)
    if pattern.classes:
        # Exact class-set match (BS4 does subset matching, so we post-filter)
        elements = [
            el for el in candidates
            if tuple(sorted(el.get("class", []))) == pattern.classes
        ]
    else:
        elements = candidates

    records: List[Dict[str, Any]] = []
    for el in elements:
        rec: Dict[str, Any] = {}

        title = _extract_title(el)
        if title:
            rec["title"] = title

        price = _extract_price(el)
        if price:
            rec["price"] = price

        description = _extract_description(el, title)
        if description:
            rec["description"] = description

        link = _extract_link(el, base_url)
        if link:
            rec["link"] = link

        image = _extract_image(el, base_url)
        if image:
            rec["image"] = image

        date = _extract_date(el)
        if date:
            rec["date"] = date

        rating = _extract_rating(el)
        if rating:
            rec["rating"] = rating

        # Full text fallback when no structured fields found
        if not rec.get("title") and not rec.get("description"):
            full_text = _clean_text(el.get_text(separator=" "))
            if full_text:
                rec["text"] = full_text[:400]
        elif not rec.get("description") and not rec.get("price"):
            full_text = _clean_text(el.get_text(separator=" "))
            if len(full_text) > len(title or "") + 40:
                rec["text"] = full_text[:400]

        if rec:
            records.append(rec)

    return records


# ── Table extraction ──────────────────────────────────────────────────────────

def _make_unique_headers(raw: List[str]) -> List[str]:
    seen: dict[str, int] = {}
    result = []
    for h in raw:
        h = _norm_header(h) or "column"
        if h in seen:
            seen[h] += 1
            result.append(f"{h}_{seen[h]}")
        else:
            seen[h] = 0
            result.append(h)
    return result


def extract_tables(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Extract all HTML tables as lists of record dicts."""
    results: List[Dict[str, Any]] = []

    for table in soup.find_all("table")[:25]:
        raw_headers: List[str] = []
        caption_text = ""

        caption = table.find("caption")
        if caption:
            caption_text = _clean_text(caption.get_text())

        all_rows = table.find_all("tr")
        if not all_rows:
            continue

        thead = table.find("thead")
        if thead:
            for hr in thead.find_all("tr"):
                raw_headers.extend(
                    _clean_text(c.get_text()) for c in hr.find_all(["th", "td"])
                )
            tbody = table.find("tbody")
            data_rows = tbody.find_all("tr") if tbody else all_rows
        else:
            first_cells = all_rows[0].find_all(["th", "td"])
            if any(c.name == "th" for c in first_cells):
                raw_headers = [_clean_text(c.get_text()) for c in first_cells]
                data_rows = all_rows[1:]
            else:
                data_rows = all_rows

        seen_rows: set[tuple] = set()
        raw_records: List[List[str]] = []
        for row in data_rows[:200]:
            cells = row.find_all(["td", "th"])
            values = [_clean_text(c.get_text()) for c in cells]
            if not any(values):
                continue
            row_key = tuple(values)
            if row_key in seen_rows:
                continue
            seen_rows.add(row_key)
            raw_records.append(values)

        if not raw_records:
            continue

        col_count = max(len(r) for r in raw_records)
        if raw_headers:
            while len(raw_headers) < col_count:
                raw_headers.append(f"column_{len(raw_headers) + 1}")
        else:
            raw_headers = [f"column_{i + 1}" for i in range(col_count)]

        headers = _make_unique_headers(raw_headers)

        dict_records: List[Dict[str, Any]] = []
        for row in raw_records:
            padded = row + [""] * (col_count - len(row))
            rec = dict(zip(headers, padded[:col_count]))
            if any(v for v in rec.values()):
                dict_records.append(rec)

        if dict_records:
            results.append({
                "caption": caption_text,
                "columns": headers,
                "records": dict_records,
            })

    return results


# ── List extraction ───────────────────────────────────────────────────────────

def extract_lists(soup: BeautifulSoup, base_url: str = "") -> List[Dict[str, Any]]:
    """Extract the largest meaningful list as records."""
    best: List[Dict[str, Any]] = []

    for ul_ol in soup.find_all(["ul", "ol"]):
        items = ul_ol.find_all("li", recursive=False)
        if len(items) < 5:
            continue

        records: List[Dict[str, Any]] = []
        for li in items:
            text = _clean_text(li.get_text())
            if len(text) < 5:
                continue
            rec: Dict[str, Any] = {"text": text[:300]}
            link = _extract_link(li, base_url)
            if link:
                rec["link"] = link
            img = _extract_image(li, base_url)
            if img:
                rec["image"] = img
            records.append(rec)

        if len(records) > len(best):
            best = records

    return best


# ── Classic fallback extraction ───────────────────────────────────────────────

def extract_classic(soup: BeautifulSoup, base_url: str = "") -> Dict[str, List]:
    """Classic extraction: headings, paragraphs, links."""
    result: Dict[str, List] = {"headings": [], "paragraphs": [], "links": []}

    seen: set[str] = set()
    for tag in ["h1", "h2", "h3", "h4", "h5", "h6"]:
        for el in soup.find_all(tag)[:60]:
            text = _clean_text(el.get_text())
            if text and text not in seen:
                seen.add(text)
                result["headings"].append({"level": tag, "text": text})

    seen_p: set[str] = set()
    for el in soup.find_all("p")[:100]:
        text = _clean_text(el.get_text())
        if len(text) >= 20 and text not in seen_p:
            seen_p.add(text)
            result["paragraphs"].append({"text": text})

    seen_links: set[str] = set()
    parsed_base = urlparse(base_url)
    for el in soup.find_all("a", href=True)[:150]:
        href = str(el["href"]).strip()
        if href.startswith(("javascript:", "mailto:", "tel:", "#")):
            continue
        if base_url and not href.startswith(("http", "//")):
            href = urljoin(base_url, href)
        if href in seen_links:
            continue
        seen_links.add(href)
        link_text = _clean_text(el.get_text()) or href
        link_domain = urlparse(href).netloc
        result["links"].append({
            "text": link_text,
            "href": href,
            "is_external": bool(
                parsed_base.netloc and link_domain and link_domain != parsed_base.netloc
            ),
        })

    return result


# ── Dynamic content detection ─────────────────────────────────────────────────

def detect_dynamic_content(soup: BeautifulSoup) -> bool:
    """Heuristically detect if a page requires JS rendering for meaningful content."""
    all_tags = soup.find_all(True)
    total = len(all_tags)
    if total == 0:
        return False

    # SPA root with little content
    spa_roots = soup.find_all(
        attrs={"id": re.compile(r"^(root|app|__next|__nuxt|ng-app)$", re.I)}
    )
    if spa_roots:
        body_text = soup.body.get_text(strip=True) if soup.body else ""
        if len(body_text) < 500:
            return True

    scripts = soup.find_all("script")
    script_ratio = len(scripts) / total
    body_text = soup.body.get_text(strip=True) if soup.body else ""
    if script_ratio > 0.15 and len(scripts) > 15 and len(body_text) < 800:
        return True

    return False
