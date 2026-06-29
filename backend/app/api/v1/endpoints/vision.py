"""Vision Collaborateur 360 — vue consolidée d'UN collaborateur (en-tête + onglets).

RBAC (vision_guard) :
  - ADMIN / RH / DIRECTION : accès à tout collaborateur ;
  - MANAGER : uniquement les membres de SON département (404 hors périmètre) ;
  - MEDECINE : exclue (403) — son périmètre est le bien-être agrégé, pas la fiche individuelle.

Conformité (loi 09-08) :
  - le SALAIRE n'est inclus dans le payload que pour RH/DIRECTION (ABAC) ;
  - le CLIMAT d'un collaborateur est montré AGRÉGÉ/ANONYMISÉ au niveau de son département
    (seuil min_n) — jamais son humeur individuelle ; la participation est réduite à un booléen ;
  - les absences MALADIE sont affichées SANS motif/diagnostic ; le dossier (CIN/adresse) n'est jamais exposé.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN, ROLE_DIRECTION, ROLE_MANAGER, ROLE_MEDECINE, ROLE_RH,
    CurrentUser, get_current_user,
)
from app.db import repository as repo
from app.db.base import get_db
from app.schemas.common import envelope
from app.services import kpi_service

router = APIRouter()

_FULL = {ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION}
# Rôles autorisés à consulter une fiche 360 (encadrement). Médecine & collaborateur exclus.
_ALLOWED = {ROLE_ADMIN, ROLE_RH, ROLE_DIRECTION, ROLE_MANAGER}


def _caller_dept(user: CurrentUser, db: Session):
    if user.role == ROLE_MANAGER:
        emp = repo.find_employee_by_email(db, user.email)
        return emp.id_departement if emp else None
    return None


def vision_guard(matricule: str, user: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """Charge l'employé en vérifiant le périmètre d'accès. Renvoie l'employé."""
    if user.role not in _ALLOWED:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès réservé à l'encadrement RH.")
    emp = repo.get_employee(db, matricule)
    if emp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Collaborateur introuvable.")
    if user.role == ROLE_MANAGER:
        dept = _caller_dept(user, db)
        if dept is None or emp.id_departement != dept:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Hors de votre périmètre.")
    return emp


def _tone_gt(v, good, warn):
    if v is None:
        return "info"
    return "success" if v >= good else ("warning" if v >= warn else "danger")


def _tone_lt(v, good, warn):
    if v is None:
        return "info"
    return "success" if v <= good else ("warning" if v <= warn else "danger")


def _anciennete_mois(emp) -> int | None:
    if not emp.date_embauche:
        return None
    d = date.today()
    return (d.year - emp.date_embauche.year) * 12 + (d.month - emp.date_embauche.month)


def _top_score(db, matricule, type_=None):
    from app.db.models import ScoreRisque
    stmt = select(ScoreRisque).where(ScoreRisque.matricule == matricule)
    if type_:
        stmt = stmt.where(ScoreRisque.type == type_)
    return db.scalars(stmt.order_by(ScoreRisque.valeur.desc())).first()


# ───────────────────────── Recherche (scopée au périmètre) ─────────────────────────
@router.get("/search")
def vision_search(q: str = Query("", min_length=0), user: CurrentUser = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """Recherche de collaborateurs pour ouvrir une fiche 360 (scopée : manager = son équipe)."""
    if user.role not in _ALLOWED:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Accès réservé à l'encadrement RH.")
    dept = _caller_dept(user, db) if user.role == ROLE_MANAGER else None
    # gsearch_employees renvoie des dicts {id (matricule), title (nom complet), subtitle}.
    rows = repo.gsearch_employees(db, q, dept_id=dept, limit=8)
    out = [{"matricule": r.get("id"), "nom": r.get("title"), "poste": r.get("subtitle")} for r in rows]
    return envelope(out, meta={"total": len(out)})


# ───────────────────────── En-tête synthétique ─────────────────────────
@router.get("/{matricule}/header")
def vision_header(matricule: str, emp=Depends(vision_guard), db: Session = Depends(get_db)):
    niveau = repo.current_career_level(db, matricule)
    top = _top_score(db, matricule)
    return envelope({
        "matricule": emp.matricule,
        "nom": f"{emp.prenom} {emp.nom}".strip(),
        "poste": emp.poste,
        "departement": emp.department.nom if emp.department else None,
        "statut": emp.statut,
        "site": emp.site,
        "anciennete_mois": _anciennete_mois(emp),
        "date_embauche": emp.date_embauche.isoformat() if emp.date_embauche else None,
        "manager_nom": (f"{emp.manager.prenom} {emp.manager.nom}" if emp.manager else None),
        "niveau_carriere": niveau,
        "risque": ({"niveau": top.niveau, "valeur": round((top.valeur or 0) * 100)} if top else None),
    })


# ───────────────────────── Onglet Synthèse ─────────────────────────
@router.get("/{matricule}/synthese")
def vision_synthese(matricule: str, emp=Depends(vision_guard),
                    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    niveau = repo.current_career_level(db, matricule)
    objs = repo.list_objectifs(db, matricule) or []
    progs = []
    for o in objs:
        krs = getattr(o, "key_results", []) or []
        if krs:
            progs.append(sum((k.progression or 0) for k in krs) / len(krs))
    avg_prog = round(sum(progs) / len(progs)) if progs else 0
    anc = _anciennete_mois(emp)
    cards = [
        {"key": "profil", "label": "Profil & ancienneté", "value": (round(anc / 12, 1) if anc is not None else "—"),
         "unit": "ans", "tone": "gold",
         "detail": {"kind": "stat", "items": [
             {"label": "Poste", "value": emp.poste or "—"},
             {"label": "Département", "value": (emp.department.nom if emp.department else "—")},
             {"label": "Site", "value": emp.site or "—"},
             {"label": "Statut", "value": emp.statut},
         ], "note": f"Entré le {emp.date_embauche.isoformat() if emp.date_embauche else '—'}."}},
        {"key": "niveau", "label": "Niveau de carrière", "value": niveau or "—", "unit": "", "tone": "info",
         "detail": {"kind": "stat", "items": [
             {"label": "Niveau de poste", "value": niveau or "Non atteint"},
             {"label": "Manager", "value": (f"{emp.manager.prenom} {emp.manager.nom}" if emp.manager else "—")},
         ], "note": "Niveau atteint via les compétences validées par le manager."}},
        {"key": "objectifs", "label": "Avancement objectifs", "value": avg_prog, "unit": "%",
         "tone": _tone_gt(avg_prog, 70, 40),
         "detail": {"kind": "gauge", "value": avg_prog, "max": 100, "label": "progression moyenne",
                    "note": f"{len(objs)} objectif(s) suivis."}},
    ]
    # Rémunération : UNIQUEMENT RH/DIRECTION (ABAC) — sinon la donnée n'est pas dans le payload.
    if user.role in (ROLE_RH, ROLE_DIRECTION):
        sal = repo.get_latest_salary(db, matricule)
        montant = float(sal.montant) if sal else None
        cards.append({
            "key": "remuneration", "label": "Rémunération", "value": (round(montant) if montant else "—"),
            "unit": "€", "tone": "gold",
            "detail": {"kind": "stat", "items": [
                {"label": "Dernier salaire", "value": (f"{round(montant):,}".replace(",", " ") + " €") if montant else "—"},
                {"label": "Effet", "value": (sal.date_effet.isoformat() if sal and sal.date_effet else "—")},
                {"label": "Motif", "value": (sal.motif if sal else "—")},
            ], "note": "Donnée confidentielle — accès RH/Direction, tracé."}})
        et = kpi_service.employee_trends(db, matricule)
        cards.append({
            "key": "evo_sal", "label": "Évolution salariale", "value": len(et["salaire"]), "unit": "", "tone": "gold",
            "detail": {"kind": "trend", "series": et["salaire"], "unit": "",
                       "note": "Historique de la rémunération du collaborateur (confidentiel — RH/Direction)."}})
    return envelope({"cards": cards})


# ───────────────────────── Onglet Onboarding / Offboarding ─────────────────────────
def _parcours_cards(db, matricule):
    today = date.today()
    on = repo.list_taches(db, matricule, "ONBOARDING") or []
    off = repo.list_taches(db, matricule, "OFFBOARDING") or []

    def lbl(tk):
        return (tk.modele.libelle if getattr(tk, "modele", None) else tk.code_tache)
    on_done = sum(1 for tk in on if tk.completed)
    rate = round(100 * on_done / len(on)) if on else 0
    overdue = [tk for tk in (on + off) if not tk.completed and tk.date_echeance and tk.date_echeance < today]
    upcoming = sorted([tk for tk in (on + off) if not tk.completed and tk.date_echeance and tk.date_echeance >= today],
                      key=lambda x: x.date_echeance)
    return [
        {"key": "completion", "label": "Complétion onboarding", "value": rate, "unit": "%",
         "tone": _tone_gt(rate, 80, 50),
         "detail": {"kind": "gauge", "value": rate, "max": 100, "label": "tâches terminées",
                    "note": f"{on_done}/{len(on)} tâches d'intégration réalisées."}},
        {"key": "overdue", "label": "Tâches en retard", "value": len(overdue), "unit": "",
         "tone": _tone_lt(len(overdue), 0, 3),
         "detail": {"kind": "list", "items": [
             {"primary": lbl(tk), "secondary": "en retard", "badge": tk.date_echeance.isoformat()} for tk in overdue
         ] or [{"primary": "Aucune tâche en retard", "secondary": ""}], "note": "Échéances dépassées."}},
        {"key": "offboarding", "label": "Checklist départ", "value": len(off), "unit": "", "tone": "info",
         "detail": {"kind": "list", "items": [
             {"primary": lbl(tk), "secondary": ("terminé" if tk.completed else "à faire"),
              "badge": ("✓" if tk.completed else "")} for tk in off
         ] or [{"primary": "Pas d'offboarding en cours", "secondary": ""}], "note": "Étapes de sortie."}},
        {"key": "upcoming", "label": "Étapes à venir", "value": len(upcoming), "unit": "", "tone": "gold",
         "detail": {"kind": "list", "items": [
             {"primary": lbl(tk), "secondary": tk.type_parcours if hasattr(tk, "type_parcours") else "",
              "badge": tk.date_echeance.isoformat()} for tk in upcoming[:10]
         ] or [{"primary": "Aucune étape planifiée", "secondary": ""}], "note": "Prochaines échéances."}},
    ]


@router.get("/{matricule}/lifecycle")
def vision_lifecycle(matricule: str, emp=Depends(vision_guard), db: Session = Depends(get_db)):
    return envelope({"cards": _parcours_cards(db, matricule)})


# ───────────────────────── Onglet Climat (agrégé/anonymisé au département) ─────────────────────────
@router.get("/{matricule}/climat")
def vision_climat(matricule: str, emp=Depends(vision_guard), db: Session = Depends(get_db)):
    dept = emp.id_departement
    hum = repo.humeur_aggregate(db, weeks=12, dept=dept)
    monthly = kpi_service.monthly_series(db, dept)
    dist = hum.get("distribution") or {}
    masked = dist == {} or dist is None
    score = hum.get("score_global")
    if score is None:
        score = hum.get("score_satisfaction")
    # Participation INDIVIDUELLE réduite à un booléen (jamais le niveau d'humeur).
    mine = repo.my_humeur(db, matricule) if hasattr(repo, "my_humeur") else None
    iso = date.today().isocalendar()
    cur_week = f"{iso[0]}-W{iso[1]:02d}"
    a_repondu = bool(mine and any((getattr(h, "semaine", None) == cur_week) for h in (mine if isinstance(mine, list) else [])))
    deseng = _top_score(db, matricule, "desengagement") or _top_score(db, matricule)
    cards = [
        {"key": "climat_dept", "label": "Climat du département", "value": (score if score is not None else "—"),
         "unit": "%", "tone": _tone_gt(score, 70, 50) if score is not None else "info",
         "detail": {"kind": "trend", "series": monthly["humeur"], "unit": "%",
                    "note": "Climat AGRÉGÉ et ANONYMISÉ du département — par mois (jamais l'humeur individuelle)."}},
        {"key": "distribution", "label": "Distribution (département)", "value": (hum.get("n", 0)), "unit": "",
         "tone": "info",
         "detail": ({"kind": "stat", "items": [{"label": "Anonymat", "value": "données insuffisantes"}],
                     "note": "Effectif répondant trop faible pour anonymiser (seuil non atteint)."} if masked else
                    {"kind": "distribution", "items": [
                        {"label": "Satisfait", "value": dist.get("satisfait", 0), "tone": "success"},
                        {"label": "Neutre", "value": dist.get("neutre", 0), "tone": "warning"},
                        {"label": "Insatisfait", "value": dist.get("insatisfait", 0), "tone": "danger"},
                    ], "note": f"{hum.get('n', 0)} réponses cette semaine (anonymisé)."})},
        {"key": "participation", "label": "Participation", "value": ("Oui" if a_repondu else "Non"), "unit": "",
         "tone": "success" if a_repondu else "warning",
         "detail": {"kind": "stat", "items": [
             {"label": "A répondu cette semaine", "value": ("Oui" if a_repondu else "Non")},
         ], "note": "Indicateur binaire de participation — le contenu/niveau n'est jamais exposé."}},
        {"key": "desengagement", "label": "Risque désengagement",
         "value": (round((deseng.valeur or 0) * 100) if deseng else 0), "unit": "%",
         "tone": _tone_lt(round((deseng.valeur or 0) * 100) if deseng else 0, 30, 60),
         "detail": {"kind": "gauge", "value": (round((deseng.valeur or 0) * 100) if deseng else 0), "max": 100,
                    "label": (deseng.niveau if deseng else "—"),
                    "note": "Score de risque de désengagement (modèle ML, sous responsabilité humaine)."}},
    ]
    return envelope({"cards": cards})


# ───────────────────────── Onglet Compétences ─────────────────────────
@router.get("/{matricule}/competences")
def vision_competences(matricule: str, emp=Depends(vision_guard), db: Session = Depends(get_db)):
    radar = repo.competence_radar(db, matricule) or {"items": []}
    evals = [e.to_dict() for e in (repo.evaluations_for(db, matricule) or [])]
    valide = sum(1 for e in evals if e.get("statut") == "valide")
    total = len(evals)
    pending = [e for e in evals if e.get("statut") == "auto"]
    taux = round(100 * valide / total) if total else 0
    traj = repo.trajectoire_carriere(db, matricule) or {"niveaux": [], "niveau_actuel": None}
    radar_items = [{"axis": (i.get("competence") or "—"), "attendu": i.get("attendu", 0), "actuel": i.get("actuel", 0)}
                   for i in (radar.get("items") or [])][:8]
    cards = [
        {"key": "radar", "label": "Maîtrise des compétences", "value": len(radar_items), "unit": "", "tone": "gold",
         "detail": {"kind": "radar", "series": radar_items,
                    "note": f"Métier : {radar.get('metier') or '—'} — attendu vs niveau actuel."}},
        {"key": "pending", "label": "Évaluations à valider", "value": len(pending), "unit": "",
         "tone": _tone_lt(len(pending), 0, 5),
         "detail": {"kind": "list", "items": [
             {"primary": e.get("competence") or "—", "secondary": f"auto-éval niveau {e.get('niveau') or '?'}"} for e in pending
         ] or [{"primary": "Rien à valider", "secondary": ""}], "note": "Auto-évaluations en attente de confirmation."}},
        {"key": "taux", "label": "Taux de validation", "value": taux, "unit": "%",
         "tone": _tone_gt(taux, 70, 40),
         "detail": {"kind": "gauge", "value": taux, "max": 100, "label": "compétences validées",
                    "note": f"{valide}/{total} évaluations confirmées."}},
        {"key": "trajectoire", "label": "Trajectoire de carrière", "value": (traj.get("niveau_actuel") or "—"), "unit": "",
         "tone": "info",
         "detail": {"kind": "list", "items": [
             {"primary": n, "secondary": ("niveau actuel" if n == traj.get("niveau_actuel") else "palier"),
              "badge": ("●" if n == traj.get("niveau_actuel") else "")} for n in (traj.get("niveaux") or [])
         ] or [{"primary": "Référentiel non défini", "secondary": ""}], "note": "Paliers d'évolution du métier."}},
        {"key": "evo_comp", "label": "Évolution des compétences",
         "value": len([x for x in kpi_service.employee_trends(db, matricule)["competences"] if x["value"] is not None]),
         "unit": "", "tone": "info",
         "detail": {"kind": "trend", "series": kpi_service.employee_trends(db, matricule)["competences"], "unit": "",
                    "note": "Niveau moyen de compétences validé par trimestre."}},
    ]
    return envelope({"cards": cards})


# ───────────────────────── Onglet Objectifs ─────────────────────────
@router.get("/{matricule}/objectifs")
def vision_objectifs(matricule: str, emp=Depends(vision_guard), db: Session = Depends(get_db)):
    objs = repo.list_objectifs(db, matricule) or []
    rows = []
    for o in objs:
        krs = getattr(o, "key_results", []) or []
        p = round(sum((k.progression or 0) for k in krs) / len(krs)) if krs else 0
        rows.append((o, p, krs))
    progs = [p for _, p, _ in rows]
    avg = round(sum(progs) / len(progs)) if progs else 0
    atteints = sum(1 for p in progs if p >= 100)
    en_cours = sum(1 for p in progs if 0 < p < 100)
    non_dem = sum(1 for p in progs if p == 0)
    krs_all = []
    for o, p, krs in rows:
        for k in krs:
            krs_all.append({"primary": k.libelle, "secondary": f"{o.titre}", "badge": f"{k.progression or 0}%"})
    bilans = repo.list_bilans(db, matricule) or []
    cards = [
        {"key": "actifs", "label": "Objectifs actifs", "value": sum(1 for o, _, _ in rows if o.statut == "actif"),
         "unit": "", "tone": "gold",
         "detail": {"kind": "distribution", "items": [
             {"label": "Atteints", "value": atteints, "tone": "success"},
             {"label": "En cours", "value": en_cours, "tone": "warning"},
             {"label": "Non démarrés", "value": non_dem, "tone": "danger"},
         ], "note": f"{len(rows)} objectif(s) au total."}},
        {"key": "avancement", "label": "Avancement moyen", "value": avg, "unit": "%",
         "tone": _tone_gt(avg, 70, 40),
         "detail": {"kind": "gauge", "value": avg, "max": 100, "label": "progression moyenne",
                    "note": "Moyenne des résultats clés."}},
        {"key": "kr", "label": "Résultats clés", "value": len(krs_all), "unit": "", "tone": "info",
         "detail": {"kind": "list", "items": krs_all or [{"primary": "Aucun résultat clé", "secondary": ""}],
                    "note": "Progression de chaque résultat clé."}},
        {"key": "bilans", "label": "Bilans de période", "value": len(bilans), "unit": "", "tone": "info",
         "detail": {"kind": "list", "items": [
             {"primary": b.periode or b.type_bilan, "secondary": (b.points_forts or b.synthese or "—")[:80]} for b in bilans
         ] or [{"primary": "Aucun bilan", "secondary": ""}], "note": "Synthèses et points forts."}},
    ]
    return envelope({"cards": cards})


# ───────────────────────── Onglet Activité & demandes ─────────────────────────
@router.get("/{matricule}/activite")
def vision_activite(matricule: str, emp=Depends(vision_guard), db: Session = Depends(get_db)):
    absences = repo.list_absences(db, employee_id=matricule) or []
    solde = repo.leave_balance(db, matricule)
    feedbacks = repo.list_feedbacks(db, matricule, limit=20) or []
    try:
        alertes = [a for a in (repo.list_alertes_prioritized(db, limit=200) or []) if getattr(a, "matricule", None) == matricule]
    except Exception:
        alertes = []

    def abs_label(d):
        # MALADIE affiché SANS motif/diagnostic.
        return d.code_type
    cards = [
        {"key": "absences", "label": "Absences récentes", "value": len(absences), "unit": "", "tone": "info",
         "detail": {"kind": "list", "items": [
             {"primary": abs_label(d), "secondary": f"{d.date_debut.isoformat() if d.date_debut else '—'} → {d.date_fin.isoformat() if d.date_fin else '—'}",
              "badge": d.statut} for d in absences[:12]
         ] or [{"primary": "Aucune absence", "secondary": ""}], "note": "Type uniquement (motif médical non exposé)."}},
        {"key": "conges", "label": "Solde congés", "value": solde.get("restant", 0), "unit": "j",
         "tone": _tone_gt(solde.get("restant", 0), 5, 0),
         "detail": {"kind": "stat", "items": [
             {"label": "Alloué", "value": f"{solde.get('alloue', 0)} j"},
             {"label": "Pris", "value": f"{solde.get('pris', 0)} j"},
             {"label": "Restant", "value": f"{solde.get('restant', 0)} j"},
         ], "note": f"Année {solde.get('annee')}."}},
        {"key": "feedbacks", "label": "Feedbacks continus", "value": len(feedbacks), "unit": "", "tone": "gold",
         "detail": {"kind": "list", "items": [
             {"primary": (f.commentaire or f.categorie or "Feedback"), "secondary": (f.categorie or ""),
              "badge": (f"{f.note_1_5}/5" if f.note_1_5 else "")} for f in feedbacks
         ] or [{"primary": "Aucun feedback", "secondary": ""}], "note": "Signaux continus (managers/pairs)."}},
        {"key": "alertes", "label": "Alertes opérationnelles", "value": len(alertes), "unit": "",
         "tone": _tone_lt(len(alertes), 0, 2),
         "detail": {"kind": "list", "items": [
             {"primary": (a.message or "Alerte"), "secondary": (a.categorie or ""), "badge": (a.gravite or "")} for a in alertes[:12]
         ] or [{"primary": "Aucune alerte", "secondary": ""}], "note": "Alertes liées au collaborateur."}},
    ]
    return envelope({"cards": cards})
