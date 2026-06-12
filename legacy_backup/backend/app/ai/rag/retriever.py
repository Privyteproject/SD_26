from app.ai.rag.vector_store import VectorStore
from app.ai.schemas import UserContext
from app.core.config import settings


def retrieve_authorized_documents(query: str, user_context: UserContext, top_k: int | None = None) -> list[dict]:
    vector_store = VectorStore()
    return vector_store.search(
        query=query,
        role=user_context.role,
        department=user_context.department,
        top_k=top_k or settings.RAG_TOP_K,
    )


def filter_documents_by_confidence(documents: list[dict], min_confidence: float | None = None) -> list[dict]:
    threshold = settings.RAG_MIN_CONFIDENCE if min_confidence is None else min_confidence
    return [document for document in documents if float(document.get("score", 0.0)) >= threshold]


def build_documents_context(documents: list[dict]) -> str:
    if not documents:
        return ""

    chunks: list[str] = []
    for document in documents:
        metadata = document.get("metadata", {})
        title = metadata.get("title", document["document_id"])
        chunks.append(f"[Source: {title} | ID: {document['document_id']}]\n{document.get('text', '')}")
    return "\n\n".join(chunks)
