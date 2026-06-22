"""Point d'entrée FastAPI.

- Crée les tables et sème les données de démo au démarrage (init_db).
- Monte le routeur agrégé sous /api/v1 (= BASE du front, lib/api.js).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.audit import register_audit_listeners, set_request_context
from app.db.base import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # create_all + seed si vide
    # Branché APRÈS le seed pour ne pas auditer les données de démo initiales.
    register_audit_listeners()
    from app.services import scheduler
    scheduler.start()  # jobs périodiques : onboarding en retard + scoring ML
    try:
        yield
    finally:
        scheduler.shutdown()


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _audit_context(request: Request, call_next):
    # Mémorise l'IP du client pour l'audit (l'utilisateur est posé par get_current_user).
    client = request.client
    set_request_context(ip=client.host if client else None)
    return await call_next(request)


app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "version": settings.VERSION}
