import os
import shutil
from pathlib import Path
from typing import Any

os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb
from sentence_transformers import SentenceTransformer

from app.core.config import BACKEND_DIR, settings


class VectorStore:
    def __init__(self) -> None:
        self.persist_path = settings.chroma_persist_path
        self.persist_path.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=str(self.persist_path),
            settings=chromadb.Settings(
                anonymized_telemetry=False,
                allow_reset=True,
                chroma_product_telemetry_impl="app.ai.rag.chroma_noop_telemetry.NoOpProductTelemetryClient",
                chroma_telemetry_impl="app.ai.rag.chroma_noop_telemetry.NoOpProductTelemetryClient",
            ),
        )
        self.collection = self._load_collection()
        self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)

    def _load_collection(self):
        try:
            return self.client.get_or_create_collection(settings.CHROMA_COLLECTION_NAME)
        except KeyError:
            self._reset_persist_directory()
            self.client = chromadb.PersistentClient(
                path=str(self.persist_path),
                settings=chromadb.Settings(
                    anonymized_telemetry=False,
                    allow_reset=True,
                    chroma_product_telemetry_impl="app.ai.rag.chroma_noop_telemetry.NoOpProductTelemetryClient",
                    chroma_telemetry_impl="app.ai.rag.chroma_noop_telemetry.NoOpProductTelemetryClient",
                ),
            )
            return self.client.get_or_create_collection(settings.CHROMA_COLLECTION_NAME)

    def _reset_persist_directory(self) -> None:
        resolved = self.persist_path.resolve()
        backend_data = (BACKEND_DIR / "data").resolve()
        if backend_data not in resolved.parents and resolved != backend_data:
            raise RuntimeError("Refusing to reset a Chroma directory outside backend/data.")
        if resolved.exists():
            try:
                shutil.rmtree(resolved)
            except PermissionError:
                fallback_path = backend_data / "chroma_recovered"
                fallback_path.mkdir(parents=True, exist_ok=True)
                self.persist_path = fallback_path
                return
        resolved.mkdir(parents=True, exist_ok=True)

    def embed(self, text: str) -> list[float]:
        return self.embedding_model.encode(text).tolist()

    def add_document(self, document_id: str, text: str, metadata: dict[str, Any]) -> None:
        self.collection.upsert(
            ids=[document_id],
            documents=[text],
            metadatas=[metadata],
            embeddings=[self.embed(text)],
        )

    def reset_storage(self) -> None:
        self._reset_persist_directory()
        self.client = chromadb.PersistentClient(
            path=str(self.persist_path),
            settings=chromadb.Settings(
                anonymized_telemetry=False,
                allow_reset=True,
                chroma_product_telemetry_impl="app.ai.rag.chroma_noop_telemetry.NoOpProductTelemetryClient",
                chroma_telemetry_impl="app.ai.rag.chroma_noop_telemetry.NoOpProductTelemetryClient",
            ),
        )
        self.collection = self.client.get_or_create_collection(settings.CHROMA_COLLECTION_NAME)

    def search(
        self,
        query: str,
        role: str,
        department: str | None,
        top_k: int,
    ) -> list[dict[str, Any]]:
        collection_size = max(self.collection.count(), 1)
        results = self.collection.query(
            query_embeddings=[self.embed(query)],
            n_results=min(max(top_k * 3, top_k), collection_size),
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

            score = 1.0 / (1.0 + max(float(distance or 0.0), 0.0))
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
