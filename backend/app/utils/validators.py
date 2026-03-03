from urllib.parse import urlparse

from app.core.config import get_settings
from app.core.exceptions import ScraperException


def validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ScraperException("URL must include a valid http/https scheme and hostname.", 422)
    return url


def validate_target_tag(tag: str | None) -> str | None:
    if not tag:
        return None

    settings = get_settings()
    normalized = tag.strip().lower()
    if normalized not in settings.ALLOWED_TARGET_TAGS:
        raise ScraperException(
            f"Unsupported target tag '{normalized}'. Allowed tags: {', '.join(settings.ALLOWED_TARGET_TAGS)}",
            422,
        )
    return normalized
