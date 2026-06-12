"""Endpoints Tableau de bord (montés sous /dashboard).

- /kpis        : indicateurs simples (tous rôles authentifiés).
- /rh          : tableau de bord RH enrichi (effectifs + risques + indicateurs).
- /risques     : scores de risque (confidentiel : RH/MEDECINE/DIRECTION/ADMIN).
- /indicateurs : indicateurs RH agrégés (turnover, absentéisme, engagement).
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN,
    ROLE_DIRECTION,
    ROLE_MANAGER,
    ROLE_MEDECINE,
    ROLE_RH,
    CurrentUser,
    get_current_user,
    require_roles,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope

router = APIRouter()

# QVT / bien-être : RH, médecine du travail, direction, admin (+ manager pour le RH global)
_RH_VIEW = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER, ROLE_MEDECINE)
# Données sensibles (scores individuels) : cercle restreint
_WELLBEING = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MEDECINE)


@router.get("/kpis")
def dashboard_kpis(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    data = repo.dashboard_counts(db)
    ind = repo.latest_indicateurs(db)
    data.update({
        "turnover_rate": (ind.get("turnover") or {}).get("valeur"),
        "absenteeism_rate": (ind.get("absenteisme") or {}).get("valeur"),
        "engagement": (ind.get("engagement") or {}).get("valeur"),
        "role": user.role,
    })
    return envelope(data)


@router.get("/rh")
def dashboard_rh(_: CurrentUser = Depends(_RH_VIEW), db: Session = Depends(get_db)):
    """Vue RH consolidée : effectifs, demandes en attente, risques agrégés, indicateurs."""
    data = repo.dashboard_counts(db)
    data["risques"] = repo.risk_summary(db)            # distribution + top employés à risque
    data["indicateurs"] = repo.latest_indicateurs(db)  # turnover / absentéisme / engagement
    return envelope(data)


@router.get("/risques")
def dashboard_risques(
    niveau: str | None = Query(None),
    type_: str | None = Query(None, alias="type"),
    _: CurrentUser = Depends(_WELLBEING),
    db: Session = Depends(get_db),
):
    rows = repo.list_scores(db, niveau=niveau, type=type_)
    return envelope([s.to_dict() for s in rows], meta={"total": len(rows)})


@router.get("/indicateurs")
def dashboard_indicateurs(
    type_: str | None = Query(None, alias="type"),
    periode: str | None = Query(None),
    _: CurrentUser = Depends(_RH_VIEW),
    db: Session = Depends(get_db),
):
    rows = repo.list_indicateurs(db, type=type_, periode=periode)
    return envelope([i.to_dict() for i in rows], meta={"total": len(rows)})
