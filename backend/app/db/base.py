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


def _run_migrations() -> None:
    """Migrations légères idempotentes (create_all n'ajoute pas de colonne à une table existante).
    Ajoute les colonnes neuves sur les tables déjà créées (ex. ticket_statut sur demande)."""
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE demande ADD COLUMN IF NOT EXISTS ticket_statut VARCHAR(20)",
        "ALTER TABLE metier ADD COLUMN IF NOT EXISTS id_departement INTEGER",
        "ALTER TABLE competence ADD COLUMN IF NOT EXISTS proposee BOOLEAN DEFAULT FALSE",
        "ALTER TABLE humeur ADD COLUMN IF NOT EXISTS anonyme BOOLEAN DEFAULT TRUE",
        "ALTER TABLE objectif ADD COLUMN IF NOT EXISTS groupe_id VARCHAR(40)",
        "ALTER TABLE employe ADD COLUMN IF NOT EXISTS telephone VARCHAR(40)",
        "ALTER TABLE employe ADD COLUMN IF NOT EXISTS bio TEXT",
        "ALTER TABLE employe ADD COLUMN IF NOT EXISTS photo TEXT",
        "ALTER TABLE alerte ADD COLUMN IF NOT EXISTS plan_action TEXT",
        "ALTER TABLE alerte ADD COLUMN IF NOT EXISTS note_resolution TEXT",
        "ALTER TABLE alerte ADD COLUMN IF NOT EXISTS resolu_par VARCHAR(160)",
        "ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS securite_habilite BOOLEAN DEFAULT FALSE",
    ]
    with engine.begin() as conn:
        for s in stmts:
            try:
                conn.execute(text(s))
            except Exception:
                pass  # SQLite / colonne déjà présente : sans gravité


def init_db() -> None:
    """Crée les tables (et sème les données de démo si demandé)."""
    from app.db import models  # noqa: F401  (enregistre les modèles sur Base)

    Base.metadata.create_all(bind=engine)
    _run_migrations()

    if settings.DB_SEED:
        from app.db.seed import seed_if_empty

        with SessionLocal() as db:
            seed_if_empty(db)
