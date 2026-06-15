"""RAG documentaire — embeddings + vector store + filtrage par permissions.

Remplace l'ancienne similarité lexicale par de vrais embeddings (couche
`embeddings`) indexés dans un vector store (couche `vectorstore`,
ChromaDB ou mémoire). L'interface publique NE CHANGE PAS : `retrieve(query, role, k)`.

Filtrage d'accès : chaque chunk porte une `audience` (rôles autorisés ou ALL) ;
on récupère large puis on filtre par rôle -> « documents RH autorisés uniquement ».
"""

import threading

from app.core.config import settings
from app.services.embeddings import get_embedder
from app.services.vectorstore import get_store

ALL = "ALL"
_lock = threading.Lock()
_seeded = False

# Corpus RH de démonstration (politiques internes). audience = rôles autorisés.
KNOWLEDGE: list[dict] = [
    {"id": "pol-conges", "title": "Politique de congés payés", "audience": [ALL],
     "text": "Les congés payés s'acquièrent à raison de 1,5 jour par mois. La demande se fait "
             "via le module Demandes, validée par le manager puis les RH. Préavis recommandé de "
             "15 jours. Le solde est consultable dans l'espace personnel."},
    {"id": "pol-teletravail", "title": "Charte télétravail", "audience": [ALL],
     "text": "Le télétravail est possible jusqu'à 2 jours par semaine après accord du manager. "
             "La demande passe par le module Demandes (type Télétravail)."},
    {"id": "pol-onboarding", "title": "Procédure d'onboarding",
     "audience": ["RH", "MANAGER", "DIRECTION", "ADMIN"],
     "text": "L'onboarding comprend la signature du contrat, la configuration des accès et la "
             "remise du matériel. Les tâches sont suivies dans le module Parcours."},
    {"id": "pol-offboarding", "title": "Procédure d'offboarding",
     "audience": ["RH", "MANAGER", "DIRECTION", "ADMIN"],
     "text": "L'offboarding inclut la restitution du matériel, la clôture des accès et le solde "
             "de tout compte. Suivi dans le module Parcours (type OFFBOARDING)."},
    {"id": "pol-attestation", "title": "Attestation de travail", "audience": [ALL],
     "text": "Une attestation de travail peut être générée depuis le module Documents. Elle est "
             "validée par les RH avant mise à disposition."},
    {"id": "pol-remuneration", "title": "Rémunération et bulletins",
     "audience": ["RH", "DIRECTION", "ADMIN"],
     "text": "Les bulletins de paie sont édités mensuellement. Les questions de rémunération "
             "individuelle relèvent des RH et restent confidentielles."},
]


def _audience_csv(aud: list[str]) -> str:
    return ",".join(aud)


def _allowed(meta: dict, role: str) -> bool:
    aud = (meta.get("audience") or ALL).split(",")
    return ALL in aud or role in aud


def ingest(chunks: list[dict]) -> int:
    """Indexe des chunks {id?, title, text, audience?} dans le vector store."""
    store, embedder = get_store(), get_embedder()
    vectors = embedder.embed([f"{c.get('title','')} {c['text']}" for c in chunks])
    items = []
    for c, v in zip(chunks, vectors):
        cid = c.get("id") or f"doc-{abs(hash(c['text'])) % 10_000_000}"
        items.append({"id": cid, "text": c["text"], "vector": v,
                      "metadata": {"title": c.get("title", ""),
                                   "audience": _audience_csv(c.get("audience", [ALL]))}})
    store.upsert(items)
    return len(items)


def ensure_seeded() -> None:
    global _seeded
    if _seeded:
        return
    with _lock:
        if _seeded:
            return
        if get_store().count() == 0:
            ingest(KNOWLEDGE)
        _seeded = True


def retrieve(query: str, role: str, k: int | None = None) -> list[dict]:
    """Passages autorisés les plus pertinents (cosine >= seuil). Interface stable."""
    if not settings.RAG_ENABLED:
        return []
    ensure_seeded()
    k = k or settings.RAG_TOP_K
    store, embedder = get_store(), get_embedder()
    qv = embedder.embed([query])[0]
    hits = store.query(qv, k * 4)  # large, puis filtrage permissions (= reranking final)
    out = []
    for h in hits:
        if not _allowed(h["metadata"], role):
            continue
        if h["score"] < settings.RAG_MIN_SCORE:
            continue
        out.append({"id": h["id"], "title": h["metadata"].get("title", ""),
                    "text": h["text"], "score": round(float(h["score"]), 4)})
    return out[:k]


def stats() -> dict:
    return {"count": get_store().count(), "vector_backend": get_store().backend,
            "embed_backend": get_embedder().backend, "dim": getattr(get_embedder(), "dim", None),
            "min_score": settings.RAG_MIN_SCORE}
