"""Enveloppe de réponse standard : { data, meta, errors }.

Le front (`lib/api.js`) lit toujours `res.data`. Pour les erreurs il lit
`data.detail || data.errors[0]` : les `HTTPException` FastAPI renvoient déjà
`{ "detail": ... }`, ce qui est donc compatible sans effort supplémentaire.
"""

from typing import Any


def envelope(data: Any = None, meta: dict | None = None, errors: list | None = None) -> dict:
    return {"data": data, "meta": meta or {}, "errors": errors or []}
