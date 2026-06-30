"""Notifications / alertes (monté sous /notifications).

S'appuie sur la table `Alerte`. Un utilisateur voit les alertes qui lui sont
adressées (id_destinataire) ainsi que les diffusions (id_destinataire=None) s'il
est RH/Direction/Admin. Lecture scopée au JWT (anti-IDOR).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()


@router.get("")
def list_notifications(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    items, unread = repo.list_alertes_for(db, user_email=user.email, role=user.role)
    return envelope(items, meta={"total": len(items), "unread": unread})


@router.patch("/read-all")
def mark_all_read(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """« Clear all » : marque toutes les notifications de l'utilisateur comme lues."""
    n = repo.mark_all_alertes_read(db, user_email=user.email, role=user.role)
    return envelope({"updated": n})


@router.patch("/{id_alerte}/read")
def mark_read(id_alerte: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not repo.mark_alerte_read(db, id_alerte=id_alerte, user_email=user.email, role=user.role):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notification introuvable")
    return envelope({"id": id_alerte, "lue": True})
