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

SITE_MAP = {"Paris": 0, "Lyon": 1, "Bordeaux": 2, "Remote": 3}
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
F_DESENGAGEMENT = ["charge", "equilibre", "evol_satisfaction", "nb_absences_12m", "note_perf", "feedback_moyen"]

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
}


def _months(d1: date, d2: date) -> int:
    return max(0, (d1.year - d2.year) * 12 + (d1.month - d2.month))


def _build_dataset(db) -> list[dict]:
    """Construit une ligne de features + cibles par employé (agrégation en mémoire)."""
    from app.db.models import (Demande, Employe, EnqueteEngagement, EntretienAnnuel,
                               Feedback, HistoriqueSalaire)

    employees = list(db.scalars(select(Employe)))
    enquetes, entretiens, salaires, maladies, feedbacks = {}, {}, {}, {}, {}
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

    rows = []
    for e in employees:
        mat = e.matricule
        rows.append(_features_for(e, enquetes.get(mat, []), entretiens.get(mat, []),
                                  salaires.get(mat, []), maladies.get(mat, []),
                                  feedbacks.get(mat, [])))
    return rows


def _features_for(e, enq, entr, sal, mal, fbk=None) -> dict:
    age = _months(TODAY, e.date_naissance) // 12 if e.date_naissance else 40
    anciennete = _months(TODAY, e.date_embauche) if e.date_embauche else 0

    # Dernière augmentation (Annuel/Promotion).
    raises = sorted([d for d, mo in sal if mo in ("Annuel", "Promotion")])
    delai_augm = _months(TODAY, raises[-1]) if raises else anciennete
    promo_12m = 1 if any(mo == "Promotion" and _months(TODAY, d) <= 12 for d, mo in sal) else 0

    # Engagement : dernier point + évolution (récent - ancien).
    enq_sorted = sorted(enq, key=lambda x: x[0])
    if enq_sorted:
        last = enq_sorted[-1]
        charge, equilibre, recon = last[2], last[3], last[4]
        recent = [x[1] for x in enq_sorted[-3:]]
        old = [x[1] for x in enq_sorted[:3]]
        evol = (sum(recent) / len(recent)) - (sum(old) / len(old)) if old else 0.0
    else:
        charge = equilibre = recon = 5
        evol = 0.0

    note_perf = sorted(entr, key=lambda x: x[0])[-1][1] if entr else 3

    nb_maladie_12m = sum(1 for d0, ctype in mal if d0 and ctype == "MALADIE" and _months(TODAY, d0) <= 12)
    nb_absences_12m = sum(1 for d0, ctype in mal if d0 and ctype == "ABSENCE" and _months(TODAY, d0) <= 12)

    # Feedbacks internes récents (≤ 12 mois) : note moyenne sur 5 ; neutre (3) si aucun.
    fbk = fbk or []
    recent_fbk = [n for d, n in fbk if d and _months(TODAY, d) <= 12]
    feedback_moyen = (sum(recent_fbk) / len(recent_fbk)) if recent_fbk else 3.0

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

    rows = _build_dataset(db)
    if len(rows) < 30:
        return {"error": "Pas assez de données. Lancez advanced_seed.", "n": len(rows)}

    bundle, metrics = {}, {}
    specs = [("turnover", F_TURNOVER, "y_turnover"), ("burnout", F_BURNOUT, "y_burnout"),
             ("desengagement", F_DESENGAGEMENT, "y_desengagement")]
    for name, feats, target in specs:
        X = [_vec(r, feats) for r in rows]
        y = [r[target] for r in rows]
        if len(set(y)) < 2:  # une seule classe -> non entraînable
            metrics[name] = {"trained": False, "reason": "classe unique"}
            continue
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
        clf = RandomForestClassifier(n_estimators=120, max_depth=8, random_state=42, class_weight="balanced")
        clf.fit(Xtr, ytr)

        # KPIs d'évaluation sur le jeu de test (classe positive = 1).
        y_pred = clf.predict(Xte)
        y_proba = clf.predict_proba(Xte)[:, 1]
        acc = clf.score(Xte, yte)
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
                        "means": means, "corr_sign": corr_sign}
        metrics[name] = {
            "trained": True, "n": len(y), "positives": int(sum(y)), "test_size": len(yte),
            "accuracy": round(float(acc), 3), "precision": round(float(prec), 3),
            "recall": round(float(rec), 3), "f1": round(float(f1), 3),
            "roc_auc": round(float(auc), 3) if auc is not None else None,
            "confusion_matrix": {"tn": cm[0][0], "fp": cm[0][1], "fn": cm[1][0], "tp": cm[1][1]},
            "importances": importances,
        }

    os.makedirs(_DATA_DIR, exist_ok=True)
    joblib.dump(bundle, _MODELS_PATH)
    return {"models": metrics, "n_employes": len(rows)}


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
        probas = spec["model"].predict_proba(X)[:, 1]  # prédiction en lot
        for r, p in zip(rows, probas):
            p = float(p)
            objs.append(ScoreRisque(type=score_type, valeur=round(p, 3), niveau=_niveau(p),
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
            probas = spec["model"].predict_proba([_vec(r, spec["feats"]) for r in rows])[:, 1]
            for r, p in zip(rows, probas):
                if _niveau(float(p)) == "high":
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


def _niveau(p: float) -> str:
    return "high" if p >= 0.66 else "mid" if p >= 0.33 else "low"


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
        out["risks"][name] = {"proba": round(proba, 3), "niveau": _niveau(proba),
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
        "site": lambda r: {0: "Paris", 1: "Lyon", 2: "Bordeaux", 3: "Remote"}.get(int(r.get("site", 0)), "?"),
        "contrat": lambda r: {0: "CDI", 1: "CDD", 2: "Alternance"}.get(int(r.get("contrat", 0)), "?"),
    }

    audits = {}
    for model_name in ("turnover", "burnout", "desengagement"):
        spec = bundle.get(model_name)
        if not spec:
            continue
        probas = spec["model"].predict_proba([_vec(r, spec["feats"]) for r in rows])[:, 1]
        flagged = [1 if _niveau(float(p)) == "high" else 0 for p in probas]
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
