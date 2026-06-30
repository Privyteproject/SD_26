"""Cache « sémantique » (provisoire : clé = question normalisée).

>>> À faire évoluer en cache vectoriel (similarité d'embeddings). En mémoire,
TTL simple. Suffisant pour réduire coût/latence sur questions répétées."""

import time

from app.services.text_utils import normalize

_STORE: dict[str, tuple[float, dict]] = {}
_TTL = 3600  # 1h


def key(message: str, perimetre: str, role: str = "") -> str:
    # Le rôle fait PARTIE de la clé : une réponse dépend de l'autorisation (RBAC/ABAC)
    # et du filtrage documentaire par audience. Sans cela, une réponse mise en cache pour
    # un rôle habilité (RH) pourrait être resservie à un collaborateur (fuite inter-rôles).
    return f"{(role or '').upper()}:{perimetre}:{normalize(message)}"


def get(k: str):
    item = _STORE.get(k)
    if not item:
        return None
    ts, val = item
    if time.time() - ts > _TTL:
        _STORE.pop(k, None)
        return None
    return val


def set(k: str, value: dict) -> None:
    _STORE[k] = (time.time(), value)


def clear() -> None:
    _STORE.clear()
