"""Recherche globale (monté sous /search).

Contrat : { results: [{type, id, title, subtitle, url, icon}], total, query }.
Sources selon le rôle :
- pages de navigation (tous, filtrées par accès) ;
- employés / absences (manager = son équipe ; RH/Direction/Admin = tous) ;
- documents (collaborateur = les siens ; manager = équipe ; RH/Admin = tous).

Cache Redis (TTL 30 s, clé = search:{user}:{hash(query)}). Audit si query > 5 car.
Données sensibles (salaire, médical) jamais exposées dans title/subtitle.
"""

import hashlib

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN, ROLE_COLLABORATEUR, ROLE_DIRECTION, ROLE_MANAGER, ROLE_MEDECINE, ROLE_RH,
    CurrentUser, get_current_user,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope
from app.services import redis_cache

router = APIRouter()

_ELEVATED = {ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION}
_RH_SPACE = {ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER, ROLE_MEDECINE}

# Pages de navigation (recherche statique par mots-clés). `roles` : qui peut la voir.
_PAGES = [
    {"title": "Accueil", "url": "/app", "kw": ["accueil", "home"], "roles": "collab"},
    {"title": "Assistant IA", "url": "/app/assistant", "kw": ["assistant", "ia", "chat"], "roles": "collab"},
    {"title": "Mes documents", "url": "/app/documents", "kw": ["document", "attestation", "fichier"], "roles": "collab"},
    {"title": "Mes demandes", "url": "/app/demandes", "kw": ["demande", "conge", "absence", "rtt", "teletravail"], "roles": "collab"},
    {"title": "Mon profil", "url": "/app/profil", "kw": ["profil", "compte", "profile"], "roles": "all"},
    {"title": "Tableau de bord RH", "url": "/rh", "kw": ["dashboard", "tableau", "kpi", "indicateur"], "roles": "rh"},
    {"title": "Collaborateurs", "url": "/rh/collaborateurs", "kw": ["collaborateur", "employe", "annuaire", "equipe"], "roles": "rh"},
    {"title": "Demandes (validation)", "url": "/rh/demandes", "kw": ["demande", "validation", "conge", "absence"], "roles": "rh"},
    {"title": "Documents (validation)", "url": "/rh/documents", "kw": ["document", "validation"], "roles": "rh_only"},
    {"title": "Assistant RH", "url": "/rh/assistant", "kw": ["assistant", "copilote", "ia"], "roles": "rh"},
    {"title": "Onboarding", "url": "/rh/onboarding", "kw": ["onboarding", "integration", "arrivee"], "roles": "rh"},
    {"title": "Offboarding", "url": "/rh/offboarding", "kw": ["offboarding", "depart"], "roles": "rh"},
    {"title": "Supervision", "url": "/admin", "kw": ["admin", "supervision"], "roles": "admin"},
    {"title": "Utilisateurs & rôles", "url": "/admin/utilisateurs", "kw": ["utilisateur", "role", "compte"], "roles": "admin"},
    {"title": "Journal d'audit", "url": "/admin/audit", "kw": ["audit", "journal", "log", "trace"], "roles": "admin"},
]


def _page_visible(page, role) -> bool:
    r = page["roles"]
    return (
        r == "all"
        or (r == "collab" and role == ROLE_COLLABORATEUR)
        or (r == "rh" and (role in _RH_SPACE or role == ROLE_ADMIN))
        or (r == "rh_only" and role in {ROLE_RH, ROLE_DIRECTION, ROLE_ADMIN})
        or (r == "admin" and role == ROLE_ADMIN)
    )


def _search_pages(q, role, limit=5):
    ql = q.lower()
    out = []
    for p in _PAGES:
        if not _page_visible(p, role):
            continue
        if ql in p["title"].lower() or any(ql in k for k in p["kw"]):
            out.append({"type": "page", "id": None, "title": p["title"],
                        "subtitle": p["url"], "url": p["url"], "icon": "link"})
        if len(out) >= limit:
            break
    return out


@router.get("")
def search(
    q: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=30),
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
):
    q = q.strip()
    if len(q) < 2:  # minimum 2 caractères
        return envelope({"results": [], "total": 0, "query": q})

    # Cache Redis 30 s, par utilisateur + requête.
    qh = hashlib.sha256(q.lower().encode()).hexdigest()[:16]
    ckey = f"search:{user.sub or user.email}:{qh}:{limit}"
    cached = redis_cache.get(ckey)
    if cached is not None:
        return envelope(cached)

    role = user.role
    elevated = role in _ELEVATED
    manager = role == ROLE_MANAGER
    emp = repo.find_employee_by_email(db, user.email)
    own = emp.matricule if emp else None

    results = _search_pages(q, role)

    if elevated:
        results += repo.gsearch_employees(db, q, dept_id=None)
        results += repo.gsearch_absences(db, q, matricules=None)
        docs = repo.gsearch_documents(db, q, matricules=None)
        for d in docs:
            d["url"] = "/rh/documents"
        results += docs
    elif manager:
        dept_id = emp.id_departement if emp else None
        mats = repo.dept_matricules(db, dept_id)
        results += repo.gsearch_employees(db, q, dept_id=dept_id)
        results += repo.gsearch_absences(db, q, matricules=mats)
        docs = repo.gsearch_documents(db, q, matricules=mats)
        for d in docs:
            d["url"] = "/rh/documents"
        results += docs
    else:  # collaborateur / médecine : uniquement ses propres documents
        results += repo.gsearch_documents(db, q, matricules=[own] if own else [])

    results = results[:limit]
    payload = {"results": results, "total": len(results), "query": q}
    redis_cache.set(ckey, payload, ttl=30)

    if len(q) > 5:  # audit des recherches significatives uniquement
        repo.log_audit(db, action="SEARCH", type_entite="search", id_entite=q[:60], user_email=user.email)
    return envelope(payload)
