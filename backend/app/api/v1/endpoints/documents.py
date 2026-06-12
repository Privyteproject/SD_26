"""Endpoints Documents (montés sous /documents) — génération + validation.

- POST /documents          : « génère » un document (statut pending) à partir
  d'un modèle, pour un employé. (Génération de fichier + upload MinIO à brancher.)
- PATCH /documents/{id}/status : validation tracée (valideur + date).
Un collaborateur ne voit/génère que ses propres documents.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN,
    ROLE_DIRECTION,
    ROLE_RH,
    CurrentUser,
    get_current_user,
    require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope
from app.schemas.hr import DocumentCreate, DocumentStatusUpdate

router = APIRouter()

_VALIDATE = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION)
_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, "MANAGER"}


def _own_matricule(db, user):
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


@router.get("/modeles")
def list_modeles(_: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return envelope([m.to_dict() for m in repo.list_modele_document(db)])


@router.get("")
def list_documents(
    employee_id: str | None = Query(None),
    status_: str | None = Query(None, alias="status"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in _ELEVATED:
        employee_id = _own_matricule(db, user)
    rows = repo.list_documents(db, employee_id=employee_id, status=status_)
    return envelope([d.to_dict() for d in rows], meta={"total": len(rows)})


@router.post("", status_code=status.HTTP_201_CREATED)
def generate_document(
    payload: DocumentCreate, user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.code_modele and not repo.modele_document_exists(db, payload.code_modele):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Modèle de document inconnu")
    matricule = payload.employee_id
    if user.role not in _ELEVATED or not matricule:
        matricule = _own_matricule(db, user)
    if matricule is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Employé cible introuvable")
    if repo.get_employee(db, matricule) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Employé introuvable")
    doc = repo.create_document(db, matricule=matricule, code_modele=payload.code_modele,
                               nom_fichier=payload.nom_fichier)
    return envelope(doc.to_dict())


@router.get("/{document_id}")
def get_document(document_id: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = repo.get_document(db, document_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document introuvable")
    if user.role not in _ELEVATED and doc.matricule != _own_matricule(db, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès non autorisé")
    return envelope(doc.to_dict())


@router.patch("/{document_id}/status")
def validate_document(
    document_id: int, payload: DocumentStatusUpdate,
    user: CurrentUser = Depends(_VALIDATE), db: Session = Depends(get_db),
):
    emp = repo.find_employee_by_email(db, user.email)
    valideur_id = emp.id_utilisateur if emp else None
    doc = repo.set_document_status(db, document_id, payload.status, valideur_id=valideur_id)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document introuvable")
    return envelope(doc.to_dict())
