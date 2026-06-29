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
from app.core import scope
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

# Feedback = accompagnement opérationnel (RH org + manager équipe). La Direction (décisionnel) en
# est exclue. Le manager est scopé à son équipe (is_in_scope) sur chaque accès nominatif.
_MANAGE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_MANAGER)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_MANAGER}


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
    if user.role == ROLE_MANAGER and not scope.is_in_scope(db, user, payload.employee_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre d'équipe")
    f = repo.create_feedback(db, matricule=payload.employee_id, note_1_5=payload.note_1_5,
                             categorie=payload.categorie, commentaire=payload.commentaire,
                             auteur=user.email, date_feedback=payload.date_feedback)
    return envelope(f.to_dict())


@router.get("")
def list_feedbacks(
    employee_id: str | None = Query(None),
    user: CurrentUser = Depends(_MANAGE), db: Session = Depends(get_db),
):
    if user.role == ROLE_MANAGER:
        # Manager : strictement son équipe (un employee_id hors équipe -> refus).
        if employee_id and not scope.is_in_scope(db, user, employee_id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre d'équipe")
        dept = scope.manager_dept_id(db, user)
        rows = repo.list_feedbacks(db, matricule=employee_id, department_id=dept) if (employee_id or dept is not None) else []
    else:
        rows = repo.list_feedbacks(db, matricule=employee_id)
    return envelope([f.to_dict() for f in rows], meta={"total": len(rows)})


@router.get("/{matricule}")
def feedbacks_of(matricule: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    # Le collaborateur consulte SES propres feedbacks ; le manager ceux de SON équipe ; RH/Admin tout.
    if user.role not in _ELEVATED:
        emp = repo.find_employee_by_email(db, user.email)
        if not emp or emp.matricule != matricule:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    elif user.role == ROLE_MANAGER and not scope.is_in_scope(db, user, matricule):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre d'équipe")
    rows = repo.list_feedbacks(db, matricule=matricule)
    return envelope([f.to_dict() for f in rows], meta={"total": len(rows)})
