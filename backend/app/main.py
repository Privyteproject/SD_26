from fastapi import FastAPI

from app.api.routes_ai import router as ai_router
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)
app.include_router(ai_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"app": settings.APP_NAME, "status": "running"}
