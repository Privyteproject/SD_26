"""Alertes / Worklist priorisée (monté sous /alertes).

- GET   /alertes/prioritized : alertes triées par criticité (high d'abord) puis date.
- GET   /alertes/history     : historique des alertes TRAITÉES (motif + plan d'action + note).
- PATCH /alertes/{id}/resolve : marque une alerte traitée en conservant le plan d'action.
Réservé RH / Direction / Admin / Manager (scopé à son département).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_DIRECTION, ROLE_RH, ROLE_MANAGER, CurrentUser, require_roles
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

_RH = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER)


class ResolveIn(BaseModel):
    """Traitement d'une alerte : plan d'action retenu (liste d'actions) + note facultative."""
    plan_action: list[str] | None = None
    note: str | None = None


def _dept_for(u: CurrentUser, db: Session) -> int | None:
    """Périmètre département pour un manager (None = vue org pour RH/Direction/Admin).
    Résolution par e-mail (cohérente avec le reste de l'app et compatible dev-login)."""
    if u.role in (ROLE_RH, ROLE_ADMIN, ROLE_DIRECTION):
        return None
    emp = repo.find_employee_by_email(db, u.email)
    return emp.id_departement if emp else None


# §3.3 — Les alertes de SÉCURITÉ TECHNIQUE sont réservées à l'admin et aux « responsables RH
# autorisés » (utilisateur.securite_habilite). Tout autre profil (manager, RH/Direction non
# habilité) ne voit que les alertes préventives/RH.
def _security_cleared(db: Session, user: CurrentUser) -> bool:
    if user.role == ROLE_ADMIN:
        return True
    if user.role in (ROLE_RH, ROLE_DIRECTION):
        from sqlalchemy import select
        from app.db.models import Utilisateur
        u = db.scalar(select(Utilisateur).where(Utilisateur.email == user.email))
        return bool(u and u.securite_habilite)
    return False


def _category_filter(db: Session, user: CurrentUser) -> dict:
    """Filtre de catégories selon le rôle :
    - ADMIN (technique/sécurité §2/§3.3) : SÉCURITÉ uniquement (whitelist), pas de préventif RH nominatif.
    - RH/Direction habilité : tout.
    - Autres (manager, RH/Direction non habilité) : tout SAUF la sécurité technique."""
    if user.role == ROLE_ADMIN:
        return {"only_categories": repo.SECURITY_ALERT_CATEGORIES}
    if _security_cleared(db, user):
        return {}
    return {"exclude_categories": repo.SECURITY_ALERT_CATEGORIES}


@router.get("/prioritized")
def prioritized(
    include_resolved: bool = Query(False),
    user: CurrentUser = Depends(_RH), db: Session = Depends(get_db),
):
    dept = _dept_for(user, db)
    rows = repo.list_alertes_prioritized(db, include_resolved=include_resolved, department_id=dept,
                                         **_category_filter(db, user))
    return envelope(rows, meta={"total": len(rows)})


@router.get("/history")
def history(
    limit: int = Query(100, ge=1, le=500),
    user: CurrentUser = Depends(_RH), db: Session = Depends(get_db),
):
    """Historique des alertes traitées : motif (message/catégorie), plan d'action retenu,
    note, auteur et date de résolution. Scopé au département pour un manager."""
    dept = _dept_for(user, db)
    rows = repo.list_alertes_history(db, limit=limit, department_id=dept, **_category_filter(db, user))
    return envelope(rows, meta={"total": len(rows)})


@router.patch("/{id_alerte}/resolve")
def resolve(id_alerte: int, payload: ResolveIn | None = None,
            user: CurrentUser = Depends(_RH), db: Session = Depends(get_db)):
    from app.db.models import Alerte
    payload = payload or ResolveIn()
    target = db.get(Alerte, id_alerte)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Alerte introuvable")
    # Périmètre : ne pas traiter une alerte de sécurité hors habilitation, ni hors équipe (manager).
    if target.categorie in repo.SECURITY_ALERT_CATEGORIES and not _security_cleared(db, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Alerte de sécurité réservée aux profils habilités.")
    if user.role == ROLE_MANAGER and target.matricule:
        from app.core import scope
        if not scope.is_in_scope(db, user, target.matricule):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hors de votre périmètre d'équipe")
    repo.resolve_alerte(db, id_alerte, plan_action=payload.plan_action,
                        note=payload.note, resolu_par=user.email)
    # §4.1 — la décision reste HUMAINE et tracée (qui a traité, quand, avec quel plan).
    try:
        repo.log_audit(db, action="ALERTE_TRAITEE", type_entite="alerte",
                       id_entite=str(id_alerte), user_email=user.email)
    except Exception:
        db.rollback()
    return envelope({"id": id_alerte, "resolue": True})
