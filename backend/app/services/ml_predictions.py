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

# Features utilisées par chaque modèle (ordre = ordre des colonnes du vecteur).
F_TURNOVER = ["delai_augm_mois", "evol_satisfaction", "nb_maladie_12m", "note_perf",
              "age", "anciennete_mois", "site", "contrat", "charge", "equilibre", "recon"]
F_ABSENT = ["charge", "equilibre", "age", "site", "contrat", "recon", "note_perf", "anciennete_mois"]
F_MOBILITE = ["anciennete_mois", "note_perf", "recon"]


def _months(d1: date, d2: date) -> int:
    return max(0, (d1.year - d2.year) * 12 + (d1.month - d2.month))


def _build_dataset(db) -> list[dict]:
    """Construit une ligne de features + cibles par employé (agrégation en mémoire)."""
    from app.db.models import Demande, Employe, EnqueteEngagement, EntretienAnnuel, HistoriqueSalaire

    employees = list(db.scalars(select(Employe)))
    enquetes, entretiens, salaires, maladies = {}, {}, {}, {}
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
    for m, d0, d1 in db.execute(select(
            Demande.matricule, Demande.date_debut, Demande.date_fin).where(Demande.code_type == "MALADIE")).all():
        maladies.setdefault(m, []).append((d0, d1))

    rows = []
    for e in employees:
        mat = e.matricule
        rows.append(_features_for(e, enquetes.get(mat, []), entretiens.get(mat, []),
                                  salaires.get(mat, []), maladies.get(mat, [])))
    return rows


def _features_for(e, enq, entr, sal, mal) -> dict:
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

    nb_maladie_12m = sum(1 for d0, _ in mal if d0 and _months(TODAY, d0) <= 12)

    return {
        "matricule": e.matricule,
        "delai_augm_mois": float(delai_augm),
        "evol_satisfaction": float(evol),
        "nb_maladie_12m": float(nb_maladie_12m),
        "note_perf": float(note_perf),
        "age": float(age),
        "anciennete_mois": float(anciennete),
        "site": float(SITE_MAP.get(e.site, 0)),
        "contrat": float(CONTRAT_MAP.get(e.type_contrat, 0)),
        "charge": float(charge),
        "equilibre": float(equilibre),
        "recon": float(recon),
        # Cibles
        "y_turnover": 1 if e.statut == "LEAVING" else 0,
        "y_absent": 1 if nb_maladie_12m >= 3 else 0,
        "y_mobilite": promo_12m,
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
    specs = [("turnover", F_TURNOVER, "y_turnover"), ("absent", F_ABSENT, "y_absent"),
             ("mobilite", F_MOBILITE, "y_mobilite")]
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
        bundle[name] = {"model": clf, "feats": feats}
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
    db.execute(sa_delete(ScoreRisque).where(ScoreRisque.type.in_(["turnover", "burnout"])))
    objs = []
    for model_name, score_type in (("turnover", "turnover"), ("absent", "burnout")):
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

    # Alertes préventives : un signalement par employé à risque de départ ÉLEVÉ.
    from app.db.models import Alerte
    from app.db import repository as repo
    db.execute(sa_delete(Alerte).where(Alerte.categorie == "risque_eleve", Alerte.resolue.is_(False)))
    db.commit()
    # On calcule les probas turnover pour cibler les employés « high ».
    spec = bundle.get("turnover")
    alerted = 0
    if spec:
        probas = spec["model"].predict_proba([_vec(r, spec["feats"]) for r in rows])[:, 1]
        for r, p in zip(rows, probas):
            if _niveau(float(p)) == "high":
                repo.create_alerte(
                    db, message=f"Risque de départ élevé détecté ({r['matricule']}, {round(float(p) * 100)}%).",
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
    b = (risks.get("absent") or {}).get("niveau")
    m = (risks.get("mobilite") or {}).get("niveau")
    actions = []
    if t == "high":
        actions += [
            "Planifier un entretien de suivi RH sous 2 semaines.",
            "Revue de rémunération / perspectives d'évolution.",
            "Étudier une opportunité de mobilité interne.",
        ]
    if b == "high":
        actions += [
            "Ajuster la charge de travail à court terme.",
            "Accompagnement managérial rapproché.",
            "Proposer un point avec la médecine du travail.",
        ]
    if m == "high" and t != "high":
        actions += ["Profil mobile : proposer une formation ou une évolution de poste."]
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
    for name in ("turnover", "absent", "mobilite"):
        spec = bundle.get(name)
        if not spec:
            continue
        proba = float(spec["model"].predict_proba([_vec(row, spec["feats"])])[0][1])
        out["risks"][name] = {"proba": round(proba, 3), "niveau": _niveau(proba)}
    return out
