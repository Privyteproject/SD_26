"""Endpoints Actualités / Annonces (montés sous /annonces).

- Le RH (Direction/Admin) publie une annonce et choisit ses destinataires (sélection ou
  toute l'entreprise). Chaque destinataire la reçoit dans son fil d'actualités ET dans la
  cloche de notifications (catégorie « annonce »).
- Chaque collaborateur consulte SON fil et marque les annonces comme lues.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN, ROLE_DIRECTION, ROLE_RH,
    CurrentUser, get_current_user, require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

# Publication d'actualités = communication RH/Direction. L'admin (technique/sécurité) en est exclu.
_PUBLISH = require_roles(ROLE_RH, ROLE_DIRECTION)


def _own_matricule(db, user):
    emp = repo.find_employee_by_email(db, user.email)
    return emp.matricule if emp else None


class AnnonceIn(BaseModel):
    titre: str = Field(..., min_length=2, max_length=160)
    contenu: str = Field(..., min_length=1, max_length=5000)
    epingle: bool = False
    employee_ids: list[str] = []          # destinataires sélectionnés
    audience: str | None = None           # "all" = toute l'entreprise (ignore employee_ids)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_annonce(payload: AnnonceIn, user: CurrentUser = Depends(_PUBLISH), db: Session = Depends(get_db)):
    if payload.audience == "all":
        matricules = [e.matricule for e in repo.list_employees(db)]
    else:
        matricules = payload.employee_ids
    if not matricules:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Aucun destinataire sélectionné")
    auteur = user.name or user.email
    res = repo.create_annonce(db, titre=payload.titre.strip(), contenu=payload.contenu.strip(),
                              auteur=auteur, matricules=matricules, epingle=payload.epingle)
    return envelope(res)


@router.get("")
def list_authored(_: CurrentUser = Depends(_PUBLISH), db: Session = Depends(get_db)):
    """Annonces publiées (vue RH/gestion), avec compteur de lecture."""
    rows = repo.list_annonces_authored(db)
    return envelope([a.to_dict() for a in rows], meta={"total": len(rows)})


@router.get("/me")
def my_feed(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fil d'actualités du collaborateur connecté."""
    mat = _own_matricule(db, user)
    if mat is None:
        return envelope([], meta={"total": 0, "unread": 0})
    items = repo.list_annonces_for(db, mat)
    unread = sum(1 for i in items if not i["lu"])
    return envelope(items, meta={"total": len(items), "unread": unread})


@router.patch("/{id_annonce}/read")
def mark_read(id_annonce: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    mat = _own_matricule(db, user)
    if mat is None or not repo.mark_annonce_read(db, id_annonce=id_annonce, matricule=mat):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Annonce introuvable")
    return envelope({"id": id_annonce, "lu": True})
