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


_MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]


def monthly_series(db, dept=None, year=None, min_n=3) -> dict:
    """Séries MENSUELLES réelles de l'année courante (axe X = mois) pour les graphes de tendance.

    Sources réelles : absentéisme (jours MALADIE/mois), engagement (enquêtes/mois),
    humeur (déclarations/mois, agrégées & anonymisées seuil min_n), embauches, mobilité.
    `value=None` pour les mois FUTURS ou sans donnée (le front filtre les null)."""
    from app.db.models import Demande, Employe, EnqueteEngagement, HistoriqueSalaire, Humeur
    year = year or date.today().year
    today = date.today()
    last_m = today.month if year == today.year else 12
    mats = _dept_matricules(db, dept)
    empty = mats is not None and not mats
    n = effectifs(db, dept) or 1

    def col(arr):
        return [{"label": _MONTHS_FR[i], "value": (arr[i] if (i + 1) <= last_m else None)} for i in range(12)]

    abs_days = [0.0] * 12
    eng = [None] * 12
    hum = [None] * 12
    emb = [0] * 12
    mob = [0] * 12

    if not empty:
        # Absentéisme : jours MALADIE par mois (recouvrement borné au mois).
        ab = select(Demande.date_debut, Demande.date_fin).where(Demande.code_type == "MALADIE")
        if mats is not None:
            ab = ab.where(Demande.matricule.in_(mats))
        for d0, d1 in db.execute(ab).all():
            if not d0:
                continue
            end = d1 or d0
            for m in range(1, 13):
                ms = date(year, m, 1)
                me = (date(year, m + 1, 1) - timedelta(days=1)) if m < 12 else date(year, 12, 31)
                lo, hi = max(d0, ms), min(end, me)
                if lo <= hi:
                    abs_days[m - 1] += (hi - lo).days + 1
        absent = [round(100.0 * abs_days[i] / (n * WORKDAYS_MONTH), 1) for i in range(12)]

        # Engagement : moyenne des enquêtes par mois (×10 sur /100).
        eq = select(func.extract("month", EnqueteEngagement.date_enquete),
                    func.avg(EnqueteEngagement.satisfaction_globale)).where(
            func.extract("year", EnqueteEngagement.date_enquete) == year)
        if mats is not None:
            eq = eq.where(EnqueteEngagement.matricule.in_(mats))
        for m, a in db.execute(eq.group_by(func.extract("month", EnqueteEngagement.date_enquete))).all():
            if a is not None:
                eng[int(m) - 1] = round(float(a) * 10, 1)

        # Humeur : moyenne /3*100 par mois, masquée si < min_n réponses (anti-réidentification).
        hq = select(func.extract("month", Humeur.date_saisie), func.avg(Humeur.niveau), func.count()).where(
            func.extract("year", Humeur.date_saisie) == year)
        if mats is not None:
            hq = hq.where(Humeur.matricule.in_(mats))
        for m, a, c in db.execute(hq.group_by(func.extract("month", Humeur.date_saisie))).all():
            if a is not None and (c or 0) >= min_n:
                hum[int(m) - 1] = round(float(a) / 3 * 100)

        # Embauches : nombre par mois (date_embauche).
        eb = select(func.extract("month", Employe.date_embauche), func.count()).where(
            func.extract("year", Employe.date_embauche) == year)
        if dept is not None:
            eb = eb.where(Employe.id_departement == dept)
        for m, c in db.execute(eb.group_by(func.extract("month", Employe.date_embauche))).all():
            emb[int(m) - 1] = int(c or 0)

        # Mobilité interne : promotions par mois / effectif (%).
        mq = select(func.extract("month", HistoriqueSalaire.date_effet), func.count()).where(
            HistoriqueSalaire.motif == "Promotion", func.extract("year", HistoriqueSalaire.date_effet) == year)
        if mats is not None:
            mq = mq.where(HistoriqueSalaire.matricule.in_(mats))
        for m, c in db.execute(mq.group_by(func.extract("month", HistoriqueSalaire.date_effet))).all():
            mob[int(m) - 1] = round(100.0 * int(c or 0) / n, 1)
    else:
        absent = [0.0] * 12

    return {
        "year": year,
        "absenteisme": col(absent),
        "engagement": col(eng),
        "humeur": col(hum),
        "embauches": col(emb),
        "mobilite": col(mob),
    }


def _quarter_ends(today, n):
    q = (today.month - 1) // 3
    ends = []
    for back in range(n - 1, -1, -1):
        qi, yy = q - back, today.year
        while qi < 0:
            qi += 4
            yy -= 1
        em = qi * 3 + 3
        ends.append(date(yy, 12, 31) if em == 12 else date(yy, em + 1, 1) - timedelta(days=1))
    return ends


def career_trends(db, dept=None, quarters=6) -> dict:
    """Évolution comparée (indexée base 100) du SALAIRE moyen et du NIVEAU DE COMPÉTENCES
    moyen validé, par trimestre — pour détecter un décrochage rémunération/compétences."""
    from app.db.models import EvaluationCompetence, HistoriqueSalaire
    mats = _dept_matricules(db, dept)
    ends = _quarter_ends(date.today(), quarters)
    sal_rows = db.execute(select(HistoriqueSalaire.matricule, HistoriqueSalaire.date_effet, HistoriqueSalaire.montant)).all()
    ev_rows = db.execute(select(EvaluationCompetence.matricule, EvaluationCompetence.date_evaluation,
                                EvaluationCompetence.niveau_expert).where(EvaluationCompetence.statut == "valide")).all()
    if mats is not None:
        sal_rows = [r for r in sal_rows if r[0] in mats]
        ev_rows = [r for r in ev_rows if r[0] in mats]
    sal_avg, comp_avg, labels = [], [], []
    for qe in ends:
        labels.append(f"{qe.year}-T{((qe.month - 1) // 3) + 1}")
        latest = {}
        for m, d, mt in sal_rows:
            if d and d <= qe and (m not in latest or d > latest[m][0]):
                latest[m] = (d, float(mt or 0))
        sal_avg.append(sum(v[1] for v in latest.values()) / len(latest) if latest else 0)
        nivs = [float(n) for (m, d, n) in ev_rows if d and d <= qe and n is not None]
        comp_avg.append(sum(nivs) / len(nivs) if nivs else 0)

    def idx(arr):
        base = next((x for x in arr if x), 0)
        return [round(100.0 * x / base, 1) if base else None for x in arr]
    si, ci = idx(sal_avg), idx(comp_avg)
    series = [{"label": labels[i], "salaire": si[i], "competences": ci[i]} for i in range(len(labels))]
    return {"series": series}


def poste_comparison(db, dept=None, limit=24) -> dict:
    """Comparaison salaire vs niveau de compétences des collaborateurs d'un MÊME poste
    (le poste le plus représenté du périmètre) — équité interne."""
    from collections import Counter, defaultdict
    from app.db.models import Employe, EvaluationCompetence, HistoriqueSalaire
    rows = db.execute(select(Employe.matricule, Employe.poste, Employe.prenom, Employe.nom).where(
        Employe.statut == "ACTIVE", *([Employe.id_departement == dept] if dept is not None else []))).all()
    cnt = Counter(p for (_, p, _, _) in rows if p)
    if not cnt:
        return {"poste": None, "points": []}
    poste = cnt.most_common(1)[0][0]
    members = [(m, pr, no) for (m, p, pr, no) in rows if p == poste]
    memset = {m for m, _, _ in members}
    latest = {}
    for m, d, mt in db.execute(select(HistoriqueSalaire.matricule, HistoriqueSalaire.date_effet, HistoriqueSalaire.montant)).all():
        if m in memset and (m not in latest or (d and d > latest[m][0])):
            latest[m] = (d, float(mt or 0))
    nivs = defaultdict(list)
    for m, n in db.execute(select(EvaluationCompetence.matricule, EvaluationCompetence.niveau_expert).where(
            EvaluationCompetence.statut == "valide")).all():
        if m in memset and n is not None:
            nivs[m].append(float(n))
    points = []
    for m, pr, no in members[:limit]:
        points.append({"nom": f"{pr} {no}".strip(),
                       "salaire": round(latest.get(m, (None, 0))[1]),
                       "competence": round(sum(nivs[m]) / len(nivs[m]), 2) if nivs[m] else 0})
    return {"poste": poste, "points": points}


def employee_trends(db, matricule, quarters=8) -> dict:
    """Tendances d'UN collaborateur : historique de salaire + niveau de compétences validé par trimestre."""
    from app.db.models import EvaluationCompetence, HistoriqueSalaire
    sal = db.execute(select(HistoriqueSalaire.date_effet, HistoriqueSalaire.montant).where(
        HistoriqueSalaire.matricule == matricule).order_by(HistoriqueSalaire.date_effet)).all()
    sal_series = [{"label": d.strftime("%m/%y") if d else "—", "value": round(float(m or 0))} for d, m in sal]
    ev = db.execute(select(EvaluationCompetence.date_evaluation, EvaluationCompetence.niveau_expert).where(
        EvaluationCompetence.matricule == matricule, EvaluationCompetence.statut == "valide")).all()
    comp_series = []
    for qe in _quarter_ends(date.today(), quarters):
        nivs = [float(n) for (d, n) in ev if d and d <= qe and n is not None]
        comp_series.append({"label": f"T{((qe.month - 1) // 3) + 1} {str(qe.year)[2:]}",
                            "value": round(sum(nivs) / len(nivs), 2) if nivs else None})
    return {"salaire": sal_series, "competences": comp_series}


def compare_series(db, matricules, metric="salaire", quarters=8) -> dict:
    """Comparaison multi-collaborateurs par trimestre : une courbe par collaborateur.
    metric = 'salaire' (dernier salaire connu <= trimestre) ou 'competences' (niveau moyen validé)."""
    from app.db.models import Employe, EvaluationCompetence, HistoriqueSalaire
    ends = _quarter_ends(date.today(), quarters)
    labels = [f"T{((qe.month - 1) // 3) + 1} {str(qe.year)[2:]}" for qe in ends]
    series = []
    for mat in matricules:
        emp = db.get(Employe, mat)
        nom = f"{emp.prenom} {emp.nom}".strip() if emp else mat
        if metric == "competences":
            rows = db.execute(select(EvaluationCompetence.date_evaluation, EvaluationCompetence.niveau_expert).where(
                EvaluationCompetence.matricule == mat, EvaluationCompetence.statut == "valide")).all()
            vals = []
            for qe in ends:
                nivs = [float(n) for (d, n) in rows if d and d <= qe and n is not None]
                vals.append(round(sum(nivs) / len(nivs), 2) if nivs else None)
        else:
            rows = db.execute(select(HistoriqueSalaire.date_effet, HistoriqueSalaire.montant).where(
                HistoriqueSalaire.matricule == mat).order_by(HistoriqueSalaire.date_effet)).all()
            vals = []
            for qe in ends:
                latest = None
                for d, m in rows:
                    if d and d <= qe and (latest is None or d > latest[0]):
                        latest = (d, float(m or 0))
                vals.append(round(latest[1]) if latest else None)
        series.append({"matricule": mat, "nom": nom, "values": vals})
    return {"labels": labels, "metric": metric, "series": series}


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


def projection(db, *, months=12, turnover_pct=None, hiring_per_month=0, raise_pct=0.0,
               absenteisme_pct=None, mobilite_pct=None, dept=None) -> dict:
    """Projection / simulation « what-if » sur N mois (scénario paramétrable).

    Couvre 4 leviers : turnover (attrition), recrutement, augmentations (masse) ET,
    en simulation forward, l'absentéisme (jours perdus + coût estimé) et la mobilité
    interne (nombre de mouvements internes attendus). Les taux non fournis reprennent
    la valeur courante mesurée -> on simule l'écart par rapport au réel.
    """
    head = effectifs(db, dept)
    base_masse = masse_salariale(db, dept)["annuelle"]
    avg = (base_masse / head) if head else 0.0
    if turnover_pct is None:
        turnover_pct = turnover(db, dept)
    if absenteisme_pct is None:
        absenteisme_pct = absenteisme(db, dept)
    if mobilite_pct is None:
        mobilite_pct = mobilite_interne(db, dept)
    monthly_attr = (turnover_pct / 100.0) / 12.0
    cout_jour = (avg / 12.0 / WORKDAYS_MONTH) if avg else 0.0  # coût journalier moyen d'un ETP
    rows = []
    h = float(head)
    cumul_jours_abs, cumul_cout_abs, cumul_mobilites = 0.0, 0.0, 0.0
    for i in range(1, months + 1):
        h = max(0.0, h - h * monthly_attr + hiring_per_month)
        masse = h * avg * (1 + (raise_pct / 100.0) * (i / 12.0))
        # Simulation absentéisme : jours perdus du mois et coût associé.
        jours_abs = h * WORKDAYS_MONTH * (absenteisme_pct / 100.0)
        cout_abs = jours_abs * cout_jour
        # Simulation mobilité interne : mouvements internes attendus dans le mois.
        mobilites = h * (mobilite_pct / 100.0) / 12.0
        cumul_jours_abs += jours_abs
        cumul_cout_abs += cout_abs
        cumul_mobilites += mobilites
        rows.append({"mois": i, "effectif": round(h), "masse": round(masse),
                     "jours_absence": round(jours_abs), "cout_absenteisme": round(cout_abs),
                     "mobilites_internes": round(mobilites, 1)})
    return {"base_effectif": head, "base_masse": round(base_masse), "avg_salary": round(avg),
            "turnover_pct": turnover_pct, "hiring_per_month": hiring_per_month, "raise_pct": raise_pct,
            "absenteisme_pct": absenteisme_pct, "mobilite_pct": mobilite_pct,
            "totaux": {"jours_absence": round(cumul_jours_abs),
                       "cout_absenteisme": round(cumul_cout_abs),
                       "mobilites_internes": round(cumul_mobilites)},
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
