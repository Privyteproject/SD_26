from typing import Any

from pydantic import BaseModel, Field


class UserContext(BaseModel):
    user_id: str
    role: str
    department: str | None = None
    permissions: list[str] = Field(default_factory=list)
    team_id: str | None = None
    language: str | None = None


class ChatRequest(BaseModel):
    message: str
    user_context: UserContext


class Source(BaseModel):
    document_id: str
    title: str
    excerpt: str
    score: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    answer: str
    scope: str
    request_type: str
    decision: str
    sources: list[Source] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    routed_to_human: bool = False


class AuditEvent(BaseModel):
    event_type: str
    user_id: str
    role: str
    message: str | None = None
    decision: str
    metadata: dict[str, Any] = Field(default_factory=dict)
