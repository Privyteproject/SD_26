"""Alertes / Worklist priorisée (monté sous /alertes).

- GET   /alertes/prioritized : alertes triées par criticité (high d'abord) puis date.
- PATCH /alertes/{id}/resolve : marque une alerte comme traitée.
Réservé RH / Direction / Admin.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_DIRECTION, ROLE_RH, ROLE_MANAGER, CurrentUser, require_roles
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

_RH = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER)


def _dept_for(u: CurrentUser, db: Session) -> int | None:
    if u.role in (ROLE_RH, ROLE_ADMIN, ROLE_DIRECTION):
        return None
    from sqlalchemy import select
    from app.db.models import Employe, Utilisateur
    emp = db.scalar(
        select(Employe)
        .join(Utilisateur, Utilisateur.id_utilisateur == Employe.id_utilisateur)
        .where(Utilisateur.keycloak_sub == u.sub)
    )
    return emp.id_departement if emp else None


@router.get("/prioritized")
def prioritized(
    include_resolved: bool = Query(False),
    user: CurrentUser = Depends(_RH), db: Session = Depends(get_db),
):
    from sqlalchemy import select
    dept = _dept_for(user, db)
    rows = repo.list_alertes_prioritized(db, include_resolved=include_resolved, department_id=dept)
    return envelope(rows, meta={"total": len(rows)})


@router.patch("/{id_alerte}/resolve")
def resolve(id_alerte: int, _: CurrentUser = Depends(_RH), db: Session = Depends(get_db)):
    if not repo.resolve_alerte(db, id_alerte):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Alerte introuvable")
    return envelope({"id": id_alerte, "resolue": True})
