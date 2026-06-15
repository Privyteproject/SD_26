"""Connexion SQLAlchemy : engine, session, Base et dépendance get_db."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings

# SQLite a besoin de check_same_thread=False pour FastAPI (multi-thread).
_connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dépendance FastAPI : ouvre une session par requête, la ferme à la fin."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Crée les tables (et sème les données de démo si demandé)."""
    from app.db import models  # noqa: F401  (enregistre les modèles sur Base)

    Base.metadata.create_all(bind=engine)

    if settings.DB_SEED:
        from app.db.seed import seed_if_empty

        with SessionLocal() as db:
            seed_if_empty(db)
