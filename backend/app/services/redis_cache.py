"""Cache clé→valeur avec Redis et repli automatique en mémoire.

Utilisé pour mettre en cache les agrégats coûteux du tableau de bord (TTL court).
Si Redis est injoignable (dev sans conteneur), on bascule de façon transparente
sur un cache mémoire local — l'application continue de fonctionner.
"""

import json
import time

from app.core.config import settings

# --- Repli mémoire : { clé: (expiration_epoch, valeur_json) } ---
_MEM: dict[str, tuple[float, str]] = {}

_client = None          # instance redis.Redis (paresseuse)
_redis_ok = False       # True si la dernière opération Redis a réussi


def _get_client():
    """Initialise (une fois) le client Redis. Renvoie None si indisponible."""
    global _client, _redis_ok
    if _client is not None:
        return _client
    if not settings.CACHE_ENABLED:
        return None
    try:
        import redis  # import paresseux : pas requis si CACHE_ENABLED=false

        _client = redis.Redis.from_url(
            settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1, socket_timeout=1
        )
        _client.ping()
        _redis_ok = True
    except Exception:
        # Redis absent/injoignable : on reste en mémoire.
        _client = None
        _redis_ok = False
    return _client


def get(key: str):
    """Renvoie la valeur décodée (dict/list) ou None si absente/expirée."""
    if not settings.CACHE_ENABLED:
        return None
    client = _get_client()
    if client is not None:
        try:
            raw = client.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception:
            pass  # bascule mémoire ci-dessous
    item = _MEM.get(key)
    if not item:
        return None
    expires_at, raw = item
    if time.time() > expires_at:
        _MEM.pop(key, None)
        return None
    return json.loads(raw)


def set(key: str, value, ttl: int) -> None:
    """Stocke `value` (JSON-sérialisable) avec une durée de vie `ttl` secondes."""
    if not settings.CACHE_ENABLED:
        return
    raw = json.dumps(value, ensure_ascii=False, default=str)
    client = _get_client()
    if client is not None:
        try:
            client.setex(key, ttl, raw)
            return
        except Exception:
            pass  # bascule mémoire ci-dessous
    _MEM[key] = (time.time() + ttl, raw)


def delete(*keys: str) -> None:
    """Invalide une ou plusieurs clés (Redis + mémoire)."""
    client = _get_client()
    if client is not None:
        try:
            client.delete(*keys)
        except Exception:
            pass
    for k in keys:
        _MEM.pop(k, None)


def clear() -> None:
    """Vide le repli mémoire (utile pour les tests)."""
    _MEM.clear()
