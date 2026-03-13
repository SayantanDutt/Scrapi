"""
transform.py — Convert scrape results to clean CSV and JSON export formats.
"""
from __future__ import annotations

import csv
import io
import json
from typing import Any, Dict, List


def records_to_csv(records: List[Dict[str, Any]], columns: List[str]) -> str:
    """Convert a list of record dicts to a UTF-8 CSV string."""
    if not records or not columns:
        return ""
    stream = io.StringIO()
    writer = csv.DictWriter(
        stream,
        fieldnames=columns,
        extrasaction="ignore",
        lineterminator="\n",
    )
    writer.writeheader()
    writer.writerows(records)
    return stream.getvalue()


def records_to_json_str(
    records: List[Dict[str, Any]],
    metadata: Dict[str, Any],
) -> str:
    """Convert records to a JSON string with a metadata envelope."""
    return json.dumps(
        {"metadata": metadata, "data": records},
        indent=2,
        ensure_ascii=False,
        default=str,
    )


def to_execution_payload(
    records: List[Dict[str, Any]],
    columns: List[str],
    metadata: Dict[str, Any],
) -> Dict[str, str]:
    """Generate both CSV and JSON export strings from normalized records."""
    return {
        "csv": records_to_csv(records, columns),
        "json": records_to_json_str(records, metadata),
    }
