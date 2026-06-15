"""Endpoints Demandes génériques (montés sous /demandes).

Couvre TOUS les types de demande (congé, attestation, télétravail…), là où
/absences ne traite que les types d'absence. Même logique RBAC :
- un collaborateur ne voit/dépose que ses propres demandes ;
- les rôles élevés voient tout et décident (statut + commentaire + décideur).
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
from app.schemas.hr import DemandeCreate, DemandeStatusUpdate

router = APIRouter()

_ACT = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION}


def _own_matricule(db: Session, user: CurrentUser):
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


@router.get("/types")
def list_types(_: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Référentiel des types de demande (pour alimenter un menu déroulant)."""
    return envelope([{"code": t.code_type, "libelle": t.libelle} for t in repo.list_type_demande(db)])


@router.get("")
def list_demandes(
    employee_id: str | None = Query(None),
    code_type: str | None = Query(None, alias="type"),
    status_: str | None = Query(None, alias="status"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in _ELEVATED:
        employee_id = _own_matricule(db, user)
    rows = repo.list_demandes(db, employee_id=employee_id, code_type=code_type, status=status_)
    return envelope([d.to_dict() for d in rows], meta={"total": len(rows)})


@router.post("", status_code=status.HTTP_201_CREATED)
def create_demande(
    payload: DemandeCreate, user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not repo.type_exists(db, payload.code_type):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Type de demande inconnu")
    if payload.date_debut and payload.date_fin and payload.date_fin < payload.date_debut:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Dates incohérentes")

    matricule = payload.employee_id
    if user.role not in _ELEVATED or not matricule:
        matricule = _own_matricule(db, user)
    if matricule is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Employé cible introuvable")

    d = repo.create_demande(db, matricule=matricule, code_type=payload.code_type,
                            date_debut=payload.date_debut, date_fin=payload.date_fin,
                            detail=payload.detail)
    return envelope(d.to_dict())


@router.get("/{demande_id}")
def get_demande(demande_id: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    d = repo.get_demande(db, demande_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Demande introuvable")
    if user.role not in _ELEVATED and d.matricule != _own_matricule(db, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    return envelope(d.to_dict())


@router.patch("/{demande_id}/status")
def decide_demande(
    demande_id: int, payload: DemandeStatusUpdate,
    user: CurrentUser = Depends(_ACT), db: Session = Depends(get_db),
):
    emp = repo.find_employee_by_email(db, user.email)
    decideur_id = emp.id_utilisateur if emp else None
    d = repo.set_demande_status(db, demande_id, payload.status,
                                commentaire=payload.commentaire, decideur_id=decideur_id)
    if d is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Demande introuvable")
    return envelope(d.to_dict())
