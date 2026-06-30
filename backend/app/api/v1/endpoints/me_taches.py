"""Tâches personnelles de l'utilisateur connecté (bloc « Agenda & mes tâches » du cockpit)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()


class TacheIn(BaseModel):
    titre: str = Field(..., min_length=1, max_length=200)
    date_echeance: date | None = None
    priorite: str | None = Field(default="normale")


class TachePatch(BaseModel):
    titre: str | None = Field(default=None, max_length=200)
    date_echeance: date | None = None
    priorite: str | None = None
    fait: bool | None = None


def _seed_examples(db, email):
    """Pré-remplit quelques tâches d'exemple (orientées manager) au premier accès."""
    from datetime import timedelta
    t0 = date.today()
    examples = [
        ("Valider les demandes de congés en attente", t0, "haute"),
        ("Préparer les entretiens annuels de l'équipe", t0 + timedelta(days=7), "normale"),
        ("Revue des compétences à valider", t0 + timedelta(days=3), "normale"),
        ("Planifier un point 1:1 avec un collaborateur à risque", t0 + timedelta(days=2), "haute"),
        ("Suivre les plans d'action désengagement", None, "basse"),
    ]
    for titre, ech, prio in examples:
        repo.create_tache_perso(db, user_email=email, titre=titre, date_echeance=ech, priorite=prio)


@router.get("/taches")
def my_taches(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = repo.list_taches_perso(db, user.email)
    if not rows:
        _seed_examples(db, user.email)
        rows = repo.list_taches_perso(db, user.email)
    return envelope([t.to_dict() for t in rows], meta={"total": len(rows)})


@router.post("/taches", status_code=status.HTTP_201_CREATED)
def add_tache(payload: TacheIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    t = repo.create_tache_perso(db, user_email=user.email, titre=payload.titre.strip(),
                                date_echeance=payload.date_echeance, priorite=payload.priorite)
    return envelope(t.to_dict())


@router.patch("/taches/{id_tache}")
def patch_tache(id_tache: int, payload: TachePatch,
                user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    t = repo.update_tache_perso(db, id_tache=id_tache, user_email=user.email,
                                **payload.model_dump(exclude_unset=True))
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tâche introuvable.")
    return envelope(t.to_dict())


@router.delete("/taches/{id_tache}")
def remove_tache(id_tache: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    ok = repo.delete_tache_perso(db, id_tache=id_tache, user_email=user.email)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tâche introuvable.")
    return envelope({"deleted": True})
