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
    # Garde-fous de configuration sécurité (loi 09-08 / RGPD) — fail-fast AVANT toute init.
    _issues = settings.security_issues()
    _fatal = [m for sev, m in _issues if sev == "fatal" or (sev == "prod" and settings.IS_PRODUCTION)]
    for m in (m for sev, m in _issues if m not in _fatal):
        print(f"[SECURITY][WARN] {m}", flush=True)
    if _fatal:
        raise RuntimeError("Configuration sécurité non conforme :\n- " + "\n- ".join(_fatal))

    init_db()  # create_all + seed si vide
    # Charge les règles de supervision configurables (mots-clés sensibles supplémentaires).
    try:
        from app.db.base import SessionLocal
        from app.db import repository as _repo
        from app.services import classifier as _cls
        with SessionLocal() as _db:
            _cls.set_extra_sensible(_repo.get_parametre(_db, "mots_sensibles_extra", []))
    except Exception:
        pass
    # Préchargement du scanner anti-injection (hors chemin requête -> pas de timeout/502).
    try:
        from app.services import security_filter as _sf
        _sf.warmup_llmguard()
    except Exception:
        pass
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


@app.middleware("http")
async def _security_headers(request: Request, call_next):
    """En-têtes de sécurité HTTP (cahier §3.3 « Sécurité applicative ») : anti-clickjacking,
    anti-MIME-sniffing, politique de contenu stricte, réduction des fuites de référent.
    CSP permissive uniquement pour Swagger/Redoc (qui chargent leurs assets) ; stricte ailleurs."""
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    resp.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    path = request.url.path
    if path.startswith(("/docs", "/redoc", "/openapi")):
        resp.headers.setdefault("Content-Security-Policy", "default-src 'self' https: data: 'unsafe-inline'")
    else:  # API JSON : aucune ressource active autorisée.
        resp.headers.setdefault("Content-Security-Policy",
                                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
    if settings.IS_PRODUCTION:  # HSTS uniquement en production (HTTPS).
        resp.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
    return resp


app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "version": settings.VERSION}
