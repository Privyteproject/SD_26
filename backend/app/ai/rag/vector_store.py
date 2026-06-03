from typing import Any

import chromadb
from sentence_transformers import SentenceTransformer

from app.core.config import settings


class VectorStore:
    def __init__(self) -> None:
        settings.chroma_persist_path.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
        self.collection = self.client.get_or_create_collection(settings.CHROMA_COLLECTION_NAME)
        self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)

    def embed(self, text: str) -> list[float]:
        return self.embedding_model.encode(text).tolist()

    def add_document(self, document_id: str, text: str, metadata: dict[str, Any]) -> None:
        self.collection.upsert(
            ids=[document_id],
            documents=[text],
            metadatas=[metadata],
            embeddings=[self.embed(text)],
        )

    def search(
        self,
        query: str,
        role: str,
        department: str | None,
        top_k: int,
    ) -> list[dict[str, Any]]:
        results = self.collection.query(
            query_embeddings=[self.embed(query)],
            n_results=max(top_k * 3, top_k),
        )

        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        filtered: list[dict[str, Any]] = []
        requested_department = (department or "all").lower()
        for document_id, document_text, metadata, distance in zip(ids, documents, metadatas, distances):
            metadata = metadata or {}
            allowed_roles = {
                item.strip().lower()
                for item in str(metadata.get("allowed_roles", "")).split(",")
                if item.strip()
            }
            doc_department = str(metadata.get("department", "all")).lower()
            if "all" not in allowed_roles and role.lower() not in allowed_roles:
                continue
            if doc_department not in {"all", requested_department}:
                continue

            score = max(0.0, 1.0 - float(distance or 0.0))
            filtered.append(
                {
                    "document_id": document_id,
                    "text": document_text,
                    "metadata": metadata,
                    "score": score,
                }
            )
            if len(filtered) >= top_k:
                break

        return filtered
