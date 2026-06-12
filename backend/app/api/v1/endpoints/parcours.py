"""Endpoints Parcours onboarding/offboarding (montés sous /parcours).

S'appuie sur modele_tache (gabarits) et tache_parcours (instances).
- modèles & initialisation & décision : rôles RH/ADMIN/MANAGER/DIRECTION ;
- consultation d'un parcours : l'employé concerné ou un rôle élevé.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN,
    ROLE_DIRECTION,
    ROLE_MANAGER,
    ROLE_RH,
    CurrentUser,
    get_current_user,
    require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope
from app.schemas.hr import ParcoursInit, TacheStatusUpdate

router = APIRouter()

_MANAGE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION}


@router.get("/modeles")
def list_modeles(
    type_parcours: str | None = Query(None, alias="type"),
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = repo.list_modele_taches(db, type_parcours)
    return envelope([m.to_dict() for m in rows], meta={"total": len(rows)})


@router.post("/{matricule}/init", status_code=status.HTTP_201_CREATED)
def init_parcours(
    matricule: str, payload: ParcoursInit,
    _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db),
):
    if repo.get_employee(db, matricule) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    taches = repo.init_parcours(db, matricule, payload.type_parcours)
    return envelope([t.to_dict() for t in taches], meta={"total": len(taches)})


@router.get("/{matricule}")
def get_parcours(
    matricule: str,
    type_parcours: str | None = Query(None, alias="type"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in _ELEVATED:
        emp = repo.find_employee_by_email(db, user.email)
        if not emp or emp.matricule != matricule:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    rows = repo.list_taches(db, matricule, type_parcours)
    return envelope([t.to_dict() for t in rows], meta={"total": len(rows)})


@router.patch("/taches/{id_tache}")
def update_tache(
    id_tache: int, payload: TacheStatusUpdate,
    _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db),
):
    t = repo.set_tache_status(db, id_tache, payload.status, payload.date_realisation)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tâche introuvable")
    return envelope(t.to_dict())
