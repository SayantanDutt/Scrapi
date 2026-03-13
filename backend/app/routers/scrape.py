import json
from datetime import datetime, timezone
from io import BytesIO
from urllib.parse import urlparse

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.core.security import get_current_user
from app.database.connection import get_scraping_history_collection
from app.models.scrape import HistoryResponse, ScrapeRequest, ScrapeResponse
from app.services.scraper.pipeline import run_pipeline
from app.services.scraper.transform import to_execution_payload
from app.utils.performance import PerformanceMonitor
from app.utils.validators import validate_url

router = APIRouter(prefix="/scrape", tags=["Scraping"])


def _parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId as exc:
        raise HTTPException(status_code=422, detail="Invalid scrape id.") from exc


@router.post("", response_model=ScrapeResponse)
async def scrape_website(
    payload: ScrapeRequest,
    current_user: dict = Depends(get_current_user),
):
    settings = get_settings()
    history_collection = get_scraping_history_collection()

    url = validate_url(payload.url)

    monitor = PerformanceMonitor()
    monitor.start()

    result = await run_pipeline(url, use_selenium_fallback=payload.use_selenium_fallback)

    metadata = {
        "url": result.final_url,
        "detection_method": result.detection_method,
        "detected_pattern": result.detected_pattern,
        "record_count": result.record_count,
    }
    execution_payload = to_execution_payload(result.records, result.columns, metadata)

    metrics = monitor.stop(
        traversed_nodes=result.traversed_nodes,
        extracted_nodes=result.record_count,
    )

    created_at = datetime.now(timezone.utc)
    scrape_document = {
        "user_id": ObjectId(current_user["id"]),
        "url": result.final_url,
        "requested_url": url,
        "created_at": created_at,
        "fetch_status_code": result.status_code,
        "dynamic_content_detected": result.dynamic_content_detected,
        "used_selenium": result.used_selenium,
        "detection_method": result.detection_method,
        "detected_pattern": result.detected_pattern,
        "record_count": result.record_count,
        "metrics": metrics,
        "columns": result.columns,
        "records": result.records,
        "csv_data": execution_payload["csv"],
        "json_data": execution_payload["json"],
        # Classic fields stored for reference
        "headings": result.headings,
        "paragraphs": result.paragraphs,
        "links": result.links,
        "tables": result.tables,
    }

    insert_result = await history_collection.insert_one(scrape_document)
    scrape_id = str(insert_result.inserted_id)

    return {
        "id": scrape_id,
        "url": result.final_url,
        "final_url": result.final_url,
        "created_at": created_at.isoformat(),
        "records": result.records,
        "columns": result.columns,
        "record_count": result.record_count,
        "detection_method": result.detection_method,
        "detected_pattern": result.detected_pattern,
        "headings": result.headings,
        "paragraphs": result.paragraphs,
        "links": result.links,
        "tables": result.tables,
        "dynamic_content_detected": result.dynamic_content_detected,
        "used_selenium": result.used_selenium,
        "metrics": metrics,
        "csv_download_url": f"{settings.API_V1_PREFIX}/scrape/history/{scrape_id}/csv",
        "json_download_url": f"{settings.API_V1_PREFIX}/scrape/history/{scrape_id}/json",
    }


@router.get("/history", response_model=HistoryResponse)
async def scrape_history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    settings = get_settings()
    history_collection = get_scraping_history_collection()
    cursor = (
        history_collection
        .find({"user_id": ObjectId(current_user["id"])})
        .sort("created_at", -1)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        m = doc.get("metrics", {})
        scrape_id = str(doc["_id"])
        items.append({
            "id": scrape_id,
            "url": doc.get("url", ""),
            "created_at": doc["created_at"].isoformat(),
            "dynamic_content_detected": bool(doc.get("dynamic_content_detected", False)),
            "used_selenium": bool(doc.get("used_selenium", False)),
            "record_count": int(doc.get("record_count", 0)),
            "detection_method": doc.get("detection_method", "classic"),
            "detected_pattern": doc.get("detected_pattern", ""),
            "metrics": {
                "runtime_seconds": float(m.get("runtime_seconds", 0.0)),
                "memory_usage_mb": float(m.get("memory_usage_mb", 0.0)),
                "traversed_nodes": int(m.get("traversed_nodes", 0)),
                "extracted_nodes": int(m.get("extracted_nodes", 0)),
                "efficiency_ratio": float(m.get("efficiency_ratio", 0.0)),
                "complexity_note": str(m.get("complexity_note", "")),
            },
            "csv_download_url": f"{settings.API_V1_PREFIX}/scrape/history/{scrape_id}/csv",
            "json_download_url": f"{settings.API_V1_PREFIX}/scrape/history/{scrape_id}/json",
        })

    return {"items": items}


@router.get("/history/{scrape_id}/csv")
async def download_csv(
    scrape_id: str,
    current_user: dict = Depends(get_current_user),
):
    history_collection = get_scraping_history_collection()
    object_id = _parse_object_id(scrape_id)

    doc = await history_collection.find_one(
        {"_id": object_id, "user_id": ObjectId(current_user["id"])}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Scrape result not found.")

    csv_data = doc.get("csv_data", "")
    if not csv_data:
        raise HTTPException(status_code=404, detail="CSV data not available for this scrape.")

    domain = urlparse(doc.get("url", "")).netloc.replace(".", "_") or "scrape"
    filename = f"scrapi_{domain}_{scrape_id[:8]}.csv"

    return StreamingResponse(
        BytesIO(csv_data.encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/history/{scrape_id}/json")
async def download_json(
    scrape_id: str,
    current_user: dict = Depends(get_current_user),
):
    history_collection = get_scraping_history_collection()
    object_id = _parse_object_id(scrape_id)

    doc = await history_collection.find_one(
        {"_id": object_id, "user_id": ObjectId(current_user["id"])}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Scrape result not found.")

    json_data = doc.get("json_data") or doc.get("data")
    if json_data is None:
        raise HTTPException(status_code=404, detail="JSON data not available for this scrape.")

    domain = urlparse(doc.get("url", "")).netloc.replace(".", "_") or "scrape"
    filename = f"scrapi_{domain}_{scrape_id[:8]}.json"

    if isinstance(json_data, str):
        output = json_data.encode("utf-8")
    else:
        output = json.dumps(json_data, ensure_ascii=False, indent=2).encode("utf-8")

    return StreamingResponse(
        BytesIO(output),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
