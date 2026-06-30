"""Journalisation automatique des mutations (audit log).

On écoute les événements ORM `after_insert` / `after_update` / `after_delete`
de TOUS les modèles (via la classe `Mapper`) et on écrit une ligne dans
`journal_audit` à chaque création / modification / suppression, sans avoir à
instrumenter chaque endpoint.

L'acteur (utilisateur courant) et l'IP sont fournis par la couche web via des
ContextVar (cf. `set_request_context`). À l'intérieur d'un flush on n'utilise
JAMAIS la Session : on émet l'INSERT d'audit directement sur la `connection`
fournie par l'événement (pattern recommandé par SQLAlchemy), avec un INSERT Core
sur la table — donc sans redéclencher les événements ORM (pas de récursion).
"""

import json
from contextvars import ContextVar
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import event, inspect as sa_inspect, select
from sqlalchemy.orm import Mapper

from app.core.config import settings
from app.db.models import JournalAudit, Utilisateur
from app.services import redis_cache

# --- Contexte requête (posé par le middleware / la dépendance d'auth) ---
_actor_sub: ContextVar[str | None] = ContextVar("audit_actor_sub", default=None)
_actor_email: ContextVar[str | None] = ContextVar("audit_actor_email", default=None)
_actor_ip: ContextVar[str | None] = ContextVar("audit_actor_ip", default=None)
# Cache de l'id_utilisateur résolu pour la requête courante (évite un SELECT par ligne).
_UNSET = object()
_actor_id: ContextVar[object] = ContextVar("audit_actor_id", default=_UNSET)

# Tables jamais auditées (récursion + volumétrie).
# chat_messages/chat_sessions : on n'audite QUE la suppression de session (fait manuellement),
# pas chaque message (cf. contrainte RGPD/volumétrie).
_EXCLUDE = {"journal_audit", "chat_messages", "chat_sessions"}
# Mutations sur ces tables -> on invalide le cache du tableau de bord.
_CACHE_BUSTERS = {"employe", "demande", "indicateur_rh", "departement", "utilisateur"}


def set_request_context(sub: str | None = None, email: str | None = None, ip: str | None = None) -> None:
    """Mémorise l'acteur courant pour les écritures d'audit de la requête."""
    if sub is not None:
        _actor_sub.set(sub)
        _actor_id.set(_UNSET)  # invalide le cache : nouvel acteur
    if email is not None:
        _actor_email.set(email)
        _actor_id.set(_UNSET)
    if ip is not None:
        _actor_ip.set(ip)


def _json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return str(value)


def _entity_pk(target) -> str | None:
    """Renvoie la clé primaire de l'objet sous forme de chaîne (composite si besoin).

    On lit les colonnes de PK directement sur l'instance : à `after_insert`, la
    PK auto-incrémentée est déjà renseignée (contrairement à `.identity`).
    """
    try:
        mapper = sa_inspect(target).mapper
        parts = [getattr(target, col.key, None) for col in mapper.primary_key]
    except Exception:
        return None
    parts = [p for p in parts if p is not None]
    if not parts:
        return None
    return ":".join(str(p) for p in parts)


def _diff(target) -> dict | None:
    """Diff {champ: [ancien, nouveau]} des colonnes modifiées (UPDATE)."""
    state = sa_inspect(target)
    changes: dict[str, list] = {}
    for attr in state.attrs:
        hist = attr.history
        if not hist.has_changes():
            continue
        old = hist.deleted[0] if hist.deleted else None
        new = hist.added[0] if hist.added else None
        changes[attr.key] = [old, new]
    return changes or None


def _resolve_user_id(connection) -> int | None:
    """Résout (et met en cache) l'id_utilisateur de l'acteur via son sub ou son email."""
    cached = _actor_id.get()
    if cached is not _UNSET:
        return cached
    sub = _actor_sub.get()
    email = _actor_email.get()
    uid = None
    if sub or email:
        stmt = select(Utilisateur.id_utilisateur)
        stmt = stmt.where(Utilisateur.keycloak_sub == sub) if sub else stmt.where(Utilisateur.email == email)
        try:
            uid = connection.execute(stmt.limit(1)).scalar_one_or_none()
        except Exception:
            uid = None
    _actor_id.set(uid)
    return uid


def _snapshot(target) -> dict:
    """Capture des valeurs de colonnes (pour INSERT / DELETE)."""
    mapper = sa_inspect(target).mapper
    return {c.key: getattr(target, c.key, None) for c in mapper.column_attrs}


def _write(connection, action: str, target, changes: dict | None) -> None:
    table = target.__tablename__
    if table in _EXCLUDE:
        return
    try:
        connection.execute(
            JournalAudit.__table__.insert().values(
                action=action,
                type_entite=table,
                id_entite=_entity_pk(target),
                changements=json.dumps(changes, ensure_ascii=False, default=_json_default) if changes else None,
                adresse_ip=_actor_ip.get(),
                id_utilisateur=_resolve_user_id(connection),
            )
        )
    except Exception:
        # L'audit ne doit jamais casser une opération métier.
        pass
    if table in _CACHE_BUSTERS:
        redis_cache.delete("dashboard:kpis")


def _on_insert(mapper, connection, target):
    _write(connection, "INSERT", target, _snapshot(target))


def _on_update(mapper, connection, target):
    _write(connection, "UPDATE", target, _diff(target))


def _on_delete(mapper, connection, target):
    _write(connection, "DELETE", target, _snapshot(target))


_registered = False


def register_audit_listeners() -> None:
    """Branche les écouteurs sur TOUS les mappers (idempotent)."""
    global _registered
    if _registered or not settings.AUDIT_ENABLED:
        return
    event.listen(Mapper, "after_insert", _on_insert)
    event.listen(Mapper, "after_update", _on_update)
    event.listen(Mapper, "after_delete", _on_delete)
    _registered = True
