"""Endpoints Configuration (montés sous /config) — réservés à l'ADMIN.

Règles de supervision IA configurables (§4.3) : l'admin gère la liste des mots-clés
sensibles SUPPLÉMENTAIRES utilisés par le moteur de classification/supervision. Ces mots
s'ajoutent au socle de sécurité intégré (jamais en retrait).
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, CurrentUser, require_roles
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope
from app.services import classifier

router = APIRouter()

_ADMIN = require_roles(ROLE_ADMIN)


class RulesIn(BaseModel):
    mots_sensibles_extra: list[str] = []


@router.get("/rules")
def get_rules(_: CurrentUser = Depends(_ADMIN), db: Session = Depends(get_db)):
    """Règles de supervision : mots-clés sensibles (socle intégré + supplémentaires configurés)."""
    return envelope({
        "mots_sensibles_socle": classifier._TYPES.get("sensible", []),
        "mots_sensibles_extra": repo.get_parametre(db, "mots_sensibles_extra", []),
    })


@router.put("/rules")
def set_rules(payload: RulesIn, _: CurrentUser = Depends(_ADMIN), db: Session = Depends(get_db)):
    # Normalise : mots non vides, dédupliqués, minuscules.
    words = sorted({w.strip().lower() for w in payload.mots_sensibles_extra if w and w.strip()})
    repo.set_parametre(db, "mots_sensibles_extra", words)
    classifier.set_extra_sensible(words)   # application immédiate (sans redémarrage)
    return envelope({"mots_sensibles_extra": words})
