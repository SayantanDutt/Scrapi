import asyncio
import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int, window_seconds: int):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.bucket: dict[str, deque[float]] = defaultdict(deque)
        self.lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next):
        # Always let CORS preflight requests through so CORS headers are added
        if request.method == "OPTIONS":
            return await call_next(request)

        if request.url.path in {"/docs", "/redoc", "/openapi.json"}:
            return await call_next(request)

        now = time.time()
        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{request.url.path}"

        async with self.lock:
            timestamps = self.bucket[key]
            while timestamps and now - timestamps[0] > self.window_seconds:
                timestamps.popleft()

            if len(timestamps) >= self.max_requests:
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": (
                            "Rate limit exceeded. Please wait before making more requests."
                        )
                    },
                )

            timestamps.append(now)

        return await call_next(request)
