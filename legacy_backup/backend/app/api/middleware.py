import time
import logging
from typing import Callable, Awaitable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logging import logger

class JSONLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        start_time = time.time()
        
        # Dummy user_id extraction (in reality, decode JWT here)
        user_id = request.headers.get("X-User-ID", "anonymous")
        
        # Process the request
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as exc:
            status_code = 500
            # Log the error separately
            logger.error(f"Internal server error: {exc}", exc_info=True, extra={"extra_info": {
                "endpoint": request.url.path,
                "method": request.method,
                "user_id": user_id
            }})
            raise exc
        finally:
            process_time = (time.time() - start_time) * 1000 # in ms
            
            import json
            # Create a structured log record
            log_data = {
                "endpoint": request.url.path,
                "method": request.method,
                "status": status_code,
                "latence_ms": round(process_time, 2),
                "user_id": user_id
            }
            
            # Print directly to stdout to bypass uvicorn logging overrides
            print(json.dumps(log_data), flush=True)
                
        return response
