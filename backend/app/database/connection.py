import logging
from dataclasses import dataclass
from typing import Final

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from app.core.config import get_settings
from app.core.exceptions import DatabaseUnavailableError

logger = logging.getLogger(__name__)

USERS_COLLECTION: Final[str] = "users"
SCRAPING_HISTORY_COLLECTION: Final[str] = "scraping_history"


@dataclass
class MongoState:
    client: AsyncIOMotorClient | None = None
    database: AsyncIOMotorDatabase | None = None
    last_error: str | None = None


mongo_state = MongoState()


async def _ensure_indexes(database: AsyncIOMotorDatabase) -> None:
    await database[USERS_COLLECTION].create_index("email", unique=True)
    await database[SCRAPING_HISTORY_COLLECTION].create_index(
        [("user_id", 1), ("created_at", -1)]
    )


async def connect_to_mongo() -> bool:
    settings = get_settings()

    if mongo_state.client is not None:
        mongo_state.client.close()

    client = AsyncIOMotorClient(
        settings.MONGO_URI,
        serverSelectionTimeoutMS=settings.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    )
    database = client[settings.MONGO_DB_NAME]

    try:
        await database.command("ping")
        await _ensure_indexes(database)
    except PyMongoError as exc:
        client.close()
        mongo_state.client = None
        mongo_state.database = None
        mongo_state.last_error = str(exc)
        logger.error("MongoDB connection verification failed: %s", exc)
        return False

    mongo_state.client = client
    mongo_state.database = database
    mongo_state.last_error = None
    return True


async def verify_mongo_connection() -> bool:
    if mongo_state.database is None:
        return False

    try:
        await mongo_state.database.command("ping")
    except PyMongoError as exc:
        mongo_state.last_error = str(exc)
        return False

    mongo_state.last_error = None
    return True


def get_last_mongo_error() -> str | None:
    return mongo_state.last_error


def get_db() -> AsyncIOMotorDatabase:
    if mongo_state.database is None:
        detail = "Database is unavailable. Ensure MongoDB is running at mongodb://localhost:27017."
        raise DatabaseUnavailableError(detail)
    return mongo_state.database


def get_users_collection() -> AsyncIOMotorCollection:
    return get_db()[USERS_COLLECTION]


def get_scraping_history_collection() -> AsyncIOMotorCollection:
    return get_db()[SCRAPING_HISTORY_COLLECTION]


async def close_mongo_connection() -> None:
    if mongo_state.client is not None:
        mongo_state.client.close()
    mongo_state.client = None
    mongo_state.database = None
    mongo_state.last_error = None
