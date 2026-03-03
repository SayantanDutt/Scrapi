import asyncio
from datetime import datetime, timezone
from io import BytesIO

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.core.exceptions import ScraperException
from app.core.security import get_current_user
from app.database.connection import get_scraping_history_collection
from app.models.scrape import HistoryResponse, ScrapeRequest, ScrapeResponse
from app.services.scraper.dynamic import fetch_html_with_selenium
from app.services.scraper.extract import extract_content
from app.services.scraper.fetch import fetch_html
from app.services.scraper.transform import to_execution_payload
from app.utils.performance import PerformanceMonitor
from app.utils.validators import validate_target_tag, validate_url

router = APIRouter(prefix="/scrape", tags=["Scraping"])


def _parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId as exc:
        raise HTTPException(status_code=422, detail="Invalid scrape id.") from exc


@router.post("", response_model=ScrapeResponse)
async def scrape_website(payload: ScrapeRequest, current_user: dict = Depends(get_current_user)):
    settings = get_settings()
    history_collection = get_scraping_history_collection()

    url = validate_url(payload.url)
    target_tag = validate_target_tag(payload.target_tag)

    monitor = PerformanceMonitor()
    monitor.start()

    fetch_result = await asyncio.to_thread(fetch_html, url)
    extraction = await asyncio.to_thread(
        extract_content, fetch_result.html, target_tag, payload.class_name
    )

    used_selenium = False
    selenium_error: str | None = None

    dynamic_detected = extraction["dynamic_content_detected"]
    should_try_selenium = dynamic_detected and (
        payload.use_selenium_fallback or settings.USE_SELENIUM_FALLBACK
    )

    if should_try_selenium:
        try:
            rendered_html = await asyncio.to_thread(
                fetch_html_with_selenium, fetch_result.final_url
            )
            extraction = await asyncio.to_thread(
                extract_content, rendered_html, target_tag, payload.class_name
            )
            dynamic_detected = extraction["dynamic_content_detected"]
            used_selenium = True
        except ScraperException as exc:
            selenium_error = exc.message
            if payload.use_selenium_fallback:
                # Explicit fallback requests should fail loudly with the real reason.
                raise

    execution_payload = await asyncio.to_thread(to_execution_payload, extraction["data"])
    metrics = monitor.stop(
        traversed_nodes=extraction["traversed_nodes"],
        extracted_nodes=extraction["extracted_nodes"],
    )

    created_at = datetime.now(timezone.utc)
    scrape_document = {
        "user_id": ObjectId(current_user["id"]),
        "url": fetch_result.final_url,
        "requested_url": url,
        "target_tag": target_tag,
        "class_name": payload.class_name,
        "created_at": created_at,
        "fetch_status_code": fetch_result.status_code,
        "content_type": fetch_result.content_type,
        "dynamic_content_detected": dynamic_detected,
        "used_selenium": used_selenium,
        "selenium_error": selenium_error,
        "metrics": metrics,
        "data": execution_payload["json"],
        "csv_data": execution_payload["csv"],
    }

    insert_result = await history_collection.insert_one(scrape_document)
    scrape_id = str(insert_result.inserted_id)

    return {
        "id": scrape_id,
        "url": fetch_result.final_url,
        "created_at": created_at.isoformat(),
        "dynamic_content_detected": dynamic_detected,
        "used_selenium": used_selenium,
        "data": execution_payload["json"],
        "metrics": metrics,
        "csv_download_url": f"{settings.API_V1_PREFIX}/scrape/history/{scrape_id}/csv",
    }


@router.get("/history", response_model=HistoryResponse)
async def scrape_history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    history_collection = get_scraping_history_collection()
    cursor = (
        history_collection
        .find({"user_id": ObjectId(current_user["id"])})
        .sort("created_at", -1)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        metrics = doc.get("metrics", {})
        items.append(
            {
                "id": str(doc["_id"]),
                "url": doc.get("url", ""),
                "created_at": doc["created_at"].isoformat(),
                "runtime_seconds": float(metrics.get("runtime_seconds", 0.0)),
                "memory_usage_mb": float(metrics.get("memory_usage_mb", 0.0)),
                "traversed_nodes": int(metrics.get("traversed_nodes", 0)),
                "extracted_nodes": int(metrics.get("extracted_nodes", 0)),
                "efficiency_ratio": float(metrics.get("efficiency_ratio", 0.0)),
                "dynamic_content_detected": bool(doc.get("dynamic_content_detected", False)),
                "used_selenium": bool(doc.get("used_selenium", False)),
            }
        )

    return {"items": items}


@router.get("/history/{scrape_id}/csv")
async def download_csv(scrape_id: str, current_user: dict = Depends(get_current_user)):
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

    filename = f"scrape_{scrape_id}.csv"
    return StreamingResponse(
        BytesIO(csv_data.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
