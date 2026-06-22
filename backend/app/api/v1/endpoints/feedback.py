"""Endpoints Feedbacks internes (montés sous /feedback).

Les managers/RH consignent un feedback continu sur un collaborateur (note 1-5 +
commentaire). Ces feedbacks alimentent un signal supplémentaire pour les modèles
de prédiction du désengagement (note moyenne récente, cf. ml_predictions).

- POST /feedback           : créer un feedback (MANAGER/RH/DIRECTION/ADMIN) ;
- GET  /feedback           : lister (filtrable par employé) — rôles élevés ;
- GET  /feedback/{matricule}: feedbacks d'un collaborateur.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
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

router = APIRouter()

_MANAGE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_MANAGER, ROLE_DIRECTION}


class FeedbackCreate(BaseModel):
    employee_id: str = Field(..., min_length=1)
    note_1_5: int | None = Field(None, ge=1, le=5)
    categorie: str | None = Field(None, max_length=40)
    commentaire: str | None = None
    date_feedback: date | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
def create_feedback(payload: FeedbackCreate, user: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db)):
    if repo.get_employee(db, payload.employee_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    f = repo.create_feedback(db, matricule=payload.employee_id, note_1_5=payload.note_1_5,
                             categorie=payload.categorie, commentaire=payload.commentaire,
                             auteur=user.email, date_feedback=payload.date_feedback)
    return envelope(f.to_dict())


@router.get("")
def list_feedbacks(
    employee_id: str | None = Query(None),
    _: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db),
):
    rows = repo.list_feedbacks(db, matricule=employee_id)
    return envelope([f.to_dict() for f in rows], meta={"total": len(rows)})


@router.get("/{matricule}")
def feedbacks_of(matricule: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    # Le collaborateur peut consulter ses propres feedbacks ; sinon rôle élevé requis.
    if user.role not in _ELEVATED:
        emp = repo.find_employee_by_email(db, user.email)
        if not emp or emp.matricule != matricule:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    rows = repo.list_feedbacks(db, matricule=matricule)
    return envelope([f.to_dict() for f in rows], meta={"total": len(rows)})
