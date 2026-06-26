"""Endpoints Tickets d'assistance (montés sous /tickets).

Les tickets sont créés par l'assistant IA (cf. pipeline) et stockés dans la table Demande
(code_type=TICKET_ASSISTANCE). Un collaborateur voit ses tickets ; les rôles encadrants
consultent et font évoluer le statut (Nouveau → En cours → Résolu), scopés à leur périmètre.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN, ROLE_DIRECTION, ROLE_MANAGER, ROLE_RH,
    CurrentUser, get_current_user, require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

_MANAGE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER}


def _own(db, user):
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


def _dept(user, db):
    if user.role == ROLE_MANAGER:
        emp = repo.find_employee_by_email(db, user.email)
        return emp.id_departement if emp else None
    return None


class StatutIn(BaseModel):
    statut: str = Field(...)  # Nouveau / En cours / Résolu


@router.get("")
def list_tickets(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role in _ELEVATED:
        rows = repo.list_tickets(db, dept=_dept(user, db))
    else:
        rows = repo.list_tickets(db, matricule=_own(db, user))
    return envelope([t.to_dict() for t in rows], meta={"total": len(rows)})


@router.patch("/{id_ticket}/status")
def set_status(id_ticket: int, payload: StatutIn, _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    t = repo.set_ticket_statut(db, id_ticket, payload.statut)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ticket introuvable ou statut invalide")
    return envelope(t.to_dict())
