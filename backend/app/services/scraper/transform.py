import csv
import io
import json


def to_csv(data: dict) -> str:
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["section", "index", "text", "extra"])

    for index, heading in enumerate(data.get("headings", []), start=1):
        writer.writerow(["headings", index, heading, ""])

    for index, paragraph in enumerate(data.get("paragraphs", []), start=1):
        writer.writerow(["paragraphs", index, paragraph, ""])

    for index, link in enumerate(data.get("links", []), start=1):
        writer.writerow(["links", index, link.get("text", ""), link.get("href", "")])

    for table_index, table in enumerate(data.get("tables", []), start=1):
        headers = " | ".join(table.get("headers", []))
        writer.writerow(["tables", table_index, "headers", headers])
        for row_index, row in enumerate(table.get("rows", []), start=1):
            writer.writerow(["tables", f"{table_index}.{row_index}", "row", " | ".join(row)])

    for index, node in enumerate(data.get("targeted", []), start=1):
        attrs = json.dumps(node.get("attributes", {}), ensure_ascii=True)
        writer.writerow(["targeted", index, node.get("text", ""), attrs])

    return stream.getvalue()


def to_execution_payload(data: dict) -> dict:
    return {"json": data, "csv": to_csv(data)}
