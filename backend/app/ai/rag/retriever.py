from app.ai.schemas import UserContext
from app.ai.rag.vector_store import VectorStore
from app.core.config import settings


def retrieve_authorized_documents(query: str, user_context: UserContext, top_k: int | None = None) -> list[dict]:
    vector_store = VectorStore()
    return vector_store.search(
        query=query,
        role=user_context.role,
        department=user_context.department,
        top_k=top_k or settings.RAG_TOP_K,
    )


def build_documents_context(documents: list[dict]) -> str:
    if not documents:
        return ""

    chunks: list[str] = []
    for document in documents:
        metadata = document.get("metadata", {})
        title = metadata.get("title", document["document_id"])
        chunks.append(
            f"[Source: {title} | ID: {document['document_id']}]\n{document.get('text', '')}"
        )
    return "\n\n".join(chunks)
