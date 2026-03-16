import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.rate_limiter import RateLimitMiddleware
from app.database.connection import (
    close_mongo_connection,
    connect_to_mongo,
    get_last_mongo_error,
    verify_mongo_connection,
)
from app.routers import auth, health, scrape

logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "https://scrapi-two.vercel.app",
    "http://172.16.0.2:3000",
    "http://192.168.189.1:3000",
    "http://192.168.137.206:3000",
    *settings.CORS_ORIGINS
   
]
origins = [
    "https://scrapi-two.vercel.app",
]

app.add_middleware(
    RateLimitMiddleware,
    max_requests=settings.RATE_LIMIT_REQUESTS,
    window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




@app.on_event("startup")
async def on_startup() -> None:
    connected = await connect_to_mongo()
    if connected and await verify_mongo_connection():
        logger.info(
            "MongoDB connectivity verified at %s (db: %s).",
            settings.MONGO_URI,
            settings.MONGO_DB_NAME,
        )
        return

    error_detail = get_last_mongo_error() or "No additional error details available."
    logger.error(
        "MongoDB connectivity check failed at startup for %s (db: %s). "
        "API running in degraded mode. Error: %s",
        settings.MONGO_URI,
        settings.MONGO_DB_NAME,
        error_detail,
    )


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_mongo_connection()


register_exception_handlers(app)

app.include_router(health.router)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(scrape.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    return {
        "message": "Scrapi — Web Scraping API is running.",
        "docs": "/docs",
        "version": "2.0.0",
    }
