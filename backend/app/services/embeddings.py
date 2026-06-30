"""Fournisseur d'embeddings — abstraction à 3 backends.

- HASH  : feature hashing local (déterministe, sans dépendance ni réseau). Défaut
          de repli : permet de faire tourner tout le RAG hors-ligne.
- ST    : sentence-transformers (vrais embeddings locaux). Recommandé en prod
          locale ; nécessite `pip install sentence-transformers`.
- OR    : embeddings via OpenRouter (`/embeddings`). Nécessite une clé.

`RAG_EMBED_BACKEND=auto` choisit ST si dispo, sinon OpenRouter si clé, sinon HASH.
Interface commune : .embed(list[str]) -> list[list[float]] (vecteurs L2-normalisés).
"""

import json
import math
import urllib.request

from app.core.config import settings
from app.services.text_utils import tokens


def _l2(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


class HashingEmbedder:
    """Feature hashing (bag-of-words signé) -> vecteur dense normalisé.
    Hash STABLE (hashlib) : déterministe entre process -> compatible persistance."""
    backend = "hash"

    def __init__(self, dim: int = 512):
        self.dim = dim

    @staticmethod
    def _h(tok: str) -> int:
        import hashlib
        return int.from_bytes(hashlib.md5(tok.encode("utf-8")).digest()[:8], "little")

    def embed(self, texts: list[str]) -> list[list[float]]:
        out = []
        for t in texts:
            vec = [0.0] * self.dim
            for tok in tokens(t):
                h = self._h(tok)
                idx = h % self.dim
                sign = 1.0 if (h >> 63) & 1 == 0 else -1.0
                vec[idx] += sign
            out.append(_l2(vec))
        return out


class STEmbedder:
    backend = "sentence-transformers"

    def __init__(self, model: str):
        from sentence_transformers import SentenceTransformer
        self._m = SentenceTransformer(model)
        self.dim = self._m.get_sentence_embedding_dimension()

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [list(map(float, v)) for v in self._m.encode(texts, normalize_embeddings=True)]


class OpenRouterEmbedder:
    backend = "openrouter"

    def __init__(self, model: str):
        self.model = model
        self.dim = None

    def embed(self, texts: list[str]) -> list[list[float]]:
        body = json.dumps({"model": self.model, "input": texts}).encode("utf-8")
        req = urllib.request.Request(
            f"{settings.OPENROUTER_BASE_URL}/embeddings", data=body, method="POST",
            headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                     "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=40) as resp:  # noqa: S310
            data = json.loads(resp.read().decode("utf-8"))
        vecs = [_l2(item["embedding"]) for item in data["data"]]
        if vecs:
            self.dim = len(vecs[0])
        return vecs


_EMBEDDER = None


def get_embedder():
    global _EMBEDDER
    if _EMBEDDER is not None:
        return _EMBEDDER
    backend = settings.RAG_EMBED_BACKEND
    if backend == "auto":
        try:
            import sentence_transformers  # noqa: F401
            backend = "st"
        except Exception:
            backend = "openrouter" if settings.OPENROUTER_API_KEY else "hash"
    try:
        if backend == "st":
            _EMBEDDER = STEmbedder(settings.EMBED_MODEL_ST)
        elif backend == "openrouter":
            _EMBEDDER = OpenRouterEmbedder(settings.EMBED_MODEL_OR)
        else:
            _EMBEDDER = HashingEmbedder(settings.EMBED_DIM_HASH)
    except Exception:
        _EMBEDDER = HashingEmbedder(settings.EMBED_DIM_HASH)  # repli sûr
    return _EMBEDDER
