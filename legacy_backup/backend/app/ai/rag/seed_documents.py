from app.ai.rag.document_ingestion import collect_documents, get_rh_documents_path
from app.ai.rag.vector_store import VectorStore


def seed_documents() -> None:
    vector_store = VectorStore()
    documents = collect_documents()
    for document in documents:
        vector_store.add_document(
            document_id=document.document_id,
            text=document.text,
            metadata=document.metadata,
        )
    print(
        f"Seeded {len(documents)} HR document chunks into ChromaDB "
        f"from {get_rh_documents_path()}."
    )


if __name__ == "__main__":
    seed_documents()
