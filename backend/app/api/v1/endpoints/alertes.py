"""Alertes / Worklist priorisée (monté sous /alertes).

- GET   /alertes/prioritized : alertes triées par criticité (high d'abord) puis date.
- PATCH /alertes/{id}/resolve : marque une alerte comme traitée.
Réservé RH / Direction / Admin.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_DIRECTION, ROLE_RH, CurrentUser, require_roles
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

_RH = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION)


@router.get("/prioritized")
def prioritized(
    include_resolved: bool = Query(False),
    _: CurrentUser = Depends(_RH), db: Session = Depends(get_db),
):
    rows = repo.list_alertes_prioritized(db, include_resolved=include_resolved)
    return envelope(rows, meta={"total": len(rows)})


@router.patch("/{id_alerte}/resolve")
def resolve(id_alerte: int, _: CurrentUser = Depends(_RH), db: Session = Depends(get_db)):
    if not repo.resolve_alerte(db, id_alerte):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Alerte introuvable")
    return envelope({"id": id_alerte, "resolue": True})
