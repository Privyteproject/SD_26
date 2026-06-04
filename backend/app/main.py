from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.api.routes_ai import router as ai_router

app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Should be restricted in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(ai_router)

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "environment": "development" if settings.DEBUG else "production"
    }

@app.get("/")
def root() -> dict[str, str]:
    return {"app": settings.APP_NAME, "status": "running"}
