import re
from bs4 import BeautifulSoup

MAX_ITEMS_PER_SECTION = 100
MAX_TABLES = 20
MAX_TABLE_ROWS = 60


def _clean_text(value: str) -> str:
    return " ".join(value.split())


def _extract_tables(soup: BeautifulSoup) -> list[dict]:
    tables_payload: list[dict] = []

    for table in soup.find_all("table")[:MAX_TABLES]:
        headers: list[str] = []
        rows: list[list[str]] = []

        for index, row in enumerate(table.find_all("tr")[:MAX_TABLE_ROWS]):
            cells = row.find_all(["th", "td"])
            cell_values = [_clean_text(cell.get_text(" ", strip=True)) for cell in cells]
            cell_values = [value for value in cell_values if value]
            if not cell_values:
                continue

            if index == 0 and row.find_all("th"):
                headers = cell_values
            else:
                rows.append(cell_values)

        tables_payload.append({"headers": headers, "rows": rows})

    return tables_payload


def _detect_dynamic_content(soup: BeautifulSoup, traversed_nodes: int) -> bool:
    scripts_count = len(soup.find_all("script"))
    text_length = len(soup.get_text(" ", strip=True))
    has_client_root = bool(
        soup.find(attrs={"id": re.compile(r"(app|root|__next)", re.IGNORECASE)})
    )

    script_density = scripts_count / traversed_nodes if traversed_nodes else 0
    return (scripts_count > 20 and text_length < 1200) or script_density > 0.2 or has_client_root


def extract_content(
    html: str,
    target_tag: str | None = None,
    class_name: str | None = None,
) -> dict:
    soup = BeautifulSoup(html, "lxml")

    traversed_nodes = sum(1 for node in soup.descendants if getattr(node, "name", None))

    heading_nodes = soup.find_all(re.compile("^h[1-6]$"))[:MAX_ITEMS_PER_SECTION]
    paragraph_nodes = soup.find_all("p")[:MAX_ITEMS_PER_SECTION]
    link_nodes = soup.find_all("a", href=True)[:MAX_ITEMS_PER_SECTION]
    table_nodes = soup.find_all("table")[:MAX_TABLES]

    headings = [_clean_text(node.get_text(" ", strip=True)) for node in heading_nodes]
    headings = [value for value in headings if value]

    paragraphs = [_clean_text(node.get_text(" ", strip=True)) for node in paragraph_nodes]
    paragraphs = [value for value in paragraphs if value]

    links = []
    for node in link_nodes:
        label = _clean_text(node.get_text(" ", strip=True))
        href = node.get("href", "")
        if href:
            links.append({"text": label or href, "href": href})

    tables = _extract_tables(soup)

    targeted = []
    targeted_nodes = []
    if target_tag:
        targeted_nodes = (
            soup.find_all(target_tag, class_=class_name)
            if class_name
            else soup.find_all(target_tag)
        )[:MAX_ITEMS_PER_SECTION]
        for node in targeted_nodes:
            attrs = {
                key: " ".join(value) if isinstance(value, list) else str(value)
                for key, value in node.attrs.items()
            }
            targeted.append(
                {
                    "text": _clean_text(node.get_text(" ", strip=True)),
                    "attributes": attrs,
                }
            )

    extracted_nodes = (
        len(heading_nodes)
        + len(paragraph_nodes)
        + len(link_nodes)
        + len(table_nodes)
        + len(targeted_nodes)
    )

    payload = {
        "headings": headings,
        "paragraphs": paragraphs,
        "links": links,
        "tables": tables,
        "targeted": targeted,
    }

    return {
        "data": payload,
        "traversed_nodes": traversed_nodes,
        "extracted_nodes": extracted_nodes,
        "dynamic_content_detected": _detect_dynamic_content(soup, traversed_nodes),
    }
