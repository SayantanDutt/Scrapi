"""
Pattern detection: identifies repeating HTML structures representing structured datasets.

Algorithm:
1. Walk the DOM collecting (tag, classes) signature → element mappings
2. Filter to signatures with >= MIN_REPETITIONS occurrences
3. Score each candidate by field richness
4. Return top patterns sorted by score
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import List, Tuple

from bs4 import BeautifulSoup, Tag

MIN_REPETITIONS = 3

# Noise class keywords — likely UI chrome, not data
_NOISE_KEYWORDS = frozenset({
    "nav", "navbar", "navigation", "menu", "header", "footer", "sidebar",
    "modal", "dialog", "toast", "alert", "tooltip", "btn", "button",
    "icon", "logo", "breadcrumb", "pagination", "cookie", "banner",
    "ad", "ads", "advertisement", "social", "share", "dropdown", "overlay",
    "tab", "accordion", "collapse", "popover", "close", "dismiss",
    "spinner", "loader", "skeleton", "placeholder",
})

# Tags we never treat as data containers
_SKIP_TAGS = frozenset({
    "html", "head", "body", "script", "style", "meta", "link",
    "noscript", "iframe", "svg", "path", "g", "circle", "rect",
    "br", "hr", "input", "select", "option", "textarea", "button",
    "label", "form", "figure", "figcaption",
})


@dataclass
class DetectedPattern:
    tag: str
    classes: Tuple[str, ...]
    selector: str
    count: int
    score: float
    sample_fields: List[str] = field(default_factory=list)


def _class_is_noise(classes: Tuple[str, ...]) -> bool:
    joined = " ".join(classes).lower()
    return any(kw in joined for kw in _NOISE_KEYWORDS)


def _score_element(el: Tag) -> float:
    """Score a single element by structured data richness."""
    score = 0.0
    text = el.get_text(separator=" ", strip=True)

    text_len = len(text)
    if text_len < 10:
        return 0.0

    score += min(text_len / 80, 3.0)

    if el.find("a"):
        score += 1.0
    if el.find("img"):
        score += 1.0
    if el.find(re.compile(r"^h[1-6]$")):
        score += 1.5
    if re.search(r"[\$£€¥₹]\s*[\d,]+\.?\d*|\d+(?:\.\d+)?\s*(?:USD|EUR|GBP|INR)", text):
        score += 2.0

    direct_children = [c for c in el.children if isinstance(c, Tag)]
    score += min(len(direct_children) * 0.2, 1.5)

    data_attrs = sum(1 for k in el.attrs if k.startswith("data-"))
    score += min(data_attrs * 0.3, 1.0)

    return score


def _infer_fields(elements: List[Tag]) -> List[str]:
    """Infer available data fields from a sample of elements."""
    fields: set[str] = set()
    for el in elements[:8]:
        text = el.get_text(separator=" ", strip=True)
        if el.find(re.compile(r"^h[1-6]$")) or el.find("strong") or el.find("b"):
            fields.add("title")
        if el.find("a"):
            fields.add("link")
        if el.find("img"):
            fields.add("image")
        if re.search(r"[\$£€¥₹]\s*[\d,]+\.?\d*", text):
            fields.add("price")
        if re.search(
            r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b"
            r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}",
            text, re.I,
        ):
            fields.add("date")
        if el.find("time"):
            fields.add("date")
        if re.search(r"\b\d+(?:\.\d+)?\s*(?:/\s*(?:5|10)|stars?)\b", text, re.I):
            fields.add("rating")
        if text:
            fields.add("text")
    return sorted(fields)


def detect_patterns(soup: BeautifulSoup) -> List[DetectedPattern]:
    """
    Detect repeating HTML patterns likely representing structured datasets.
    Returns patterns sorted by score descending (best first).
    """
    # Track element IDs inside noise containers to skip
    noise_ids: set[int] = set()
    for noise_tag in soup.find_all(["nav", "header", "footer", "script", "style", "noscript"]):
        noise_ids.add(id(noise_tag))
        for child in noise_tag.find_all(True):
            noise_ids.add(id(child))

    sig_map: dict[tuple, list] = defaultdict(list)

    for el in soup.find_all(True):
        if not isinstance(el, Tag):
            continue
        if id(el) in noise_ids:
            continue
        if el.name in _SKIP_TAGS:
            continue
        classes = tuple(sorted(el.get("class", [])))
        if not classes:
            continue
        sig_map[(el.name, classes)].append(el)

    patterns: List[DetectedPattern] = []

    for (tag, classes), elements in sig_map.items():
        count = len(elements)
        if count < MIN_REPETITIONS:
            continue
        if _class_is_noise(classes):
            continue

        sample = elements[:10]
        scores = [_score_element(e) for e in sample]
        avg_score = sum(scores) / len(scores)

        if avg_score < 0.8:
            continue

        fields = _infer_fields(elements)
        if len(fields) < 2:
            continue

        # Size bonus: more items → more likely a real dataset
        size_bonus = 1.0 + min(count / 25, 1.0)
        final_score = avg_score * size_bonus

        cls_str = ".".join(classes)
        selector = f"{tag}.{cls_str}"

        patterns.append(DetectedPattern(
            tag=tag,
            classes=classes,
            selector=selector,
            count=count,
            score=final_score,
            sample_fields=fields,
        ))

    patterns.sort(key=lambda p: p.score, reverse=True)
    return patterns[:5]
