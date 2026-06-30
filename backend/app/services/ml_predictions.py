"""Prédiction des risques RH par Random Forest (turnover, absentéisme, mobilité).

3 modèles distincts entraînés sur les données historiques (cf. advanced_seed) :
- Turnover   : risque de départ            (cible = statut LEAVING)
- Absentéisme: risque d'arrêts élevés       (cible = >=3 arrêts MALADIE / 12 mois)
- Mobilité   : probabilité de mobilité      (cible = promotion sur 12 mois)

Les modèles sont entraînés à la demande (POST /predict/train) et persistés via
joblib. La prédiction charge les modèles persistés. scikit-learn est importé
paresseusement (lourd) et tout repli renvoie des valeurs neutres si indisponible.
"""

import os
from datetime import date

from sqlalchemy import select

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
_MODELS_PATH = os.path.join(_DATA_DIR, "ml_models.joblib")
TODAY = date(2026, 6, 1)

SITE_MAP = {"Casablanca": 0, "Rabat": 1, "Marrakech": 2, "Tanger": 3}
CONTRAT_MAP = {"CDI": 0, "CDD": 1, "Alternance": 2}

# Éthique / §4.1 : on EXCLUT volontairement les attributs personnels ou potentiellement
# discriminatoires (âge, genre, site, type de contrat) des variables prédictives. Seuls
# des signaux LIÉS AU TRAVAIL sont utilisés (engagement, charge, performance, ancienneté,
# absentéisme, feedbacks). Ces attributs restent calculés UNIQUEMENT pour l'audit d'équité
# a posteriori (fairness_audit), jamais en entrée du modèle.
_PROTECTED = ["age", "genre", "site", "contrat"]

# Features utilisées par chaque modèle (ordre = ordre des colonnes du vecteur).
F_TURNOVER = ["delai_augm_mois", "evol_satisfaction", "nb_maladie_12m", "nb_absences_12m", "note_perf",
              "anciennete_mois", "charge", "equilibre", "recon", "feedback_moyen"]
F_BURNOUT = ["charge", "equilibre", "recon", "nb_maladie_12m", "anciennete_mois", "feedback_moyen"]
F_DESENGAGEMENT = ["charge", "equilibre", "evol_satisfaction", "nb_absences_12m", "note_perf",
                   "feedback_moyen", "competence_moyenne"]

# Libellés lisibles + sens « métier » du facteur (pour l'explicabilité par prédiction).
FEATURE_LABELS = {
    "delai_augm_mois": "Délai depuis la dernière augmentation",
    "evol_satisfaction": "Évolution de la satisfaction",
    "nb_maladie_12m": "Arrêts maladie (12 mois)",
    "nb_absences_12m": "Absences injustifiées (12 mois)",
    "note_perf": "Note de performance",
    "anciennete_mois": "Ancienneté",
    "charge": "Charge de travail perçue",
    "equilibre": "Équilibre pro/perso",
    "recon": "Reconnaissance perçue",
    "feedback_moyen": "Feedbacks internes (moyenne)",
    "competence_moyenne": "Niveau de compétences (moyenne)",
}


def _months(d1: date, d2: date) -> int:
    return max(0, (d1.year - d2.year) * 12 + (d1.month - d2.month))


def _add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    return date(y, m % 12 + 1, min(d.day, 28))


# Horizon de prédiction temporelle (burnout / désengagement) : on prédit l'étiquette des
# 12 prochains mois À PARTIR des signaux ANTÉRIEURS au cutoff -> aucune fuite de cible.
HORIZON_MONTHS = 12
CUTOFF = _add_months(TODAY, -HORIZON_MONTHS)


def _collect(db):
    """Agrège, par employé, tous les historiques nécessaires aux features (en mémoire)."""
    from app.db.models import (Demande, Employe, EnqueteEngagement, EntretienAnnuel,
                               EvaluationCompetence, Feedback, HistoriqueSalaire)

    employees = list(db.scalars(select(Employe)))
    enquetes, entretiens, salaires, maladies, feedbacks, competences = {}, {}, {}, {}, {}, {}
    for m, auto, exp in db.execute(select(
            EvaluationCompetence.matricule, EvaluationCompetence.niveau_auto,
            EvaluationCompetence.niveau_expert)).all():
        lvl = exp if exp is not None else auto
        if lvl is not None:
            competences.setdefault(m, []).append(lvl)
    for m, dt, note in db.execute(select(
            Feedback.matricule, Feedback.date_feedback, Feedback.note_1_5)).all():
        if note is not None:
            feedbacks.setdefault(m, []).append((dt, note))
    for m, dt, sat, ch, eq, rec in db.execute(select(
            EnqueteEngagement.matricule, EnqueteEngagement.date_enquete,
            EnqueteEngagement.satisfaction_globale, EnqueteEngagement.charge_travail,
            EnqueteEngagement.equilibre_pro_perso, EnqueteEngagement.reconnaissance)).all():
        enquetes.setdefault(m, []).append((dt, sat or 0, ch or 0, eq or 0, rec or 0))
    for m, dt, note in db.execute(select(
            EntretienAnnuel.matricule, EntretienAnnuel.date_entretien,
            EntretienAnnuel.note_performance_1_5)).all():
        entretiens.setdefault(m, []).append((dt, note or 0))
    for m, dt, motif in db.execute(select(
            HistoriqueSalaire.matricule, HistoriqueSalaire.date_effet, HistoriqueSalaire.motif)).all():
        salaires.setdefault(m, []).append((dt, motif or ""))
    for m, d0, ctype in db.execute(select(
            Demande.matricule, Demande.date_debut, Demande.code_type).where(
            Demande.code_type.in_(["MALADIE", "ABSENCE"]))).all():
        maladies.setdefault(m, []).append((d0, ctype))
    return employees, enquetes, entretiens, salaires, maladies, feedbacks, competences


def _build_dataset(db, as_of=None) -> list[dict]:
    """Une ligne de features par employé, calculée à la date `as_of` (TODAY par défaut)."""
    employees, enq, entr, sal, mal, fbk, comp = _collect(db)
    rows = []
    for e in employees:
        mat = e.matricule
        rows.append(_features_for(e, enq.get(mat, []), entr.get(mat, []), sal.get(mat, []),
                                  mal.get(mat, []), fbk.get(mat, []), comp.get(mat, []), as_of=as_of))
    return rows


def _temporal_rows(db, horizon_months=HORIZON_MONTHS) -> list[dict]:
    """Jeu d'apprentissage TEMPOREL (anti-fuite) : features calculées AU CUTOFF (passé) et
    étiquette mesurée sur la fenêtre FUTURE (cutoff → aujourd'hui). On prédit donc un
    événement futur à partir de signaux strictement antérieurs."""
    cutoff = _add_months(TODAY, -horizon_months)
    employees, enq, entr, sal, mal, fbk, comp = _collect(db)
    rows = []
    for e in employees:
        if not e.date_embauche or e.date_embauche > cutoff:
            continue  # pas d'historique avant le cutoff -> exclu
        mat = e.matricule
        feats = _features_for(e, enq.get(mat, []), entr.get(mat, []), sal.get(mat, []),
                              mal.get(mat, []), fbk.get(mat, []), comp.get(mat, []), as_of=cutoff)
        ev = mal.get(mat, [])
        fut_mal = sum(1 for d0, ct in ev if d0 and cutoff < d0 <= TODAY and ct == "MALADIE")
        fut_abs = sum(1 for d0, ct in ev if d0 and cutoff < d0 <= TODAY and ct == "ABSENCE")
        fut_sats = [x[1] for x in enq.get(mat, []) if x[0] and cutoff < x[0] <= TODAY]
        fut_sat = (sum(fut_sats) / len(fut_sats)) if fut_sats else None
        # Étiquettes FUTURES (indépendantes des features passées) :
        feats["y_burnout_future"] = 1 if fut_mal >= 2 else 0
        feats["y_deseng_future"] = 1 if ((fut_sat is not None and fut_sat < 6) or fut_abs >= 1
                                         or e.statut == "LEAVING") else 0
        rows.append(feats)
    return rows


def _features_for(e, enq, entr, sal, mal, fbk=None, comp=None, as_of=None) -> dict:
    """Features d'un employé à la date `as_of` : seuls les événements ANTÉRIEURS à `as_of`
    sont pris en compte (fenêtres glissantes relatives à `as_of`)."""
    as_of = as_of or TODAY
    age = _months(as_of, e.date_naissance) // 12 if e.date_naissance else 40
    anciennete = _months(as_of, e.date_embauche) if e.date_embauche else 0

    # Dernière augmentation (Annuel/Promotion) — uniquement ≤ as_of.
    sal = [(d, mo) for d, mo in sal if d and d <= as_of]
    raises = sorted([d for d, mo in sal if mo in ("Annuel", "Promotion")])
    delai_augm = _months(as_of, raises[-1]) if raises else anciennete
    promo_12m = 1 if any(mo == "Promotion" and _months(as_of, d) <= 12 for d, mo in sal) else 0

    # Engagement : dernier point + évolution (récent - ancien), ≤ as_of.
    enq_sorted = sorted([x for x in enq if x[0] and x[0] <= as_of], key=lambda x: x[0])
    if enq_sorted:
        last = enq_sorted[-1]
        charge, equilibre, recon = last[2], last[3], last[4]
        recent = [x[1] for x in enq_sorted[-3:]]
        old = [x[1] for x in enq_sorted[:3]]
        evol = (sum(recent) / len(recent)) - (sum(old) / len(old)) if old else 0.0
    else:
        charge = equilibre = recon = 5
        evol = 0.0

    entr_f = [x for x in entr if x[0] and x[0] <= as_of]
    note_perf = sorted(entr_f, key=lambda x: x[0])[-1][1] if entr_f else 3

    nb_maladie_12m = sum(1 for d0, ctype in mal if d0 and d0 <= as_of and ctype == "MALADIE" and _months(as_of, d0) <= 12)
    nb_absences_12m = sum(1 for d0, ctype in mal if d0 and d0 <= as_of and ctype == "ABSENCE" and _months(as_of, d0) <= 12)

    # Feedbacks internes récents (≤ 12 mois avant as_of) : note moyenne sur 5 ; neutre (3) si aucun.
    fbk = fbk or []
    recent_fbk = [n for d, n in fbk if d and d <= as_of and _months(as_of, d) <= 12]
    feedback_moyen = (sum(recent_fbk) / len(recent_fbk)) if recent_fbk else 3.0

    # Niveau de compétences moyen (validé sinon auto) ; neutre (3) si non évalué.
    comp = comp or []
    competence_moyenne = (sum(comp) / len(comp)) if comp else 3.0

    return {
        "matricule": e.matricule,
        # Attributs protégés — AUDIT D'ÉQUITÉ UNIQUEMENT, jamais en entrée du modèle.
        "genre": e.genre or "Autre",
        "delai_augm_mois": float(delai_augm),
        "evol_satisfaction": float(evol),
        "nb_maladie_12m": float(nb_maladie_12m),
        "nb_absences_12m": float(nb_absences_12m),
        "note_perf": float(note_perf),
        "age": float(age),
        "anciennete_mois": float(anciennete),
        "site": float(SITE_MAP.get(e.site, 0)),
        "contrat": float(CONTRAT_MAP.get(e.type_contrat, 0)),
        "charge": float(charge),
        "equilibre": float(equilibre),
        "recon": float(recon),
        "feedback_moyen": float(feedback_moyen),
        "competence_moyenne": float(competence_moyenne),
        # Cibles
        "y_turnover": 1 if e.statut == "LEAVING" else 0,
        "y_burnout": 1 if nb_maladie_12m >= 3 and charge >= 7 and equilibre <= 5 else 0,
        "y_desengagement": 1 if (evol < -0.5 or nb_absences_12m >= 1 or feedback_moyen < 3.0) else 0,
    }


def _vec(row, feats):
    return [row[f] for f in feats]


def train(db) -> dict:
    """Entraîne les 3 Random Forest et les persiste. Renvoie les métriques."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import (confusion_matrix, precision_recall_fscore_support, roc_auc_score)
    from sklearn.model_selection import train_test_split
    import joblib

    today_rows = _build_dataset(db)
    if len(today_rows) < 30:
        return {"error": "Pas assez de données. Lancez advanced_seed.", "n": len(today_rows)}
    # Burnout & désengagement : apprentissage TEMPOREL (features passées -> étiquette future).
    temporal_rows = _temporal_rows(db)

    bundle, metrics = {}, {}
    # (nom, features, cible, jeu de données, type d'évaluation)
    specs = [
        ("turnover", F_TURNOVER, "y_turnover", today_rows, "predictif"),
        ("burnout", F_BURNOUT, "y_burnout_future", temporal_rows, "predictif (horizon 12 mois)"),
        ("desengagement", F_DESENGAGEMENT, "y_deseng_future", temporal_rows, "predictif (horizon 12 mois)"),
    ]
    for name, feats, target, rows, eval_type in specs:
        if not rows:
            metrics[name] = {"trained": False, "reason": "pas d'historique suffisant"}
            continue
        X = [_vec(r, feats) for r in rows]
        y = [r[target] for r in rows]
        if len(set(y)) < 2:  # une seule classe -> non entraînable
            metrics[name] = {"trained": False, "reason": "classe unique"}
            continue
        import numpy as np
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
        rf_params = dict(n_estimators=200, max_depth=10, min_samples_leaf=2,
                         random_state=42, class_weight="balanced", n_jobs=-1)
        # Calibration du SEUIL de décision sur une validation interne (jamais le test) :
        # on maximise le F1 -> bien meilleur compromis précision/rappel que le seuil 0,5.
        best_t = 0.5
        if len(set(ytr)) > 1:
            Xt2, Xval, yt2, yval = train_test_split(Xtr, ytr, test_size=0.25, random_state=42, stratify=ytr)
            if len(set(yt2)) > 1 and len(set(yval)) > 1:
                pv = RandomForestClassifier(**rf_params).fit(Xt2, yt2).predict_proba(Xval)[:, 1]
                best_f1 = -1.0
                for t in np.linspace(0.15, 0.85, 29):
                    _, _, f, _ = precision_recall_fscore_support(
                        yval, (pv >= t).astype(int), average="binary", pos_label=1, zero_division=0)
                    if f > best_f1:
                        best_f1, best_t = f, float(t)
        clf = RandomForestClassifier(**rf_params).fit(Xtr, ytr)

        # KPIs d'évaluation sur le jeu de test, AU SEUIL CALIBRÉ (classe positive = 1).
        y_proba = clf.predict_proba(Xte)[:, 1]
        y_pred = (y_proba >= best_t).astype(int)
        acc = float((y_pred == np.array(yte)).mean())
        prec, rec, f1, _ = precision_recall_fscore_support(yte, y_pred, average="binary",
                                                           pos_label=1, zero_division=0)
        try:
            auc = roc_auc_score(yte, y_proba) if len(set(yte)) > 1 else None
        except Exception:
            auc = None
        cm = confusion_matrix(yte, y_pred, labels=[0, 1]).tolist()  # [[TN, FP], [FN, TP]]
        importances = dict(sorted(zip(feats, (round(float(i), 3) for i in clf.feature_importances_)),
                                  key=lambda x: x[1], reverse=True))
        # Statistiques par feature pour l'explicabilité individuelle :
        # moyenne de cohorte + sens de corrélation (signe) avec la cible.
        import numpy as np
        Xa, ya = np.array(X, dtype=float), np.array(y, dtype=float)
        means, corr_sign = {}, {}
        for j, f in enumerate(feats):
            col = Xa[:, j]
            means[f] = round(float(col.mean()), 3)
            sd = col.std()
            if sd > 1e-9 and ya.std() > 1e-9:
                c = float(np.corrcoef(col, ya)[0, 1])
                corr_sign[f] = 1 if c > 0.02 else -1 if c < -0.02 else 0
            else:
                corr_sign[f] = 0
        bundle[name] = {"model": clf, "feats": feats, "importances": importances,
                        "means": means, "corr_sign": corr_sign, "threshold": best_t}
        metrics[name] = {
            "trained": True, "n": len(y), "positives": int(sum(y)), "test_size": len(yte),
            "eval_type": eval_type, "threshold": round(best_t, 3),
            "accuracy": round(float(acc), 3), "precision": round(float(prec), 3),
            "recall": round(float(rec), 3), "f1": round(float(f1), 3),
            "roc_auc": round(float(auc), 3) if auc is not None else None,
            "confusion_matrix": {"tn": cm[0][0], "fp": cm[0][1], "fn": cm[1][0], "tp": cm[1][1]},
            "importances": importances,
        }

    os.makedirs(_DATA_DIR, exist_ok=True)
    joblib.dump(bundle, _MODELS_PATH)
    return {"models": metrics, "n_employes": len(today_rows), "n_temporel": len(temporal_rows)}


def batch_score(db) -> dict:
    """Traitement par lots : score TOUS les employés actifs via les modèles entraînés,
    puis met à jour la table ScoreRisque en une transaction (bulk). Entraîne au besoin."""
    from sqlalchemy import delete as sa_delete
    from app.db.models import Employe, ScoreRisque

    bundle = _load_bundle()
    if not bundle:
        train(db)
        bundle = _load_bundle()
    if not bundle:
        return {"error": "Modèles indisponibles (scikit-learn ?)."}

    rows = _build_dataset(db)
    active = set(db.scalars(select(Employe.matricule).where(Employe.statut == "ACTIVE")))
    rows = [r for r in rows if r["matricule"] in active]
    # Consentement (RGPD / loi 09-08) : on exclut les collaborateurs ayant RETIRÉ leur consentement
    # à la détection du désengagement — traitement analytique avancé soumis à consentement révocable.
    from app.db import repository as _repo
    refus = _repo.matricules_refusant(db, "detection_desengagement")
    if refus:
        rows = [r for r in rows if r["matricule"] not in refus]
    if not rows:
        return {"scored": 0, "employes": 0}

    today = date.today()
    db.execute(sa_delete(ScoreRisque).where(ScoreRisque.type.in_(["turnover", "burnout", "desengagement"])))
    objs = []
    for model_name, score_type in (("turnover", "turnover"), ("burnout", "burnout"), ("desengagement", "desengagement")):
        spec = bundle.get(model_name)
        if not spec:
            continue
        X = [_vec(r, spec["feats"]) for r in rows]
        thr = spec.get("threshold", 0.5)
        probas = spec["model"].predict_proba(X)[:, 1]  # prédiction en lot
        for r, p in zip(rows, probas):
            p = float(p)
            objs.append(ScoreRisque(type=score_type, valeur=round(p, 3), niveau=_niveau(p, thr),
                                    date_calcul=today, matricule=r["matricule"]))
    db.bulk_save_objects(objs)  # une seule transaction
    db.commit()

    # Alertes préventives : un signalement par employé à risque ÉLEVÉ.
    from app.db.models import Alerte
    from app.db import repository as repo
    db.execute(sa_delete(Alerte).where(Alerte.categorie == "risque_eleve", Alerte.resolue.is_(False)))
    db.commit()
    
    alerted = 0
    for key, label in [("turnover", "départ"), ("burnout", "burnout"), ("desengagement", "désengagement")]:
        spec = bundle.get(key)
        if spec:
            thr = spec.get("threshold", 0.5)
            probas = spec["model"].predict_proba([_vec(r, spec["feats"]) for r in rows])[:, 1]
            for r, p in zip(rows, probas):
                if _niveau(float(p), thr) == "high":
                    repo.create_alerte(
                        db, message=f"Risque de {label} élevé détecté ({r['matricule']}, {round(float(p) * 100)}%).",
                        categorie="risque_eleve", gravite="high", id_destinataire=None, matricule=r["matricule"])
                    alerted += 1
    return {"scored": len(objs), "employes": len(rows), "alertes_preventives": alerted}


def action_plan(db, matricule: str) -> dict | None:
    """Plan d'action ciblé selon les risques prédits (entretien, charge, formation, mobilité)."""
    pred = predict_for(db, matricule)
    if pred is None:
        return None
    risks = pred.get("risks", {})
    t = (risks.get("turnover") or {}).get("niveau")
    b = (risks.get("burnout") or {}).get("niveau")
    d = (risks.get("desengagement") or {}).get("niveau")
    actions = []
    if t == "high":
        actions += [
            "Planifier un entretien de fidélisation sous 2 semaines.",
            "Revue de rémunération / perspectives d'évolution.",
            "Étudier une opportunité de mobilité interne.",
        ]
    if b == "high":
        actions += [
            "Ajuster la charge de travail de toute urgence.",
            "Accompagnement managérial rapproché et bienveillant.",
            "Proposer un point avec la médecine du travail.",
        ]
    if d == "high" and t != "high":
        actions += [
            "Organiser un entretien de remotivation (Feedback 360).",
            "Vérifier l'alignement des missions avec les compétences.",
            "Proposer une nouvelle formation ou un changement de projet."
        ]
    if not actions:
        actions = ["Aucune action urgente — maintenir le suivi régulier."]
    return {"matricule": matricule, "trained": pred.get("trained", False),
            "risks": risks, "actions": actions}


def _load_bundle():
    import joblib
    if not os.path.exists(_MODELS_PATH):
        return None
    try:
        return joblib.load(_MODELS_PATH)
    except Exception:
        return None


def _niveau(p: float, threshold: float = 0.5) -> str:
    """Niveau de risque relatif au SEUIL calibré du modèle : « high » = au-dessus du seuil
    de décision (= prédiction positive), « mid » = zone d'alerte approchante, « low » sinon."""
    if p >= threshold:
        return "high"
    if p >= threshold * 0.6:
        return "mid"
    return "low"


def _explain(row, spec, top=3) -> list[dict]:
    """Explicabilité par prédiction (§4.1) : top facteurs contributifs pour CET employé.

    Pour chaque variable on regarde si la valeur de l'employé s'écarte de la moyenne de
    cohorte dans le sens qui AUGMENTE le risque (selon le signe de corrélation appris).
    On classe par importance du modèle. Repli : facteurs qui diminuent le risque.
    """
    importances = spec.get("importances", {})
    means = spec.get("means", {})
    corr_sign = spec.get("corr_sign", {})
    up, down = [], []
    for f in spec["feats"]:
        val = row.get(f)
        mean = means.get(f)
        cs = corr_sign.get(f, 0)
        if val is None or mean is None or cs == 0:
            continue
        dev = val - mean
        if abs(dev) < 1e-9:
            continue
        raises_risk = (dev > 0 and cs > 0) or (dev < 0 and cs < 0)
        item = {"feature": f, "label": FEATURE_LABELS.get(f, f),
                "valeur": round(float(val), 2), "moyenne": round(float(mean), 2),
                "importance": importances.get(f, 0.0),
                "sens": "augmente le risque" if raises_risk else "diminue le risque"}
        (up if raises_risk else down).append(item)
    up.sort(key=lambda x: x["importance"], reverse=True)
    down.sort(key=lambda x: x["importance"], reverse=True)
    return (up or down)[:top]


def predict_for(db, matricule: str) -> dict | None:
    """Évalue les 3 risques en temps réel pour un employé. None si employé inconnu."""
    from app.db.models import Employe
    e = db.get(Employe, matricule)
    if e is None:
        return None
    bundle = _load_bundle()
    if not bundle:
        return {"matricule": matricule, "trained": False,
                "message": "Modèles non entraînés. Lancez POST /predict/train."}

    rows = _build_dataset(db)  # recalcule les features (cohérent avec l'entraînement)
    row = next((r for r in rows if r["matricule"] == matricule), None)
    if row is None:
        return {"matricule": matricule, "trained": False}

    out = {"matricule": matricule, "trained": True, "risks": {}}
    for name in ("turnover", "burnout", "desengagement"):
        spec = bundle.get(name)
        if not spec:
            continue
        proba = float(spec["model"].predict_proba([_vec(row, spec["feats"])])[0][1])
        out["risks"][name] = {"proba": round(proba, 3), "niveau": _niveau(proba, spec.get("threshold", 0.5)),
                              "facteurs": _explain(row, spec)}  # explicabilité §4.1
    return out


def fairness_audit(db) -> dict:
    """Contrôle d'équité documenté (§4.1) : mesure le taux de prédiction « à risque »
    par groupe protégé (genre, tranche d'âge, site, type de contrat) — bien que ces
    attributs NE SOIENT PAS des variables d'entrée. Calcule le « disparate impact ratio »
    (min/max des taux). Un ratio < 0.8 (règle des 4/5) signale un possible biais à investiguer.
    """
    from app.db.models import Employe
    bundle = _load_bundle()
    if not bundle:
        return {"trained": False, "message": "Modèles non entraînés."}
    rows = _build_dataset(db)
    active = set(db.scalars(select(Employe.matricule).where(Employe.statut == "ACTIVE")))
    rows = [r for r in rows if r["matricule"] in active]
    if not rows:
        return {"trained": True, "n": 0, "audits": {}}

    def _age_band(a):
        a = int(a)
        return "<30" if a < 30 else "30-39" if a < 40 else "40-49" if a < 50 else "50+"

    groupers = {
        "genre": lambda r: r.get("genre", "Autre"),
        "tranche_age": lambda r: _age_band(r.get("age", 40)),
        "site": lambda r: {0: "Casablanca", 1: "Rabat", 2: "Marrakech", 3: "Tanger"}.get(int(r.get("site", 0)), "?"),
        "contrat": lambda r: {0: "CDI", 1: "CDD", 2: "Alternance"}.get(int(r.get("contrat", 0)), "?"),
    }

    audits = {}
    for model_name in ("turnover", "burnout", "desengagement"):
        spec = bundle.get(model_name)
        if not spec:
            continue
        thr = spec.get("threshold", 0.5)
        probas = spec["model"].predict_proba([_vec(r, spec["feats"]) for r in rows])[:, 1]
        flagged = [1 if float(p) >= thr else 0 for p in probas]
        per_attr = {}
        for attr, fn in groupers.items():
            buckets = {}
            for r, fl in zip(rows, flagged):
                g = fn(r)
                b = buckets.setdefault(g, {"n": 0, "flagged": 0})
                b["n"] += 1
                b["flagged"] += fl
            groups = {g: {"n": v["n"], "taux_risque": round(v["flagged"] / v["n"], 3)}
                      for g, v in buckets.items() if v["n"] >= 10}  # ignore petits groupes
            rates = [v["taux_risque"] for v in groups.values()]
            di = round(min(rates) / max(rates), 3) if rates and max(rates) > 0 else 1.0
            per_attr[attr] = {"groupes": groups, "disparate_impact_ratio": di,
                              "biais_potentiel": di < 0.8}
        audits[model_name] = per_attr
    return {"trained": True, "n": len(rows), "regle": "disparate impact < 0.8 (4/5) = à investiguer",
            "exclus_des_features": _PROTECTED, "audits": audits}
