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


def _seed_demo_dataset() -> None:
    """Jeu de démo DÉTERMINISTE complet — IDENTIQUE sur toutes les machines (graine fixe).

    Génère 120 employés + historiques + compétences (advanced_seed), puis entraîne les modèles
    ML et calcule les scores de risque, afin que les tableaux de bord (y compris désengagement)
    soient peuplés à l'identique pour toute l'équipe. Appelé UNIQUEMENT sur une base vide.
    """
    from app.db.advanced_seed import run as seed_demo
    seed_demo()
    # ML : entraînement + scoring (peuple les écrans de risque). Dégradation propre si indispo.
    try:
        from app.services import ml_predictions
        with SessionLocal() as db:
            ml_predictions.train(db)
            ml_predictions.batch_score(db)
        print("[SEED] Jeu de démo déterministe + ML prêts.", flush=True)
    except Exception as e:  # sklearn absent / autre — les données restent semées
        print(f"[SEED] Données semées, ML non entraîné au démarrage ({e}). "
              f"Lancer /predict/train depuis l'espace admin si besoin.", flush=True)


def init_db() -> None:
    """Crée les tables et, sur une base VIDE, sème le jeu choisi (SEED_MODE).
    Ne sème JAMAIS une base déjà peuplée (aucun écrasement de données au démarrage)."""
    from app.db import models  # noqa: F401  (enregistre les modèles sur Base)
    from sqlalchemy import select

    Base.metadata.create_all(bind=engine)
    _run_migrations()

    if not settings.DB_SEED:
        return

    with SessionLocal() as db:
        already_populated = db.scalar(select(models.Employe.matricule).limit(1)) is not None
    if already_populated:
        return  # base existante -> on n'y touche pas (préserve les données de chacun)

    mode = settings.SEED_MODE
    if mode == "demo":
        _seed_demo_dataset()
    elif mode == "minimal":
        from app.db.seed import seed_if_empty
        with SessionLocal() as db:
            seed_if_empty(db)
    # mode == "none" -> aucun ensemencement
