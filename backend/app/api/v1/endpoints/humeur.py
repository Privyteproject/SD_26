"""Endpoints Humeur / Climat social (montés sous /humeur).

- Le collaborateur partage VOLONTAIREMENT son humeur de la semaine (1-3) + commentaire.
- Les rôles encadrants consultent un climat AGRÉGÉ et ANONYMISÉ (jamais nominatif),
  avec un seuil minimal de réponses par semaine (anti-réidentification — loi 09-08 / §4.1).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN, ROLE_DIRECTION, ROLE_MANAGER, ROLE_MEDECINE, ROLE_RH,
    CurrentUser, get_current_user, require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

_VIEW = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER, ROLE_MEDECINE)


class HumeurIn(BaseModel):
    niveau: int = Field(..., ge=1, le=3)   # 1 insatisfait / 2 neutre / 3 satisfait
    commentaire: str | None = None
    anonyme: bool = True                    # commentaire anonyme (défaut) ou nominatif (consentement explicite)


def _dept_for(user: CurrentUser, db: Session):
    """Un manager ne voit le climat que de son département ; les autres rôles voient tout."""
    if user.role == ROLE_MANAGER:
        emp = repo.find_employee_by_email(db, user.email)
        return emp.id_departement if emp else None
    return None


@router.post("", status_code=status.HTTP_201_CREATED)
def submit(payload: HumeurIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = repo.find_employee_by_email(db, user.email)
    if emp is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Profil collaborateur introuvable")
    h = repo.submit_humeur(db, matricule=emp.matricule, niveau=payload.niveau,
                           commentaire=payload.commentaire, anonyme=payload.anonyme)
    return envelope(h.to_dict())


@router.get("/me")
def my_mood(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = repo.find_employee_by_email(db, user.email)
    if emp is None:
        return envelope(None)
    h = repo.my_humeur(db, emp.matricule)
    return envelope(h.to_dict() if h else None)


@router.get("/stats")
def stats(weeks: int = Query(8, ge=1, le=26),
          user: CurrentUser = Depends(_VIEW), db: Session = Depends(get_db)):
    """Climat social agrégé/anonymisé (distribution + tendance), scopé au périmètre du rôle."""
    dept = _dept_for(user, db)
    return envelope(repo.humeur_aggregate(db, weeks=weeks, dept=dept))


@router.get("/comments")
def comments(semaine: str | None = Query(None),
             user: CurrentUser = Depends(_VIEW), db: Session = Depends(get_db)):
    """Retours qualitatifs ANONYMISÉS (par semaine, scopés au périmètre du rôle)."""
    dept = _dept_for(user, db)
    rows = repo.humeur_comments(db, dept=dept, semaine=semaine)
    return envelope(rows, meta={"total": len(rows)})
