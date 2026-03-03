from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError


class DatabaseUnavailableError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class ScraperException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DatabaseUnavailableError)
    async def database_unavailable_handler(_, exc: DatabaseUnavailableError):
        return JSONResponse(status_code=503, content={"detail": exc.message})

    @app.exception_handler(PyMongoError)
    async def mongo_exception_handler(_, exc: PyMongoError):
        if isinstance(exc, ServerSelectionTimeoutError):
            detail = "Database connection is unavailable. Please try again shortly."
        else:
            detail = "A database error occurred. Please try again later."
        return JSONResponse(status_code=503, content={"detail": detail})

    @app.exception_handler(ScraperException)
    async def scraper_exception_handler(_, exc: ScraperException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": "Validation error", "errors": exc.errors()},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_, __: Exception):
        return JSONResponse(
            status_code=500,
            content={"detail": "Unexpected server error. Please try again."},
        )
