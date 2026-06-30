"""Sessions de chat persistées (monté sous /chat).

Historique des conversations de l'assistant, stocké en base (chat_sessions /
chat_messages). Toutes les lectures sont SCOPÉES à l'utilisateur du JWT
(protection IDOR : on vérifie session.id_utilisateur == utilisateur courant).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()


@router.get("/sessions")
def list_sessions(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = repo.chat_list_sessions(db, user_email=user.email)
    return envelope(rows, meta={"total": len(rows)})


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def create_session(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    s = repo.chat_create_session(db, user_email=user.email)
    if s is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Utilisateur non rattaché")
    return envelope({"id": s.id, "title": s.title,
                     "created_at": s.created_at.isoformat() if s.created_at else None})


@router.get("/sessions/{session_id}/messages")
def session_messages(
    session_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    if repo.chat_session_owned(db, session_id, user.email) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session introuvable")
    return envelope(repo.chat_get_messages(db, session_id=session_id))


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Suppression douce (is_deleted=True) + audit. Vérifie la propriété."""
    if not repo.chat_soft_delete(db, session_id=session_id, user_email=user.email):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session introuvable")
    return envelope({"id": session_id, "deleted": True})
