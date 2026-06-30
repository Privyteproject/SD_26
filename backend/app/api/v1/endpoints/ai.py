"""Endpoint Assistant IA (monté sous /ai).

- POST /ai/chat  : exécute la pipeline conversationnelle complète (sécurité,
  classification, RAG, PII, agent Gemma + fallback, juge Qwen, conformité, audit).
- POST /ai/judge : évalue explicitement un couple (question, réponse).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, CurrentUser, get_current_user, require_roles
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.ai import ChatRequest, ConversationUpdate, JudgeRequest
from app.schemas.common import envelope
from app.services import ai as ai_service
from app.services import pipeline

router = APIRouter()

_SUPERVISE = require_roles(ROLE_ADMIN)


@router.post("/chat")
def chat(
    payload: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1) Session : on poursuit celle fournie (après contrôle de propriété) ou on en crée une.
    # Un id de session inconnu/périmé (base ré-ensemencée, localStorage obsolète) NE doit PAS
    # rendre l'assistant « indisponible » : on repart simplement sur une nouvelle session.
    # La propriété reste vérifiée (chat_session_owned) -> jamais la session d'un autre utilisateur.
    session = None
    if payload.session_id:
        session = repo.chat_session_owned(db, payload.session_id, user.email)
    if session is None:
        session = repo.chat_create_session(db, user_email=user.email, title=payload.message[:50])
    sid = session.id if session else None

    # 2) Historique reconstruit côté serveur (source de vérité) + message utilisateur persisté.
    history = repo.chat_history_for_llm(db, sid) if sid else payload.history
    if sid:
        repo.chat_add_message(db, session_id=sid, role="user", content=payload.message)

    # 3) Génération.
    try:
        data = pipeline.run_chat(db, user, payload.message, history, payload.judge,
                                 audience=payload.audience)
    except pipeline.RateLimited:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Trop de requêtes. Réessayez dans une minute.")
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Service IA indisponible : {exc}") from exc

    # 4) Réponse assistant persistée (avec mode + sources).
    if sid:
        meta = data.get("meta", {})
        repo.chat_add_message(db, session_id=sid, role="assistant", content=data.get("reply") or "",
                              mode=meta.get("mode"), sources=meta.get("sources") or None)
        data.setdefault("meta", {})["session_id"] = sid
    return envelope(data)


# ── Historique des chats : conversations de l'utilisateur courant ──
@router.get("/conversations")
def list_conversations(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = repo.list_conversations(db, user_email=user.email)
    return envelope(rows, meta={"total": len(rows)})


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    if repo._conversation_owned(db, conversation_id, user.email) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Conversation introuvable")
    return envelope(repo.conversation_messages(db, id_conversation=conversation_id))


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    conversation_id: int, payload: ConversationUpdate,
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    if payload.archivee:
        if not repo.archive_conversation(db, id_conversation=conversation_id, user_email=user.email):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Conversation introuvable")
        return envelope({"id": conversation_id, "archived": True})
    c = repo.rename_conversation(db, id_conversation=conversation_id, user_email=user.email, titre=payload.titre)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Conversation introuvable")
    return envelope({"id": c.id_conversation, "titre": c.titre})


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Suppression douce (archivage) : la conversation est conservée pour l'audit."""
    if not repo.archive_conversation(db, id_conversation=conversation_id, user_email=user.email):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Conversation introuvable")
    return envelope({"id": conversation_id, "deleted": True})


@router.get("/logs")
def ai_logs(
    limit: int = Query(100, ge=1, le=500),
    _: CurrentUser = Depends(_SUPERVISE),
    db: Session = Depends(get_db),
):
    """Journaux d'audit des échanges IA (interaction_ia) + coût en tokens. Réservé ADMIN."""
    return envelope(repo.list_ia_interactions(db, limit=limit), meta=repo.ia_interactions_stats(db))


@router.get("/security-stats")
def ai_security_stats(_: CurrentUser = Depends(_SUPERVISE), db: Session = Depends(get_db)):
    """Indicateurs de sécurité IA : refus 24h/7j, alertes par gravité, taux sensibles. ADMIN."""
    return envelope(repo.security_stats(db))


@router.get("/usage-trend")
def ai_usage_trend(days: int = Query(14, ge=1, le=60),
                   _: CurrentUser = Depends(_SUPERVISE), db: Session = Depends(get_db)):
    """Volume d'échanges IA par jour (graphe supervision admin)."""
    return envelope(repo.ia_usage_trend(db, days))


@router.get("/events")
def ai_events(limit: int = Query(8, ge=1, le=50),
              _: CurrentUser = Depends(_SUPERVISE), db: Session = Depends(get_db)):
    """Derniers événements de sécurité IA (refus / sensibles / escalades). ADMIN."""
    return envelope(repo.recent_ia_events(db, limit))


@router.get("/logs/{interaction_id}")
def ai_log_detail(interaction_id: int, user: CurrentUser = Depends(_SUPERVISE), db: Session = Depends(get_db)):
    """Contenu complet d'un échange (accès ADMIN, TRACÉ dans le journal d'audit)."""
    detail = repo.ia_interaction_detail(db, interaction_id, viewer_email=user.email)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Interaction introuvable")
    return envelope(detail)


@router.post("/judge")
def judge(payload: JudgeRequest, _: CurrentUser = Depends(get_current_user)):
    try:
        verdict = ai_service.judge_reply(payload.question, payload.answer)
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Juge indisponible : {exc}") from exc
    return envelope(verdict)
