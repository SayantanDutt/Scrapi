from datetime import datetime


def _to_iso_if_datetime(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "created_at": _to_iso_if_datetime(user.get("created_at")),
    }


def serialize_scrape(scrape: dict) -> dict:
    serialized = dict(scrape)
    serialized["id"] = str(serialized.pop("_id"))
    if "user_id" in serialized:
        serialized["user_id"] = str(serialized["user_id"])
    if "created_at" in serialized:
        serialized["created_at"] = _to_iso_if_datetime(serialized["created_at"])
    return serialized
