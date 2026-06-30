"""Endpoints RAG (montés sous /rag) — ingestion + recherche + stats du vector store.

- POST /rag/ingest : indexe des chunks dans ChromaDB/vector store (ADMIN/RH).
- GET  /rag/search : récupération filtrée par le rôle de l'appelant (debug/preview).
- GET  /rag/stats  : backend embeddings/vector + nombre de chunks.
"""

from fastapi import APIRouter, Depends, Query

from app.core.security import ROLE_ADMIN, ROLE_DIRECTION, ROLE_RH, CurrentUser, get_current_user, require_roles
from app.schemas.common import envelope
from app.schemas.hr import RagIngest
from app.services import retrieval

router = APIRouter()
_INGEST = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION)


@router.post("/ingest")
def ingest(payload: RagIngest, _: CurrentUser = Depends(_INGEST)):
    chunks = [c.model_dump() for c in payload.documents]
    n = retrieval.ingest(chunks)
    return envelope({"ingested": n, **retrieval.stats()})


@router.get("/search")
def search(
    q: str = Query(..., min_length=1),
    k: int | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    hits = retrieval.retrieve(q, user.role, k)
    return envelope(hits, meta={"total": len(hits), **retrieval.stats()})


@router.get("/stats")
def stats(_: CurrentUser = Depends(get_current_user)):
    retrieval.ensure_seeded()
    return envelope(retrieval.stats())
