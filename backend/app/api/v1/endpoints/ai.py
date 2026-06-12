"""Endpoint Assistant IA (monté sous /ai).

- POST /ai/chat  : exécute la pipeline conversationnelle complète (sécurité,
  classification, RAG, PII, agent Gemma + fallback, juge Qwen, conformité, audit).
- POST /ai/judge : évalue explicitement un couple (question, réponse).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db.base import get_db
from app.schemas.ai import ChatRequest, JudgeRequest
from app.schemas.common import envelope
from app.services import ai as ai_service
from app.services import pipeline

router = APIRouter()


@router.post("/chat")
def chat(
    payload: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        data = pipeline.run_chat(db, user, payload.message, payload.history, payload.judge)
    except pipeline.RateLimited:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Trop de requêtes. Réessayez dans une minute.")
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Service IA indisponible : {exc}") from exc
    return envelope(data)


@router.post("/judge")
def judge(payload: JudgeRequest, _: CurrentUser = Depends(get_current_user)):
    try:
        verdict = ai_service.judge_reply(payload.question, payload.answer)
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Juge indisponible : {exc}") from exc
    return envelope(verdict)
