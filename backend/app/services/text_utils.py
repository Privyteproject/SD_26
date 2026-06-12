"""Petites fonctions texte partagées (normalisation, similarité lexicale)."""

import re
import unicodedata


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalize(s: str) -> str:
    s = strip_accents((s or "").lower())
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", normalize(s)))


def lexical_score(query: str, text: str) -> float:
    """Similarité lexicale simple (overlap pondéré). 0..1.
    >>> PROVISOIRE : à remplacer par des embeddings (cosine) + ChromaDB."""
    q, t = tokens(query), tokens(text)
    if not q or not t:
        return 0.0
    inter = len(q & t)
    return inter / (len(q) ** 0.5 * len(t) ** 0.5)
