"""Vector store — abstraction à 2 backends.

- MEMORY : cosine en mémoire (pur Python, sans dépendance). Défaut de repli.
- CHROMA : ChromaDB persistant (`pip install chromadb`). On fournit nous-mêmes
           les embeddings, donc Chroma ne télécharge aucun modèle.

`RAG_VECTOR_BACKEND=auto` -> Chroma si importable, sinon Memory.
Interface : upsert(items), query(vector, k) -> [{id,text,metadata,score}], count().
"""

from app.core.config import settings

_COLLECTION = "synapse_rh_kb"


class MemoryStore:
    backend = "memory"

    def __init__(self):
        self._items: dict[str, dict] = {}  # id -> {text, metadata, vector}

    def upsert(self, items: list[dict]) -> None:
        for it in items:
            self._items[it["id"]] = {"text": it["text"], "metadata": it.get("metadata", {}),
                                     "vector": it["vector"]}

    def query(self, vector: list[float], k: int) -> list[dict]:
        def cos(a, b):  # vecteurs déjà normalisés -> produit scalaire
            return sum(x * y for x, y in zip(a, b))
        scored = [{"id": i, "text": v["text"], "metadata": v["metadata"],
                   "score": cos(vector, v["vector"])} for i, v in self._items.items()]
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:k]

    def count(self) -> int:
        return len(self._items)


class ChromaStore:
    backend = "chroma"

    def __init__(self, path: str):
        import chromadb
        self._client = chromadb.PersistentClient(path=path)
        self._coll = self._client.get_or_create_collection(
            _COLLECTION, metadata={"hnsw:space": "cosine"})

    def upsert(self, items: list[dict]) -> None:
        self._coll.upsert(
            ids=[it["id"] for it in items],
            embeddings=[it["vector"] for it in items],
            documents=[it["text"] for it in items],
            metadatas=[it.get("metadata", {}) for it in items],
        )

    def query(self, vector: list[float], k: int) -> list[dict]:
        res = self._coll.query(query_embeddings=[vector], n_results=k,
                               include=["documents", "metadatas", "distances"])
        out = []
        ids = res.get("ids", [[]])[0]
        for i, _id in enumerate(ids):
            dist = res["distances"][0][i]
            out.append({"id": _id, "text": res["documents"][0][i],
                        "metadata": res["metadatas"][0][i],
                        "score": 1.0 - float(dist)})  # cosine distance -> similarité
        return out

    def count(self) -> int:
        return self._coll.count()


_STORE = None


def get_store():
    global _STORE
    if _STORE is not None:
        return _STORE
    backend = settings.RAG_VECTOR_BACKEND
    if backend == "auto":
        try:
            import chromadb  # noqa: F401
            backend = "chroma"
        except Exception:
            backend = "memory"
    try:
        _STORE = ChromaStore(settings.CHROMA_PATH) if backend == "chroma" else MemoryStore()
    except Exception:
        _STORE = MemoryStore()  # repli sûr
    return _STORE
