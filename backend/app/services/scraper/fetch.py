import logging
import time
from dataclasses import dataclass

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from app.core.config import get_settings
from app.core.exceptions import ScraperException

logger = logging.getLogger(__name__)

_RETRY_DELAYS = (1, 3, 6)  # seconds between attempts


@dataclass
class FetchResult:
    html: str
    status_code: int
    final_url: str
    content_type: str


def fetch_html(url: str) -> FetchResult:
    settings = get_settings()
    headers = {
        "User-Agent": settings.USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "DNT": "1",
    }

    last_exc: Exception | None = None
    delays = (0,) + _RETRY_DELAYS

    for attempt, delay in enumerate(delays, start=1):
        if delay:
            logger.info("Retry %d/%d for %s — waiting %ds.", attempt, len(delays), url, delay)
            time.sleep(delay)

        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=settings.REQUEST_TIMEOUT_SECONDS,
                allow_redirects=True,
                verify=False,
            )
        except requests.exceptions.Timeout as exc:
            last_exc = exc
            logger.warning("Timeout on attempt %d for %s.", attempt, url)
            continue
        except requests.exceptions.ConnectionError as exc:
            last_exc = exc
            logger.warning("Connection error on attempt %d for %s: %s", attempt, url, exc)
            continue
        except requests.exceptions.RequestException as exc:
            raise ScraperException(f"Network error: {exc}", 502) from exc

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", delay * 2 or 5))
            logger.warning("Rate limited on attempt %d; waiting %ds.", attempt, retry_after)
            time.sleep(min(retry_after, 30))
            last_exc = None
            continue

        if response.status_code >= 400:
            raise ScraperException(
                f"Target returned HTTP {response.status_code}. "
                "Ensure the URL is publicly accessible.",
                400,
            )

        content_type = response.headers.get("content-type", "").lower()
        if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
            raise ScraperException(
                "URL did not return an HTML page. Provide a direct webpage URL.",
                422,
            )

        html = response.text or ""
        if not html.strip():
            raise ScraperException("Fetched page returned empty content.", 422)

        return FetchResult(
            html=html,
            status_code=response.status_code,
            final_url=str(response.url),
            content_type=content_type,
        )

    if last_exc is not None:
        raise ScraperException(
            "Request timed out after multiple retries. The site may be slow or unreachable.",
            504,
        ) from last_exc
    raise ScraperException(
        "Failed to fetch URL — too many rate-limit responses. Try again later.",
        429,
    )
