"""Endpoints Tableau de bord (montés sous /dashboard).

KPIs calculés DYNAMIQUEMENT sur toute la base (cf. services/kpi_service). Filtrage
par département : un MANAGER ne voit que son équipe ; ADMIN/RH/DIRECTION voient tout.
Résultats lourds mis en cache Redis (TTL configurable).
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import settings
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
from app.services import kpi_service, redis_cache, risk_calculator

router = APIRouter()

_RH_VIEW = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER, ROLE_MEDECINE)
_WELLBEING = require_roles(ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MEDECINE, ROLE_MANAGER)


def _dept_for(user: CurrentUser, db: Session):
    """RBAC périmètre : un MANAGER est limité à son département ; les autres voient tout."""
    if user.role == ROLE_MANAGER:
        emp = repo.find_employee_by_email(db, user.email)
        return emp.id_departement if emp else None
    return None


@router.get("/kpis")
def dashboard_kpis(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    dept = _dept_for(user, db)
    ckey = f"dashboard:kpis:{dept or 'all'}"
    data = redis_cache.get(ckey)
    if data is None:
        snap = kpi_service.snapshot(db, dept)
        counts = repo.dashboard_counts(db)
        data = {
            "headcount": snap["effectifs"], "new_hires": counts.get("new_hires"),
            "leaving": counts.get("leaving"), "pending_absences": counts.get("pending_absences"),
            "turnover_rate": snap["turnover"], "absenteeism_rate": snap["absenteisme"],
            "engagement": snap["engagement"],
            "masse_salariale": snap["masse_salariale"]["mensuelle"],
        }
        redis_cache.set(ckey, data, ttl=settings.DASHBOARD_CACHE_TTL)
    return envelope({**data, "role": user.role})


@router.get("/rh")
def dashboard_rh(user: CurrentUser = Depends(_RH_VIEW), db: Session = Depends(get_db)):
    """Vue RH consolidée : effectifs, risques agrégés, indicateurs (dynamiques, scopés)."""
    dept = _dept_for(user, db)
    snap = kpi_service.snapshot(db, dept)
    counts = repo.dashboard_counts(db)
    return envelope({
        "headcount": snap["effectifs"],
        "new_hires": counts.get("new_hires"),
        "leaving": counts.get("leaving"),
        "pending_absences": counts.get("pending_absences"),
        "risques": repo.risk_summary(db),
        "indicateurs": {
            "turnover": {"valeur": snap["turnover"]},
            "absenteisme": {"valeur": snap["absenteisme"]},
            "engagement": {"valeur": snap["engagement"]},
            "mobilite": {"valeur": snap["mobilite"]},
        },
        "anomalies": kpi_service.anomalies(db, dept),
        "scope": "team" if dept else "org",
    })


@router.get("/projection")
def dashboard_projection(
    months: int = Query(12, ge=1, le=36),
    turnover_pct: float | None = Query(None),
    hiring_per_month: int = Query(0, ge=0),
    raise_pct: float = Query(0.0),
    absenteisme_pct: float | None = Query(None),
    mobilite_pct: float | None = Query(None),
    user: CurrentUser = Depends(_RH_VIEW), db: Session = Depends(get_db),
):
    """Projection / simulation « what-if » des effectifs, masse salariale, absentéisme
    (jours perdus + coût) et mobilité interne (mouvements attendus)."""
    dept = _dept_for(user, db)
    return envelope(kpi_service.projection(
        db, months=months, turnover_pct=turnover_pct, hiring_per_month=hiring_per_month,
        raise_pct=raise_pct, absenteisme_pct=absenteisme_pct, mobilite_pct=mobilite_pct, dept=dept))


@router.get("/analytics")
def dashboard_analytics(user: CurrentUser = Depends(_RH_VIEW), db: Session = Depends(get_db)):
    """Pyramide des âges (par genre), répartition par site, masse salariale — dynamiques."""
    dept = _dept_for(user, db)
    return envelope({
        "pyramide": kpi_service.pyramide(db, dept),
        "sites": repo.headcount_by_site(db, dept=dept),
        "masse_salariale": {**kpi_service.masse_salariale(db, dept), "total": kpi_service.masse_salariale(db, dept)["annuelle"]},
    })


@router.get("/indicateurs")
def dashboard_indicateurs(user: CurrentUser = Depends(_RH_VIEW), db: Session = Depends(get_db)):
    """Série temporelle réelle (engagement + absentéisme par trimestre). Cache 1h."""
    dept = _dept_for(user, db)
    ckey = f"dashboard:indic:{dept or 'all'}"
    flat = redis_cache.get(ckey)
    if flat is None:
        flat = []
        for row in kpi_service.quarterly_series(db, dept):
            flat.append({"periode": row["periode"], "type": "engagement", "valeur": row["engagement"]})
            flat.append({"periode": row["periode"], "type": "absenteisme", "valeur": row["absenteisme"]})
        redis_cache.set(ckey, flat, ttl=3600)  # TTL 1h (requêtes lourdes)
    return envelope(flat, meta={"total": len(flat)})


@router.post("/risques/calculate")
def calculate_risques(_: CurrentUser = Depends(_WELLBEING), db: Session = Depends(get_db)):
    """Recalcule les scores de risque (règles métier burnout + turnover)."""
    summary = risk_calculator.recompute(db)
    redis_cache.delete("dashboard:kpis:all")
    return envelope(summary)


@router.get("/risques")
def dashboard_risques(
    niveau: str | None = Query(None),
    type_: str | None = Query(None, alias="type"),
    user: CurrentUser = Depends(_WELLBEING),
    db: Session = Depends(get_db),
):
    dept = _dept_for(user, db)
    rows = repo.list_scores(db, niveau=niveau, type=type_, department_id=dept)
    return envelope([s.to_dict() for s in rows], meta={"total": len(rows)})
