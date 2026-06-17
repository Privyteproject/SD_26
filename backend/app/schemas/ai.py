"""Schémas de l'assistant conversationnel et du juge."""

from typing import Literal

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)
    judge: bool = False  # si True, évalue aussi la réponse via le modèle juge
    conversation_id: int | None = None  # (déprécié) ancien système d'historique
    session_id: str | None = None        # session de chat à poursuivre (sinon créée au 1er message)
    audience: Literal["collaborateur", "rh"] = "collaborateur"  # profil d'assistant


class ConversationUpdate(BaseModel):
    titre: str | None = Field(None, min_length=1, max_length=160)
    archivee: bool | None = None


class JudgeRequest(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
