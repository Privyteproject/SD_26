"""Endpoints Absences (montés sous /absences) — backés par `demande`.

Un collaborateur ne voit/crée que ses propres absences ; les rôles élevés
voient tout et décident des statuts (date_decision + décideur tracés).
"""

from datetime import date

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
from app.schemas.hr import AbsenceCreate, AbsenceStatusUpdate

router = APIRouter()

_ACT = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION}


def _own_matricule(db: Session, user: CurrentUser) -> str | None:
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


@router.get("")
def list_absences(
    employee_id: str | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in _ELEVATED:
        employee_id = _own_matricule(db, user)
    rows = repo.list_absences(db, employee_id=employee_id, status=status_,
                              date_from=date_from, date_to=date_to)
    return envelope([a.to_dict() for a in rows], meta={"total": len(rows)})


@router.post("", status_code=status.HTTP_201_CREATED)
def create_absence(
    payload: AbsenceCreate, user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.end_date < payload.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Dates incohérentes")

    matricule = payload.employee_id
    if user.role not in _ELEVATED or not matricule:
        matricule = _own_matricule(db, user)
    if matricule is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Employé cible introuvable")

    ab = repo.create_absence(
        db, matricule=matricule, type_value=payload.type,
        start_date=payload.start_date, end_date=payload.end_date, reason=payload.reason,
    )
    return envelope(ab.to_dict())


@router.get("/stats")
def absence_stats(_: CurrentUser = Depends(_ACT), db: Session = Depends(get_db)):
    return envelope(repo.absence_stats(db))


@router.patch("/{absence_id}/status")
def update_absence_status(
    absence_id: int, payload: AbsenceStatusUpdate,
    user: CurrentUser = Depends(_ACT), db: Session = Depends(get_db),
):
    emp = repo.find_employee_by_email(db, user.email)
    decideur_id = emp.id_utilisateur if emp else None
    ab = repo.set_absence_status(db, absence_id, payload.status, decideur_id=decideur_id)
    if ab is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Absence introuvable")
    return envelope(ab.to_dict())
