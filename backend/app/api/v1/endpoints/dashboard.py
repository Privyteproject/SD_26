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

# L'ADMIN (technique/sécurité §2) est EXCLU des tableaux de bord RH métier/nominatifs : il n'a
# aucune donnée RH (ni cockpit, ni analytique, ni financier). Sa supervision passe par /ai/* et /audit.
_RH_VIEW = require_roles(ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER, ROLE_MEDECINE)
_WELLBEING = require_roles(ROLE_RH, ROLE_DIRECTION, ROLE_MEDECINE, ROLE_MANAGER)
_EXEC = require_roles(ROLE_RH, ROLE_DIRECTION)  # vues consolidées / financières
# Analytique RH (hors médecine du travail : moindre privilège loi 09-08). Manager = scope équipe.
_NO_MED = require_roles(ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER)


def _dept_for(user: CurrentUser, db: Session):
    """RBAC périmètre : un MANAGER est limité à son département ; les autres voient tout."""
    if user.role == ROLE_MANAGER:
        emp = repo.find_employee_by_email(db, user.email)
        return emp.id_departement if emp else None
    return None


@router.get("/kpis")
def dashboard_kpis(user: CurrentUser = Depends(_EXEC), db: Session = Depends(get_db)):
    # Contient la masse salariale (financier) -> réservé RH/Direction (_EXEC). Exclut
    # collaborateur, manager et médecine (qui ont des vues dédiées scopées/sans financier).
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
    # Médecine du travail : périmètre bien-être — risques en agrégat anonyme, jamais nominatif (loi 09-08).
    is_med = user.role == ROLE_MEDECINE
    snap = kpi_service.snapshot(db, dept)
    counts = repo.dashboard_counts(db)
    return envelope({
        "headcount": snap["effectifs"],
        "new_hires": counts.get("new_hires"),
        "leaving": counts.get("leaving"),
        "pending_absences": counts.get("pending_absences"),
        "risques": repo.risk_summary(db, dept=dept, anonymize=is_med),
        "indicateurs": {
            "turnover": {"valeur": snap["turnover"]},
            "absenteisme": {"valeur": snap["absenteisme"]},
            "engagement": {"valeur": snap["engagement"]},
            "mobilite": {"valeur": snap["mobilite"]},
        },
        "anomalies": kpi_service.anomalies(db, dept),
        "scope": "team" if dept else "org",
    })


@router.get("/overview")
def dashboard_overview(user: CurrentUser = Depends(_RH_VIEW), db: Session = Depends(get_db)):
    """Vue d'accueil consolidée : 5 blocs (RH global, onboarding/départs, climat social,
    objectifs/évaluations, compétences). Chaque bloc = 4 cartes, chaque carte porte un
    `detail` typé (trend / distribution / list / stat / gauge) pour le mode focus du front.
    Tout est AGRÉGÉ et scopé au périmètre (manager = son département)."""
    from collections import defaultdict
    from datetime import date

    from sqlalchemy import func
    from sqlalchemy import select as _sel

    from app.db.models import (EntretienAnnuel, Employe, EvaluationCompetence, KeyResult,
                               Metier, ModeleTache, Objectif, TacheParcours)

    dept = _dept_for(user, db)
    is_med = user.role == ROLE_MEDECINE
    today = date.today()
    snap = kpi_service.snapshot(db, dept)
    monthly = kpi_service.monthly_series(db, dept)  # séries mensuelles réelles (année courante)
    headcount = snap.get("effectifs") or 0
    mats = list(db.scalars(_sel(Employe.matricule).where(Employe.id_departement == dept))) if dept is not None else None

    def mf(col):
        return (col.in_(mats),) if mats is not None else ()

    def cnt(model, *conds):
        return int(db.scalar(_sel(func.count()).select_from(model).where(*conds)) or 0)

    # Tendances des indicateurs (par période) pour les mini-graphes.
    tre = defaultdict(dict)
    for i in repo.list_indicateurs(db):
        tre[i.type][i.periode] = i.valeur

    def trend(typ):
        d = tre.get(typ, {})
        return [{"label": p, "value": d[p]} for p in sorted(d)]

    risk = repo.risk_summary(db, dept=dept, anonymize=is_med)
    bn = risk.get("by_niveau", {}) or {}

    def tone_lt(v, good, warn):  # plus c'est bas, mieux c'est (turnover, absentéisme…)
        if v is None:
            return "info"
        return "success" if v <= good else ("warning" if v <= warn else "danger")

    def tone_gt(v, good, warn):  # plus c'est haut, mieux c'est (engagement, complétion…)
        if v is None:
            return "info"
        return "success" if v >= good else ("warning" if v >= warn else "danger")

    turnover, absent = snap.get("turnover"), snap.get("absenteisme")
    engagement, mobilite = snap.get("engagement"), snap.get("mobilite")

    # ───────── BLOC 1 · Indicateurs RH globaux ─────────
    block_rh = {
        "id": "rh", "title": "Indicateurs RH globaux", "icon": "activity",
        "cards": [
            {"key": "turnover", "label": "Turnover", "value": turnover, "unit": "%",
             "tone": tone_lt(turnover, 8, 12),
             "detail": {"kind": "stat", "items": [
                 {"label": "Taux de turnover", "value": f"{turnover}%" if turnover is not None else "—"},
                 {"label": "Mobilité interne", "value": f"{mobilite}%" if mobilite is not None else "—"},
                 {"label": "Effectif actif", "value": headcount},
             ], "note": "Rotation du personnel (instantané — pas d'historique mensuel de départs)."}},
            {"key": "absenteisme", "label": "Absentéisme", "value": absent, "unit": "%",
             "tone": tone_lt(absent, 3, 5),
             "detail": {"kind": "trend", "series": monthly["absenteisme"], "unit": "%",
                        "note": "Part du temps de travail perdu pour maladie — par mois de l'année en cours."}},
            {"key": "engagement", "label": "Engagement", "value": engagement, "unit": "%",
             "tone": tone_gt(engagement, 80, 65),
             "detail": {"kind": "trend", "series": monthly["engagement"], "unit": "%",
                        "note": "Indice d'engagement (enquêtes) — par mois de l'année en cours."}},
            {"key": "effectif", "label": "Effectif", "value": headcount, "unit": "",
             "tone": "gold",
             "detail": {"kind": "distribution", "items": [
                 {"label": "Risque faible", "value": bn.get("low", 0), "tone": "success"},
                 {"label": "Risque modéré", "value": bn.get("mid", 0), "tone": "warning"},
                 {"label": "Risque élevé", "value": bn.get("high", 0), "tone": "danger"},
             ], "note": f"{risk.get('total', 0)} collaborateurs analysés (scores de risque)."}},
        ],
    }

    # ───────── BLOC 2 · Onboarding & Départs ─────────
    def parcours_count(typ, *extra):
        return int(db.scalar(
            _sel(func.count()).select_from(TacheParcours)
            .join(ModeleTache, ModeleTache.code_tache == TacheParcours.code_tache)
            .where(ModeleTache.type_parcours == typ, *mf(TacheParcours.matricule), *extra)) or 0)

    new_h = cnt(Employe, Employe.statut == "NEW", *mf(Employe.matricule))
    leaving = cnt(Employe, Employe.statut == "LEAVING", *mf(Employe.matricule))
    ob_total = parcours_count("ONBOARDING")
    ob_done = parcours_count("ONBOARDING", TacheParcours.completed.is_(True))
    ob_rate = round(100 * ob_done / ob_total) if ob_total else 0
    overdue = cnt(TacheParcours, TacheParcours.completed.is_(False),
                  TacheParcours.date_echeance.is_not(None), TacheParcours.date_echeance < today,
                  *mf(TacheParcours.matricule))
    new_list = [{"primary": f"{e.prenom} {e.nom}".strip(), "secondary": e.poste or "—"}
                for e in db.scalars(_sel(Employe).where(Employe.statut == "NEW", *mf(Employe.matricule)).limit(10))]
    leave_list = [{"primary": f"{e.prenom} {e.nom}".strip(), "secondary": e.poste or "—"}
                  for e in db.scalars(_sel(Employe).where(Employe.statut == "LEAVING", *mf(Employe.matricule)).limit(10))]
    ov_rows = db.execute(
        _sel(Employe.prenom, Employe.nom, ModeleTache.libelle, TacheParcours.date_echeance)
        .select_from(TacheParcours)
        .join(ModeleTache, ModeleTache.code_tache == TacheParcours.code_tache)
        .join(Employe, Employe.matricule == TacheParcours.matricule)
        .where(TacheParcours.completed.is_(False), TacheParcours.date_echeance < today,
               *mf(TacheParcours.matricule)).limit(10)).all()
    block_onb = {
        "id": "onboarding", "title": "Onboarding & Départs", "icon": "userPlus",
        "cards": [
            {"key": "new", "label": "Nouveaux arrivants", "value": new_h, "unit": "", "tone": "gold",
             "detail": {"kind": "list", "items": new_list or [{"primary": "Aucun", "secondary": ""}],
                        "note": "Collaborateurs en cours d'intégration."}},
            {"key": "completion", "label": "Complétion onboarding", "value": ob_rate, "unit": "%",
             "tone": tone_gt(ob_rate, 80, 50),
             "detail": {"kind": "gauge", "value": ob_rate, "max": 100, "label": "tâches terminées",
                        "note": f"{ob_done}/{ob_total} tâches d'intégration réalisées."}},
            {"key": "overdue", "label": "Tâches en retard", "value": overdue, "unit": "",
             "tone": tone_lt(overdue, 0, 5),
             "detail": {"kind": "list", "items": [
                 {"primary": f"{p} {n}".strip(), "secondary": lib,
                  "badge": (ech.isoformat() if ech else "")} for (p, n, lib, ech) in ov_rows
             ] or [{"primary": "Aucune tâche en retard", "secondary": ""}],
                        "note": "Tâches de parcours dont l'échéance est dépassée."}},
            {"key": "leaving", "label": "Départs en cours", "value": leaving, "unit": "", "tone": "info",
             "detail": {"kind": "list", "items": leave_list or [{"primary": "Aucun", "secondary": ""}],
                        "note": "Collaborateurs en cours d'offboarding."}},
        ],
    }

    # ───────── BLOC 3 · Climat social ─────────
    hum = repo.humeur_aggregate(db, weeks=8, dept=dept)
    mood = hum.get("score_global")
    if mood is None:
        mood = hum.get("score_satisfaction")
    participation = round(100 * (hum.get("n", 0)) / headcount) if headcount else 0
    dist = hum.get("distribution") or {}
    mood_trend = [{"label": w["semaine"], "value": (round(w["moyenne"] / 3 * 100) if w.get("moyenne") else None)}
                  for w in (hum.get("trend") or []) if not w.get("masque")]
    # Collaborateurs à risque. CONFORMITÉ 09-08 : aucune liste nominative (ni matricule) pour la
    # médecine du travail -> elle ne voit que le COMPTE agrégé, jamais qui est à risque.
    risk_high = (bn.get("high", 0) or 0)
    risk_items = []
    if not is_med:
        for s in (risk.get("top") or []):
            risk_items.append({
                "primary": s.get("employee_name") or s.get("matricule") or "—",
                "secondary": f"{s.get('type', '')} · {round((s.get('valeur') or 0) * 100)}%",
                "badge": s.get("niveau"),
            })
    elif risk_high:
        risk_items = [{"primary": f"{risk_high} collaborateur(s) à risque élevé",
                       "secondary": "détail nominatif réservé aux RH/Direction", "badge": ""}]
    block_climat = {
        "id": "climat", "title": "Climat social", "icon": "heart",
        "cards": [
            {"key": "engagement", "label": "Engagement", "value": engagement, "unit": "%",
             "tone": tone_gt(engagement, 80, 65),
             "detail": {"kind": "trend", "series": monthly["engagement"], "unit": "%",
                        "note": "Indice d'engagement — par mois de l'année en cours."}},
            {"key": "humeur", "label": "Humeur déclarée", "value": mood, "unit": "%",
             "tone": tone_gt(mood, 70, 50) if mood is not None else "info",
             "detail": {"kind": "trend", "series": monthly["humeur"], "unit": "%",
                        "note": "Humeur agrégée et anonymisée — par mois de l'année en cours."}},
            {"key": "risque", "label": "Collaborateurs à risque", "value": risk_high, "unit": "",
             "tone": tone_lt(risk_high, 0, 3),
             "detail": {"kind": "list", "items": risk_items or [{"primary": "Aucun collaborateur à risque élevé", "secondary": ""}],
                        "note": f"Scores de risque élevés (turnover / burnout / désengagement) — périmètre {'équipe' if dept else 'organisation'}."}},
            {"key": "participation", "label": "Participation", "value": participation, "unit": "%",
             "tone": tone_gt(participation, 50, 25),
             "detail": {"kind": "distribution", "items": [
                 {"label": "Satisfait", "value": dist.get("satisfait", 0), "tone": "success"},
                 {"label": "Neutre", "value": dist.get("neutre", 0), "tone": "warning"},
                 {"label": "Insatisfait", "value": dist.get("insatisfait", 0), "tone": "danger"},
             ], "note": f"{hum.get('n', 0)} réponses cette semaine."}},
        ],
    }

    # ───────── BLOC 4 · Objectifs & Évaluations ─────────
    obj_actifs = cnt(Objectif, Objectif.statut == "actif", *mf(Objectif.matricule))
    rows = db.execute(
        _sel(Objectif.id_objectif, func.coalesce(func.avg(KeyResult.progression), 0))
        .select_from(Objectif).join(KeyResult, KeyResult.id_objectif == Objectif.id_objectif, isouter=True)
        .where(*mf(Objectif.matricule)).group_by(Objectif.id_objectif)).all()
    progs = [float(p or 0) for _, p in rows]
    avg_prog = round(sum(progs) / len(progs)) if progs else 0
    atteints = sum(1 for p in progs if p >= 100)
    non_dem = sum(1 for p in progs if p == 0)
    en_cours = sum(1 for p in progs if 0 < p < 100)
    ent_count = cnt(EntretienAnnuel, func.extract("year", EntretienAnnuel.date_entretien) == today.year,
                    *mf(EntretienAnnuel.matricule))
    note_moy = db.scalar(_sel(func.avg(EntretienAnnuel.note_performance_1_5)).where(
        func.extract("year", EntretienAnnuel.date_entretien) == today.year, *mf(EntretienAnnuel.matricule)))
    note_moy = round(float(note_moy), 1) if note_moy is not None else None
    block_okr = {
        "id": "objectifs", "title": "Objectifs & Évaluations", "icon": "target",
        "cards": [
            {"key": "actifs", "label": "Objectifs actifs", "value": obj_actifs, "unit": "", "tone": "gold",
             "detail": {"kind": "distribution", "items": [
                 {"label": "Atteints", "value": atteints, "tone": "success"},
                 {"label": "En cours", "value": en_cours, "tone": "warning"},
                 {"label": "Non démarrés", "value": non_dem, "tone": "danger"},
             ], "note": f"{len(progs)} objectifs au total dans le périmètre."}},
            {"key": "avancement", "label": "Avancement moyen", "value": avg_prog, "unit": "%",
             "tone": tone_gt(avg_prog, 70, 40),
             "detail": {"kind": "gauge", "value": avg_prog, "max": 100, "label": "progression moyenne",
                        "note": "Moyenne des progressions de tous les résultats clés."}},
            {"key": "atteints", "label": "Objectifs atteints", "value": atteints, "unit": "",
             "tone": tone_gt(atteints, max(1, len(progs) // 2), 1) if progs else "info",
             "detail": {"kind": "stat", "items": [
                 {"label": "Atteints (100%)", "value": atteints},
                 {"label": "En cours", "value": en_cours},
                 {"label": "Non démarrés", "value": non_dem},
             ], "note": "Répartition des objectifs par avancement."}},
            {"key": "entretiens", "label": "Entretiens annuels", "value": ent_count, "unit": "", "tone": "info",
             "detail": {"kind": "stat", "items": [
                 {"label": "Entretiens réalisés (année)", "value": ent_count},
                 {"label": "Note moyenne /5", "value": note_moy if note_moy is not None else "—"},
             ], "note": "Campagne d'évaluation annuelle."}},
        ],
    }

    # ───────── BLOC 5 · Compétences ─────────
    ev_total = cnt(EvaluationCompetence, *mf(EvaluationCompetence.matricule))
    ev_valide = cnt(EvaluationCompetence, EvaluationCompetence.statut == "valide", *mf(EvaluationCompetence.matricule))
    ev_pending = cnt(EvaluationCompetence, EvaluationCompetence.statut == "auto", *mf(EvaluationCompetence.matricule))
    taux_valid = round(100 * ev_valide / ev_total) if ev_total else 0
    nb_metiers = cnt(Metier)
    pend_rows = db.execute(
        _sel(Employe.prenom, Employe.nom)
        .select_from(EvaluationCompetence)
        .join(Employe, Employe.matricule == EvaluationCompetence.matricule)
        .where(EvaluationCompetence.statut == "auto", *mf(EvaluationCompetence.matricule)).limit(10)).all()
    block_comp = {
        "id": "competences", "title": "Compétences", "icon": "award",
        "cards": [
            {"key": "evaluees", "label": "Compétences évaluées", "value": ev_total, "unit": "", "tone": "gold",
             "detail": {"kind": "distribution", "items": [
                 {"label": "Validées", "value": ev_valide, "tone": "success"},
                 {"label": "En attente", "value": ev_pending, "tone": "warning"},
             ], "note": "Évaluations de compétences enregistrées."}},
            {"key": "pending", "label": "À valider", "value": ev_pending, "unit": "",
             "tone": tone_lt(ev_pending, 0, 10),
             "detail": {"kind": "list", "items": [
                 {"primary": f"{p} {n}".strip(), "secondary": "auto-évaluation à confirmer"} for (p, n) in pend_rows
             ] or [{"primary": "Rien à valider", "secondary": ""}],
                        "note": "Auto-évaluations en attente de confirmation managériale."}},
            {"key": "taux", "label": "Taux de validation", "value": taux_valid, "unit": "%",
             "tone": tone_gt(taux_valid, 70, 40),
             "detail": {"kind": "gauge", "value": taux_valid, "max": 100, "label": "compétences validées",
                        "note": f"{ev_valide}/{ev_total} évaluations confirmées par un manager."}},
            {"key": "metiers", "label": "Métiers du référentiel", "value": nb_metiers, "unit": "", "tone": "info",
             "detail": {"kind": "stat", "items": [
                 {"label": "Métiers référencés", "value": nb_metiers},
                 {"label": "Compétences évaluées", "value": ev_total},
             ], "note": "Couverture du référentiel de compétences."}},
        ],
    }

    # Médecine du travail (loi 09-08) : cockpit STRICTEMENT bien-être, agrégé/anonyme — on ne
    # renvoie que les indicateurs globaux agrégés + le climat. Les blocs onboarding/départs,
    # objectifs et compétences contiennent des LISTES NOMINATIVES -> jamais exposés à la médecine.
    blocks = ([block_rh, block_climat] if is_med
              else [block_rh, block_onb, block_climat, block_okr, block_comp])
    return envelope({"scope": "team" if dept else "org", "blocks": blocks})


@router.get("/process/{key}")
def dashboard_process(key: str, user: CurrentUser = Depends(_RH_VIEW), db: Session = Depends(get_db)):
    """Écrans consolidés par domaine RH (onglets + cartes synthétiques avec détail focus) :
      - lifecycle  : Onboarding / Offboarding
      - carrieres  : Objectifs / Compétences / Masse salariale (RH-Direction)
      - happiness  : Climat social / Désengagement
    Scopé au périmètre (manager = son département)."""
    from datetime import date
    from fastapi import HTTPException, status as _st
    from sqlalchemy import func
    from sqlalchemy import select as _sel
    from app.db.models import (Competence, Employe, EvaluationCompetence, KeyResult, Metier,
                               ModeleTache, Objectif, ScoreRisque, TacheParcours)

    # Médecine du travail : périmètre bien-être uniquement -> seul l'écran « happiness ».
    if user.role == ROLE_MEDECINE and key != "happiness":
        raise HTTPException(_st.HTTP_403_FORBIDDEN, detail="Hors périmètre (bien-être uniquement).")

    dept = _dept_for(user, db)
    is_exec = user.role in (ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION)
    today = date.today()
    snap = kpi_service.snapshot(db, dept)
    monthly = kpi_service.monthly_series(db, dept)
    risk = repo.risk_summary(db, dept=dept, anonymize=(user.role == ROLE_MEDECINE))
    bn = risk.get("by_niveau", {}) or {}
    mats = list(db.scalars(_sel(Employe.matricule).where(Employe.id_departement == dept))) if dept is not None else None

    def mf(col):
        return (col.in_(mats),) if mats is not None else ()

    def cnt(model, *conds):
        return int(db.scalar(_sel(func.count()).select_from(model).where(*conds)) or 0)

    def tlt(v, g, w):
        return "info" if v is None else ("success" if v <= g else ("warning" if v <= w else "danger"))

    def tgt(v, g, w):
        return "info" if v is None else ("success" if v >= g else ("warning" if v >= w else "danger"))

    def parc(typ, *extra):
        return int(db.scalar(_sel(func.count()).select_from(TacheParcours)
                   .join(ModeleTache, ModeleTache.code_tache == TacheParcours.code_tache)
                   .where(ModeleTache.type_parcours == typ, *mf(TacheParcours.matricule), *extra)) or 0)

    def C(k, label, value, unit, tone, detail):
        return {"key": k, "label": label, "value": value, "unit": unit, "tone": tone, "detail": detail}

    def overdue_list(typ):
        rows = db.execute(
            _sel(Employe.prenom, Employe.nom, ModeleTache.libelle, TacheParcours.date_echeance)
            .select_from(TacheParcours)
            .join(ModeleTache, ModeleTache.code_tache == TacheParcours.code_tache)
            .join(Employe, Employe.matricule == TacheParcours.matricule)
            .where(ModeleTache.type_parcours == typ, TacheParcours.completed.is_(False),
                   TacheParcours.date_echeance.is_not(None), TacheParcours.date_echeance < today,
                   *mf(TacheParcours.matricule)).limit(12)).all()
        return [{"primary": f"{p} {n}".strip(), "secondary": lib,
                 "badge": ech.isoformat() if ech else ""} for (p, n, lib, ech) in rows]

    def pending_evals_list():
        rows = db.execute(
            _sel(Employe.prenom, Employe.nom, Competence.nom)
            .select_from(EvaluationCompetence)
            .join(Employe, Employe.matricule == EvaluationCompetence.matricule)
            .join(Competence, Competence.id_competence == EvaluationCompetence.id_competence)
            .where(EvaluationCompetence.statut == "auto", *mf(EvaluationCompetence.matricule)).limit(15)).all()
        return [{"primary": f"{p} {n}".strip(), "secondary": comp, "badge": "à valider"} for (p, n, comp) in rows]

    if key == "lifecycle":
        new_h = cnt(Employe, Employe.statut == "NEW", *mf(Employe.matricule))
        leaving = cnt(Employe, Employe.statut == "LEAVING", *mf(Employe.matricule))
        ob_t, ob_d = parc("ONBOARDING"), parc("ONBOARDING", TacheParcours.completed.is_(True))
        of_t, of_d = parc("OFFBOARDING"), parc("OFFBOARDING", TacheParcours.completed.is_(True))
        ob_rate = round(100 * ob_d / ob_t) if ob_t else 0
        of_rate = round(100 * of_d / of_t) if of_t else 0
        ob_over = parc("ONBOARDING", TacheParcours.completed.is_(False), TacheParcours.date_echeance.is_not(None), TacheParcours.date_echeance < today)
        of_over = parc("OFFBOARDING", TacheParcours.completed.is_(False), TacheParcours.date_echeance.is_not(None), TacheParcours.date_echeance < today)
        new_list = [{"primary": f"{e.prenom} {e.nom}".strip(), "secondary": e.poste or "—"}
                    for e in db.scalars(_sel(Employe).where(Employe.statut == "NEW", *mf(Employe.matricule)).limit(10))]
        leave_list = [{"primary": f"{e.prenom} {e.nom}".strip(), "secondary": e.poste or "—"}
                      for e in db.scalars(_sel(Employe).where(Employe.statut == "LEAVING", *mf(Employe.matricule)).limit(10))]
        tabs = [
            {"key": "onboarding", "label": "Onboarding", "icon": "userPlus",
             "manage": {"route": "/rh/onboarding", "label": "Gérer l'onboarding"},
             "cards": [
                 C("new", "Nouveaux arrivants", new_h, "", "gold",
                   {"kind": "list", "items": new_list or [{"primary": "Aucun", "secondary": ""}], "note": "Collaborateurs en intégration."}),
                 C("rate", "Complétion", ob_rate, "%", tgt(ob_rate, 80, 50),
                   {"kind": "gauge", "value": ob_rate, "max": 100, "label": "tâches terminées", "note": f"{ob_d}/{ob_t} tâches."}),
                 C("overdue", "Tâches en retard", ob_over, "", tlt(ob_over, 0, 5),
                   {"kind": "list", "items": overdue_list("ONBOARDING") or [{"primary": "Aucune tâche en retard", "secondary": ""}], "note": "Tâches d'onboarding dont l'échéance est dépassée."}),
                 C("flux", "Embauches / mois", new_h, "", "info",
                   {"kind": "trend", "series": monthly["embauches"], "unit": "", "note": "Arrivées par mois de l'année en cours."}),
             ]},
            {"key": "offboarding", "label": "Offboarding", "icon": "userPlus",
             "manage": {"route": "/rh/offboarding", "label": "Gérer l'offboarding"},
             "cards": [
                 C("leaving", "Départs en cours", leaving, "", "warning",
                   {"kind": "list", "items": leave_list or [{"primary": "Aucun", "secondary": ""}], "note": "Collaborateurs en sortie."}),
                 C("rate", "Complétion départ", of_rate, "%", tgt(of_rate, 80, 50),
                   {"kind": "gauge", "value": of_rate, "max": 100, "label": "tâches terminées", "note": f"{of_d}/{of_t} tâches."}),
                 C("overdue", "Tâches en retard", of_over, "", tlt(of_over, 0, 3),
                   {"kind": "list", "items": overdue_list("OFFBOARDING") or [{"primary": "Aucune tâche en retard", "secondary": ""}], "note": "Étapes de sortie en retard."}),
                 C("solde", "Checklist", of_t, "", "info",
                   {"kind": "stat", "items": [{"label": "Tâches définies", "value": of_t}, {"label": "Terminées", "value": of_d}], "note": "Restitution, accès, solde de tout compte."}),
             ]},
        ]

    elif key == "carrieres":
        # Objectifs
        rows = db.execute(_sel(Objectif.id_objectif, func.coalesce(func.avg(KeyResult.progression), 0))
                          .select_from(Objectif).join(KeyResult, KeyResult.id_objectif == Objectif.id_objectif, isouter=True)
                          .where(*mf(Objectif.matricule)).group_by(Objectif.id_objectif)).all()
        progs = [float(p or 0) for _, p in rows]
        avg_prog = round(sum(progs) / len(progs)) if progs else 0
        atteints = sum(1 for p in progs if p >= 100)
        en_cours = sum(1 for p in progs if 0 < p < 100)
        non_dem = sum(1 for p in progs if p == 0)
        obj_actifs = cnt(Objectif, Objectif.statut == "actif", *mf(Objectif.matricule))
        # Compétences
        ev_total = cnt(EvaluationCompetence, *mf(EvaluationCompetence.matricule))
        ev_valide = cnt(EvaluationCompetence, EvaluationCompetence.statut == "valide", *mf(EvaluationCompetence.matricule))
        ev_pending = cnt(EvaluationCompetence, EvaluationCompetence.statut == "auto", *mf(EvaluationCompetence.matricule))
        taux = round(100 * ev_valide / ev_total) if ev_total else 0
        nb_metiers = cnt(Metier)
        tabs = [
            {"key": "objectifs", "label": "Objectifs", "icon": "target",
             "manage": {"route": "/rh/objectifs", "label": "Gérer les objectifs"},
             "cards": [
                 C("actifs", "Objectifs actifs", obj_actifs, "", "gold",
                   {"kind": "distribution", "items": [
                       {"label": "Atteints", "value": atteints, "tone": "success"},
                       {"label": "En cours", "value": en_cours, "tone": "warning"},
                       {"label": "Non démarrés", "value": non_dem, "tone": "danger"}], "note": f"{len(progs)} objectifs."}),
                 C("avg", "Avancement moyen", avg_prog, "%", tgt(avg_prog, 70, 40),
                   {"kind": "gauge", "value": avg_prog, "max": 100, "label": "progression", "note": "Moyenne des résultats clés."}),
                 C("atteints", "Atteints", atteints, "", tgt(atteints, max(1, len(progs) // 2), 1) if progs else "info",
                   {"kind": "stat", "items": [{"label": "Atteints", "value": atteints}, {"label": "En cours", "value": en_cours}, {"label": "Non démarrés", "value": non_dem}], "note": "Répartition par avancement."}),
                 C("total", "Total objectifs", len(progs), "", "info",
                   {"kind": "stat", "items": [{"label": "Total", "value": len(progs)}, {"label": "Actifs", "value": obj_actifs}], "note": "Périmètre courant."}),
             ]},
            {"key": "competences", "label": "Compétences", "icon": "award",
             "manage": {"route": "/rh/competences", "label": "Gérer les compétences"},
             "cards": [
                 C("evaluees", "Compétences évaluées", ev_total, "", "gold",
                   {"kind": "distribution", "items": [
                       {"label": "Validées", "value": ev_valide, "tone": "success"},
                       {"label": "En attente", "value": ev_pending, "tone": "warning"}], "note": "Évaluations enregistrées."}),
                 C("pending", "À valider", ev_pending, "", tlt(ev_pending, 0, 10),
                   {"kind": "list", "items": pending_evals_list() or [{"primary": "Rien à valider", "secondary": ""}], "note": "Auto-évaluations en attente de confirmation managériale."}),
                 C("taux", "Taux de validation", taux, "%", tgt(taux, 70, 40),
                   {"kind": "gauge", "value": taux, "max": 100, "label": "validées", "note": f"{ev_valide}/{ev_total}."}),
                 C("metiers", "Métiers", nb_metiers, "", "info",
                   {"kind": "stat", "items": [{"label": "Métiers référencés", "value": nb_metiers}, {"label": "Compétences évaluées", "value": ev_total}], "note": "Couverture du référentiel."}),
             ]},
        ]
        if is_exec:
            ms = repo.salary_mass(db) if dept is None else None
            ms = ms or {"total": 0, "by_site": []}
            head = snap.get("effectifs") or 1
            avg_sal = round((ms.get("total", 0) or 0) / head) if head else 0
            tabs.append({"key": "masse_salariale", "label": "Masse salariale", "icon": "target",
                         "manage": {"route": "/rh/analytique/masse-salariale", "label": "Ouvrir la masse salariale"},
                         "cards": [
                             C("total", "Masse salariale", round(ms.get("total", 0) or 0), "MAD", "gold",
                               {"kind": "stat", "items": [{"label": "Annuelle", "value": f"{round(ms.get('total',0) or 0):,}".replace(",", " ") + " MAD"}], "note": "Somme des derniers salaires connus."}),
                             C("moyen", "Salaire moyen", avg_sal, "MAD", "info",
                               {"kind": "stat", "items": [{"label": "Moyen / collaborateur", "value": f"{avg_sal:,}".replace(",", " ") + " MAD"}, {"label": "Effectif", "value": head}], "note": "Moyenne annuelle."}),
                             C("mobilite", "Mobilité interne", snap.get("mobilite"), "%", tgt(snap.get("mobilite"), 8, 3),
                               {"kind": "trend", "series": monthly["mobilite"], "unit": "%", "note": "Promotions par mois."}),
                             C("sites", "Par site", len(ms.get("by_site", [])), "", "info",
                               {"kind": "distribution", "items": [
                                   {"label": s["site"], "value": round((s.get("montant", 0) or 0) / 1000), "tone": "gold"} for s in ms.get("by_site", [])
                               ] or [{"label": "—", "value": 0, "tone": "gold"}], "note": "Masse salariale par site (k MAD)."}),
                         ]})
        # Analyse carrières (graphes de tendance) — exclue de la médecine du travail.
        if user.role != ROLE_MEDECINE:
            ct = kpi_service.career_trends(db, dept)
            pc = kpi_service.poste_comparison(db, dept)
            tabs.append({"key": "analyse", "label": "Analyse carrières", "icon": "target",
                         "manage": {"route": "/rh/analytique/predictif", "label": "Analytique avancée"},
                         "cards": [
                             C("evo", "Salaire vs Compétences", "↗", "", "gold",
                               {"kind": "multitrend", "series": ct["series"],
                                "lines": [{"key": "salaire", "label": "Salaire (indice 100)", "color": "var(--gold)"},
                                          {"key": "competences", "label": "Compétences (indice 100)", "color": "var(--info)"}],
                                "note": "Évolution comparée (base 100) du salaire moyen et du niveau de compétences validé, par trimestre."}),
                             C("equite", f"Équité · {pc.get('poste') or '—'}", len(pc.get("points", [])), "",
                               "info",
                               {"kind": "scatter", "points": pc.get("points", []), "xKey": "competence", "yKey": "salaire",
                                "nameKey": "nom", "xLabel": "Compétences (1-5)", "yLabel": "Salaire (MAD)",
                                "note": f"Salaire vs compétences des collaborateurs du poste « {pc.get('poste') or '—'} »."}),
                         ]})

    elif key == "happiness":
        engagement = snap.get("engagement")
        hum = repo.humeur_aggregate(db, weeks=8, dept=dept)
        mood = hum.get("score_global")
        if mood is None:
            mood = hum.get("score_satisfaction")
        dist = hum.get("distribution") or {}
        headcount = snap.get("effectifs") or 0
        participation = round(100 * (hum.get("n", 0)) / headcount) if headcount else 0
        is_med = user.role == ROLE_MEDECINE
        risk_items = []
        if not is_med:  # médecine : jamais de liste nominative (loi 09-08)
            for s in (risk.get("top") or []):
                risk_items.append({"primary": s.get("employee_name") or s.get("matricule") or "—",
                                   "secondary": f"{s.get('type', '')} · {round((s.get('valeur') or 0) * 100)}%", "badge": s.get("niveau")})
        elif bn.get("high", 0):
            risk_items = [{"primary": f"{bn.get('high', 0)} collaborateur(s) à risque élevé",
                           "secondary": "détail nominatif réservé aux RH/Direction", "badge": ""}]
        tabs = [
            {"key": "climat", "label": "Climat social", "icon": "heart",
             "manage": {"route": "/rh/climat", "label": "Ouvrir le climat social"},
             "cards": [
                 C("engagement", "Engagement", engagement, "%", tgt(engagement, 80, 65),
                   {"kind": "trend", "series": monthly["engagement"], "unit": "%", "note": "Engagement par mois."}),
                 C("humeur", "Humeur déclarée", mood if mood is not None else "—", "%", tgt(mood, 70, 50) if mood is not None else "info",
                   {"kind": "trend", "series": monthly["humeur"], "unit": "%", "note": "Humeur agrégée/anonymisée par mois."}),
                 C("participation", "Participation", participation, "%", tgt(participation, 50, 25),
                   {"kind": "distribution", "items": [
                       {"label": "Satisfait", "value": dist.get("satisfait", 0), "tone": "success"},
                       {"label": "Neutre", "value": dist.get("neutre", 0), "tone": "warning"},
                       {"label": "Insatisfait", "value": dist.get("insatisfait", 0), "tone": "danger"}], "note": f"{hum.get('n', 0)} réponses cette semaine."}),
                 C("absenteisme", "Absentéisme", snap.get("absenteisme"), "%", tlt(snap.get("absenteisme"), 3, 5),
                   {"kind": "trend", "series": monthly["absenteisme"], "unit": "%", "note": "Absentéisme par mois."}),
             ]},
            {"key": "desengagement", "label": "Désengagement", "icon": "activity",
             "manage": {"route": "/rh/desengagement", "label": "Ouvrir le désengagement"},
             "cards": [
                 C("high", "Collaborateurs à risque", bn.get("high", 0), "", tlt(bn.get("high", 0), 0, 3),
                   {"kind": "list", "items": risk_items or [{"primary": "Aucun risque élevé", "secondary": ""}], "note": "Scores de risque élevés."}),
                 C("total", "Scores analysés", risk.get("total", 0), "", "info",
                   {"kind": "distribution", "items": [
                       {"label": "Faible", "value": bn.get("low", 0), "tone": "success"},
                       {"label": "Modéré", "value": bn.get("mid", 0), "tone": "warning"},
                       {"label": "Élevé", "value": bn.get("high", 0), "tone": "danger"}], "note": "Répartition par niveau de risque."}),
                 C("turnover", "Turnover", snap.get("turnover"), "%", tlt(snap.get("turnover"), 8, 12),
                   {"kind": "stat", "items": [{"label": "Turnover", "value": f"{snap.get('turnover')}%"}, {"label": "Mobilité", "value": f"{snap.get('mobilite')}%"}], "note": "Indicateurs de rétention."}),
                 C("engagement", "Engagement", engagement, "%", tgt(engagement, 80, 65),
                   {"kind": "trend", "series": monthly["engagement"], "unit": "%", "note": "Engagement par mois."}),
             ]},
        ]
    else:
        raise HTTPException(_st.HTTP_404_NOT_FOUND, detail="Domaine inconnu.")

    # Sous-titre synthétique + indicateur d'en-tête (1re carte) pour les onglets-cartes du front.
    _SUB = {
        "onboarding": "Intégration des nouveaux arrivants",
        "offboarding": "Sorties, restitutions et solde de tout compte",
        "objectifs": "Suivi des OKR de la période",
        "competences": "Évaluation et validation des compétences",
        "masse_salariale": "Rémunération globale et par site",
        "analyse": "Tendances et équité de carrière",
        "climat": "Engagement, humeur et participation",
        "desengagement": "Risques de départ et signaux faibles",
    }
    for tb in tabs:
        tb["subtitle"] = _SUB.get(tb["key"], "")
        first = (tb.get("cards") or [None])[0]
        if first:
            tb["headline"] = {"value": first.get("value"), "unit": first.get("unit", ""),
                              "tone": first.get("tone", "info"), "label": first.get("label")}

    return envelope({"key": key, "scope": "team" if dept else "org", "tabs": tabs})


@router.get("/compare")
def dashboard_compare(metric: str = Query("salaire"), matricules: str = Query(""),
                      user: CurrentUser = Depends(_RH_VIEW), db: Session = Depends(get_db)):
    """Comparaison multi-collaborateurs (1 courbe par collaborateur), métrique salaire ou compétences.
    Manager : restreint à son équipe. Médecine : exclue."""
    from fastapi import HTTPException, status as _st
    from sqlalchemy import select as _sel
    from app.db.models import Employe
    if user.role == ROLE_MEDECINE:
        raise HTTPException(_st.HTTP_403_FORBIDDEN, detail="Hors périmètre.")
    mats = [m.strip() for m in matricules.split(",") if m.strip()][:8]
    dept = _dept_for(user, db)
    if dept is not None:  # manager : uniquement son équipe
        team = set(db.scalars(_sel(Employe.matricule).where(Employe.id_departement == dept)))
        mats = [m for m in mats if m in team]
    metric = "competences" if metric == "competences" else "salaire"
    return envelope(kpi_service.compare_series(db, mats, metric))


@router.get("/projection")
def dashboard_projection(
    months: int = Query(12, ge=1, le=36),
    turnover_pct: float | None = Query(None),
    hiring_per_month: int = Query(0, ge=0),
    raise_pct: float = Query(0.0),
    absenteisme_pct: float | None = Query(None),
    mobilite_pct: float | None = Query(None),
    user: CurrentUser = Depends(_NO_MED), db: Session = Depends(get_db),
):
    """Projection / simulation « what-if » des effectifs, masse salariale, absentéisme
    (jours perdus + coût) et mobilité interne (mouvements attendus)."""
    dept = _dept_for(user, db)
    return envelope(kpi_service.projection(
        db, months=months, turnover_pct=turnover_pct, hiring_per_month=hiring_per_month,
        raise_pct=raise_pct, absenteisme_pct=absenteisme_pct, mobilite_pct=mobilite_pct, dept=dept))


@router.get("/analytics")
def dashboard_analytics(user: CurrentUser = Depends(_EXEC), db: Session = Depends(get_db)):
    """Pyramide des âges (par genre), répartition par site, masse salariale — dynamiques.
    Données consolidées/FINANCIÈRES réservées RH/Direction (_EXEC) : exclut le manager et la
    médecine du travail (périmètre bien-être / pas de financier, loi 09-08)."""
    dept = _dept_for(user, db)
    return envelope({
        "pyramide": kpi_service.pyramide(db, dept),
        "sites": repo.headcount_by_site(db, dept=dept),
        "masse_salariale": {**kpi_service.masse_salariale(db, dept), "total": kpi_service.masse_salariale(db, dept)["annuelle"]},
    })


@router.get("/by-departement")
def dashboard_by_departement(_: CurrentUser = Depends(_EXEC), db: Session = Depends(get_db)):
    """Cockpit consolidé : KPIs clés (effectif, turnover, absentéisme, engagement) PAR département."""
    ckey = "dashboard:bydept"
    data = redis_cache.get(ckey)
    if data is None:
        data = []
        for d in repo.list_departements(db):
            snap = kpi_service.snapshot(db, d.id_departement)
            data.append({"departement": d.nom, "effectif": snap["effectifs"],
                         "turnover": snap["turnover"], "absenteisme": snap["absenteisme"],
                         "engagement": snap["engagement"]})
        redis_cache.set(ckey, data, ttl=settings.DASHBOARD_CACHE_TTL)
    return envelope(data, meta={"total": len(data)})


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
def calculate_risques(_: CurrentUser = Depends(_NO_MED), db: Session = Depends(get_db)):
    """Recalcule les scores de risque (règles métier burnout + turnover)."""
    summary = risk_calculator.recompute(db)
    redis_cache.delete("dashboard:kpis:all")
    return envelope(summary)


@router.get("/risques")
def dashboard_risques(
    niveau: str | None = Query(None),
    type_: str | None = Query(None, alias="type"),
    user: CurrentUser = Depends(_NO_MED),
    db: Session = Depends(get_db),
):
    dept = _dept_for(user, db)
    rows = repo.list_scores(db, niveau=niveau, type=type_, department_id=dept)
    return envelope([s.to_dict() for s in rows], meta={"total": len(rows)})
