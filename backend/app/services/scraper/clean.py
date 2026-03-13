"""
Data cleaning and normalization for extracted records.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List


def _normalize_key(key: str) -> str:
    """Convert a header/field name to clean snake_case."""
    key = str(key).strip().lower()
    key = re.sub(r"[^\w\s]", "", key)
    key = re.sub(r"\s+", "_", key)
    key = re.sub(r"_+", "_", key)
    return key.strip("_") or "field"


def _normalize_value(value: Any) -> Any:
    """Strip control characters and collapse whitespace in string values."""
    if not isinstance(value, str):
        return value
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def normalize_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalize a list of extracted records:
    1. Normalize field names → snake_case
    2. Clean string values (whitespace, control chars)
    3. Remove empty fields
    4. Deduplicate identical records
    5. Drop columns present in <10% of records
    6. Fill missing values with empty string for consistent schema
    """
    if not records:
        return []

    # Step 1+2: Normalize keys and clean values
    normalized: List[Dict[str, Any]] = []
    for rec in records:
        new_rec: Dict[str, Any] = {}
        for k, v in rec.items():
            nk = _normalize_key(k)
            nv = _normalize_value(v)
            if nv is not None and nv != "":
                new_rec[nk] = nv
        if new_rec:
            normalized.append(new_rec)

    if not normalized:
        return []

    # Step 3: Deduplicate
    seen: set[tuple] = set()
    unique: List[Dict[str, Any]] = []
    for rec in normalized:
        fp = tuple(sorted((k, str(v)) for k, v in rec.items()))
        if fp not in seen:
            seen.add(fp)
            unique.append(rec)

    # Step 4: Count column frequency
    col_freq: dict[str, int] = {}
    for rec in unique:
        for k in rec:
            col_freq[k] = col_freq.get(k, 0) + 1

    # Keep columns present in >= 10% of records (minimum 1)
    min_presence = max(1, len(unique) * 0.10)
    valid_cols = [k for k, cnt in col_freq.items() if cnt >= min_presence]

    # Sort: most-frequent first, then alphabetical for stability
    valid_cols.sort(key=lambda k: (-col_freq[k], k))

    # Step 5: Build final records with consistent schema
    result: List[Dict[str, Any]] = []
    for rec in unique:
        filled = {col: rec.get(col, "") for col in valid_cols}
        if any(v for v in filled.values()):
            result.append(filled)

    return result


def get_columns(records: List[Dict[str, Any]]) -> List[str]:
    """Return column list derived from the first record."""
    return list(records[0].keys()) if records else []
