"""KPIs RH calculés DYNAMIQUEMENT sur l'ensemble de la base (1000+ employés).

Remplace les valeurs factices d'IndicateurRH par de vraies agrégations SQLAlchemy.
Toutes les fonctions acceptent un `id_departement` optionnel (vue globale vs équipe).
"""

from datetime import date, timedelta

from sqlalchemy import func, select

WORKDAYS_MONTH = 22


def _dept_matricules(db, dept):
    """Renvoie l'ensemble des matricules d'un département, ou None (= toute l'entreprise)."""
    from app.db.models import Employe
    if dept is None:
        return None
    return set(db.scalars(select(Employe.matricule).where(Employe.id_departement == dept)))


def effectifs(db, dept=None) -> int:
    from app.db.models import Employe
    stmt = select(func.count(Employe.matricule)).where(Employe.statut == "ACTIVE")
    if dept is not None:
        stmt = stmt.where(Employe.id_departement == dept)
    return int(db.scalar(stmt) or 0)


def turnover(db, dept=None) -> float:
    """Taux de départ = LEAVING / (ACTIVE + LEAVING) en %."""
    from app.db.models import Employe
    base = select(func.count(Employe.matricule))
    if dept is not None:
        base = base.where(Employe.id_departement == dept)
    leaving = int(db.scalar(base.where(Employe.statut == "LEAVING")) or 0)
    active = int(db.scalar(base.where(Employe.statut == "ACTIVE")) or 0)
    total = active + leaving
    return round(100.0 * leaving / total, 1) if total else 0.0


def absenteisme(db, dept=None, days=30) -> float:
    """Taux d'absentéisme = jours MALADIE (N derniers jours) / (effectif * jours ouvrés) en %."""
    from app.db.models import Demande
    since = date.today() - timedelta(days=days)
    stmt = select(Demande.date_debut, Demande.date_fin).where(
        Demande.code_type == "MALADIE", Demande.date_debut >= since)
    mats = _dept_matricules(db, dept)
    if mats is not None:
        if not mats:
            return 0.0
        stmt = stmt.where(Demande.matricule.in_(mats))
    jours = 0
    for d0, d1 in db.execute(stmt).all():
        if d0:
            jours += ((d1 - d0).days + 1) if d1 else 1
    n = effectifs(db, dept)
    base = n * WORKDAYS_MONTH * (days / 30.0)
    return round(100.0 * jours / base, 1) if base else 0.0


def engagement(db, dept=None, months=12) -> float:
    """Engagement moyen (= satisfaction globale moyenne, échelle /100) sur N mois."""
    from app.db.models import EnqueteEngagement
    since = date.today() - timedelta(days=months * 30)
    stmt = select(func.avg(EnqueteEngagement.satisfaction_globale)).where(
        EnqueteEngagement.date_enquete >= since)
    mats = _dept_matricules(db, dept)
    if mats is not None:
        if not mats:
            return 0.0
        stmt = stmt.where(EnqueteEngagement.matricule.in_(mats))
    avg = db.scalar(stmt)
    return round(float(avg) * 10, 1) if avg is not None else 0.0


def masse_salariale(db, dept=None) -> dict:
    """Somme du dernier salaire connu par employé ACTIF (annuelle + mensuelle + par site)."""
    from app.db.models import Employe, HistoriqueSalaire
    rows = db.execute(
        select(Employe.matricule, Employe.site).where(
            Employe.statut == "ACTIVE",
            *( [Employe.id_departement == dept] if dept is not None else [] ))).all()
    site_of = {m: (s or "—") for m, s in rows}
    actifs = set(site_of)
    latest: dict[str, tuple] = {}
    for m, d, mt in db.execute(select(HistoriqueSalaire.matricule, HistoriqueSalaire.date_effet,
                                      HistoriqueSalaire.montant)).all():
        if m in actifs and (m not in latest or (d and d > latest[m][0])):
            latest[m] = (d, float(mt or 0))
    annuelle = sum(v[1] for v in latest.values())
    by_site: dict[str, float] = {}
    for m, (_, mt) in latest.items():
        s = site_of.get(m, "—")
        by_site[s] = by_site.get(s, 0.0) + mt
    return {"annuelle": round(annuelle, 2), "mensuelle": round(annuelle / 12, 2),
            "by_site": [{"site": s, "montant": round(v, 2), "mensuel": round(v / 12, 2)}
                        for s, v in sorted(by_site.items())]}


def pyramide(db, dept=None) -> list[dict]:
    """Pyramide des âges par tranche, ventilée par genre (M/F/Autre)."""
    from app.db.models import Employe
    stmt = select(Employe.date_naissance, Employe.genre)
    if dept is not None:
        stmt = stmt.where(Employe.id_departement == dept)
    buckets = ["20-25", "26-30", "31-35", "36-40", "41-45", "46-50", "51-55", "56-60", "60+"]
    data = {b: {"tranche": b, "M": 0, "F": 0, "Autre": 0, "count": 0} for b in buckets}
    today = date.today()
    for dn, genre in db.execute(stmt).all():
        if not dn:
            continue
        age = (today - dn).days // 365
        b = "20-25" if age < 26 else "60+" if age >= 60 else f"{((age - 1) // 5) * 5 + 1}-{((age - 1) // 5) * 5 + 5}"
        if b not in data:
            continue
        g = genre if genre in ("M", "F", "Autre") else "Autre"
        data[b][g] += 1
        data[b]["count"] += 1
    return [data[b] for b in buckets]


def quarterly_series(db, dept=None, quarters=4) -> list[dict]:
    """Série temporelle réelle (engagement + absentéisme par trimestre) pour le graphe."""
    from app.db.models import Demande, EnqueteEngagement
    mats = _dept_matricules(db, dept)
    today = date.today()
    out = []
    for i in range(quarters - 1, -1, -1):
        q_end = date(today.year, ((today.month - 1) // 3) * 3 + 1, 1) - timedelta(days=i * 90)
        q_start = q_end - timedelta(days=90)
        label = f"{q_end.year}-Q{((q_end.month - 1) // 3) + 1}"
        # engagement
        es = select(func.avg(EnqueteEngagement.satisfaction_globale)).where(
            EnqueteEngagement.date_enquete >= q_start, EnqueteEngagement.date_enquete < q_end)
        ab = select(Demande.date_debut, Demande.date_fin).where(
            Demande.code_type == "MALADIE", Demande.date_debut >= q_start, Demande.date_debut < q_end)
        if mats is not None:
            if not mats:
                out.append({"periode": label, "engagement": 0, "absenteisme": 0}); continue
            es = es.where(EnqueteEngagement.matricule.in_(mats))
            ab = ab.where(Demande.matricule.in_(mats))
        eng = db.scalar(es)
        jours = sum(((d1 - d0).days + 1) if d1 else 1 for d0, d1 in db.execute(ab).all() if d0)
        n = effectifs(db, dept) or 1
        out.append({"periode": label,
                    "engagement": round(float(eng) * 10, 1) if eng is not None else 0,
                    "absenteisme": round(100.0 * jours / (n * WORKDAYS_MONTH * 3), 1)})
    return out


def mobilite_interne(db, dept=None, months=12) -> float:
    """Taux de mobilité interne = employés promus (HistoriqueSalaire motif Promotion)
    sur N mois / effectif actif, en %."""
    from app.db.models import Employe, HistoriqueSalaire
    actifs = set(db.scalars(select(Employe.matricule).where(
        Employe.statut == "ACTIVE", *( [Employe.id_departement == dept] if dept is not None else [] ))))
    if not actifs:
        return 0.0
    since = date.today() - timedelta(days=months * 30)
    promus = set(db.scalars(select(HistoriqueSalaire.matricule).where(
        HistoriqueSalaire.motif == "Promotion", HistoriqueSalaire.date_effet >= since)))
    promus &= actifs
    return round(100.0 * len(promus) / len(actifs), 1)


def anomalies(db, dept=None) -> list[dict]:
    """Détection d'écarts inhabituels : compare le dernier trimestre au précédent."""
    s = quarterly_series(db, dept)
    out = []
    if len(s) >= 2:
        last, prev = s[-1], s[-2]
        if prev["absenteisme"] and last["absenteisme"] >= prev["absenteisme"] * 1.5 and (last["absenteisme"] - prev["absenteisme"]) >= 1:
            out.append({"type": "absenteisme", "severite": "high",
                        "message": f"Absentéisme en forte hausse : {prev['absenteisme']}% → {last['absenteisme']}% ({last['periode']})."})
        if prev["engagement"] and last["engagement"] <= prev["engagement"] * 0.85:
            out.append({"type": "engagement", "severite": "mid",
                        "message": f"Chute de l'engagement : {prev['engagement']} → {last['engagement']} ({last['periode']})."})
    return out


def projection(db, *, months=12, turnover_pct=None, hiring_per_month=0, raise_pct=0.0, dept=None) -> dict:
    """Projection des effectifs et de la masse salariale sur N mois (scénario paramétrable)."""
    head = effectifs(db, dept)
    base_masse = masse_salariale(db, dept)["annuelle"]
    avg = (base_masse / head) if head else 0.0
    if turnover_pct is None:
        turnover_pct = turnover(db, dept)
    monthly_attr = (turnover_pct / 100.0) / 12.0
    rows = []
    h = float(head)
    for i in range(1, months + 1):
        h = max(0.0, h - h * monthly_attr + hiring_per_month)
        masse = h * avg * (1 + (raise_pct / 100.0) * (i / 12.0))
        rows.append({"mois": i, "effectif": round(h), "masse": round(masse)})
    return {"base_effectif": head, "base_masse": round(base_masse), "avg_salary": round(avg),
            "turnover_pct": turnover_pct, "hiring_per_month": hiring_per_month, "raise_pct": raise_pct,
            "projection": rows}


def snapshot(db, dept=None) -> dict:
    """Tous les KPIs courants en un appel (format compatible cartes du dashboard)."""
    ms = masse_salariale(db, dept)
    return {
        "effectifs": effectifs(db, dept),
        "turnover": turnover(db, dept),
        "absenteisme": absenteisme(db, dept),
        "engagement": engagement(db, dept),
        "mobilite": mobilite_interne(db, dept),
        "masse_salariale": ms,
        "pyramide": pyramide(db, dept),
    }
