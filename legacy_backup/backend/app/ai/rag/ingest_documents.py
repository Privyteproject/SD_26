from app.ai.rag.document_ingestion import collect_documents, get_rh_documents_path
from app.ai.rag.vector_store import VectorStore


def ingest_documents(reset: bool = True) -> int:
    vector_store = VectorStore()
    if reset:
        vector_store.reset_storage()

    documents = collect_documents()
    for document in documents:
        vector_store.add_document(
            document_id=document.document_id,
            text=document.text,
            metadata=document.metadata,
        )
    return len(documents)


if __name__ == "__main__":
    count = ingest_documents(reset=True)
    print(
        f"Ingested {count} HR document chunks into ChromaDB "
        f"from {get_rh_documents_path()}."
    )
