import time

from app.core.config import get_settings
from app.core.exceptions import ScraperException


def fetch_html_with_selenium(url: str) -> str:
    try:
        from selenium import webdriver
        from selenium.common.exceptions import TimeoutException, WebDriverException
        from selenium.webdriver.chrome.options import Options
    except ImportError as exc:
        raise ScraperException(
            "Selenium fallback requested, but selenium is not installed.",
            500,
        ) from exc

    settings = get_settings()
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1920,1080")

    driver = None
    try:
        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(settings.SELENIUM_PAGELOAD_TIMEOUT)
        driver.get(url)
        time.sleep(settings.SELENIUM_WAIT_SECONDS)
        html = driver.page_source or ""
    except TimeoutException as exc:
        raise ScraperException("Selenium timed out while rendering the target page.", 504) from exc
    except WebDriverException as exc:
        raise ScraperException(
            "Selenium fallback failed. Ensure Chrome and matching WebDriver are installed.",
            500,
        ) from exc
    finally:
        if driver is not None:
            driver.quit()

    if not html.strip():
        raise ScraperException("Selenium rendered an empty page.", 422)

    return html
