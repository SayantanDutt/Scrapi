from dataclasses import dataclass

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from app.core.config import get_settings
from app.core.exceptions import ScraperException


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
        "Connection": "keep-alive",
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=settings.REQUEST_TIMEOUT_SECONDS,
            allow_redirects=True,
            verify=False,
        )
    except requests.exceptions.Timeout as exc:
        raise ScraperException("Request timed out while fetching the URL.", 504) from exc
    except requests.exceptions.RequestException as exc:
        raise ScraperException(f"Network error during fetch: {exc}", 502) from exc

    if response.status_code >= 400:
        raise ScraperException(
            f"Failed to fetch URL. Upstream returned status code {response.status_code}.",
            400,
        )

    content_type = response.headers.get("content-type", "").lower()
    if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
        raise ScraperException(
            "URL did not return HTML content. Provide a webpage URL.",
            422,
        )

    html = response.text or ""
    if not html.strip():
        raise ScraperException("Fetched page is empty.", 422)

    return FetchResult(
        html=html,
        status_code=response.status_code,
        final_url=response.url,
        content_type=content_type,
    )
