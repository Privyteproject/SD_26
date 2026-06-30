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

# Traitement des tickets = support opérationnel (RH org + manager équipe), pas la Direction.
_MANAGE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_MANAGER)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_MANAGER}


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


class TicketIn(BaseModel):
    """Ouverture d'un ticket par le collaborateur (en plus de la voie assistant IA)."""
    sujet: str = Field(..., min_length=2, max_length=160)
    description: str | None = Field(None, max_length=4000)


@router.get("")
def list_tickets(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role in _ELEVATED:
        rows = repo.list_tickets(db, dept=_dept(user, db))
    else:
        rows = repo.list_tickets(db, matricule=_own(db, user))
    return envelope([t.to_dict() for t in rows], meta={"total": len(rows)})


@router.post("", status_code=status.HTTP_201_CREATED)
def open_ticket(payload: TicketIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Le collaborateur ouvre lui-même un ticket d'assistance, rattaché à SON matricule."""
    mat = _own(db, user)
    if not mat:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Profil collaborateur introuvable")
    t = repo.create_ticket(db, matricule=mat, sujet=payload.sujet, description=payload.description or "")
    return envelope(t.to_dict())


@router.patch("/{id_ticket}/status")
def set_status(id_ticket: int, payload: StatutIn, user: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    from app.core import scope
    # Un manager ne fait évoluer que les tickets de SON équipe (anti-IDOR, §3.3).
    target = repo.get_demande(db, id_ticket)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ticket introuvable")
    if user.role == ROLE_MANAGER and not scope.is_in_scope(db, user, target.matricule):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre d'équipe")
    t = repo.set_ticket_statut(db, id_ticket, payload.statut)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ticket introuvable ou statut invalide")
    return envelope(t.to_dict())
