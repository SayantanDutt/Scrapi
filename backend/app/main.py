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

# ✅ CORS first, before everything else
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://scrapi-two.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    RateLimitMiddleware,
    max_requests=settings.RATE_LIMIT_REQUESTS,
    window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
)

# ✅ Routers registered ONCE only
app.include_router(auth.router, prefix="/api/v1")
app.include_router(scrape.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")

@app.on_event("startup")
async def on_startup() -> None:
    connected = await connect_to_mongo()
    if connected and await verify_mongo_connection():
        logger.info("MongoDB connectivity verified.")
        return
    error_detail = get_last_mongo_error() or "No additional error details available."
    logger.error("MongoDB connectivity check failed: %s", error_detail)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_mongo_connection()


register_exception_handlers(app)


@app.get("/")
async def root():
    return {
        "message": "Scrapi — Web Scraping API is running.",
        "docs": "/docs",
        "version": "2.0.0",
    }