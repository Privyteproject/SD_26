"""Endpoint Journal d'audit (monté sous /audit).

- GET /audit : liste des mutations tracées automatiquement (INSERT/UPDATE/DELETE).
  Réservé ADMIN. Les écritures sont produites par les écouteurs SQLAlchemy
  (cf. app/db/audit.py) — aucun appel explicite côté endpoints métier.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, CurrentUser, require_roles
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

_AUDIT = require_roles(ROLE_ADMIN)


@router.get("")
def list_audit(
    limit: int = Query(200, ge=1, le=1000),
    action: str | None = Query(None),
    entite: str | None = Query(None),
    _: CurrentUser = Depends(_AUDIT),
    db: Session = Depends(get_db),
):
    rows = repo.list_audit(db, limit=limit, action=action, type_entite=entite)
    return envelope(rows, meta={"total": len(rows)})
