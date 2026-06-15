"""Rate limiting par utilisateur (fenêtre fixe, en mémoire).

>>> Pour la prod multi-instances : remplacer par Redis. Ici suffisant en mono-process."""

import time

from app.core.config import settings

_HITS: dict[str, list[float]] = {}


def allow(user_key: str, limit: int | None = None, per_seconds: int = 60) -> bool:
    limit = limit or settings.RATE_LIMIT_PER_MIN
    now = time.time()
    window = _HITS.setdefault(user_key, [])
    # purge des appels hors fenêtre
    window[:] = [t for t in window if now - t < per_seconds]
    if len(window) >= limit:
        return False
    window.append(now)
    return True


def reset() -> None:
    _HITS.clear()
