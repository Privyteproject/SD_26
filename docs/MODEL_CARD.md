# Model Card — Modèles prédictifs RH (Synapse Digital)

**Produit :** Synapse Digital — Plateforme IA RH · **Éditeur :** Waminey Tech
**Réf. cahier :** §3.2 (détection précoce du désengagement), §4.1 (éthique, explicabilité, biais)
**Statut :** modèles entraînés sur **données synthétiques déterministes** (graine 42, 120 employés). Aucune donnée réelle. À NE PAS utiliser en production sans ré-entraînement sur données réelles consenties.

## 1. Objet
Trois classifieurs indépendants estimant un **risque RH** par collaborateur, comme **aide à la décision** (jamais une décision automatique) :
- **turnover** — risque de départ ;
- **burnout** — risque d'épuisement (horizon 12 mois) ;
- **desengagement** — risque de désengagement (horizon 12 mois).

Code : [ml_predictions.py](../backend/app/services/ml_predictions.py). API : `GET /predict/risks/{matricule}` (RH/Direction), plan d'action `GET /predict/action-plan/{matricule}` (RH/Direction/Manager scopé).

## 2. Algorithme & données
- **Algorithme :** `RandomForestClassifier` (scikit-learn), `class_weight="balanced"`. *(Choix : robuste, peu de réglage, importances natives. Alternative XGBoost non retenue pour limiter les dépendances.)*
- **Anti-fuite temporelle :** pour burnout/désengagement, séparation **temporelle** (features à T, cible observée à T+12 mois) — pas de fuite du futur.
- **Seuil de décision** calibré par maximisation du F1 (pas 0.5 par défaut).
- **Variables (work-related uniquement) :** ancienneté, charge, équilibre pro/perso, reconnaissance, feedback moyen, évolution de satisfaction, note de performance, absences/maladie 12 mois, compétence moyenne, délai depuis dernière augmentation.

## 3. Exclusion des attributs protégés (anti-discrimination — §4.1)
Les attributs **âge, genre, site, type de contrat** sont **exclus des variables** (`_PROTECTED`, non présents dans `F_TURNOVER/F_BURNOUT/F_DESENGAGEMENT`). Ils servent **uniquement** à l'audit d'équité a posteriori. *(Vérifié automatiquement : `tests/test_data_ml.py::test_protected_attributes_excluded_from_features`.)*

## 4. Performances (jeu déterministe, graine 42)

| Modèle | n | positifs | accuracy | precision | recall | F1 | ROC-AUC | seuil |
|---|---|---|---|---|---|---|---|---|
| **désengagement** | 108 | 43 | 0.926 | 1.00 | 0.818 | 0.90 | **0.903** | 0.375 |
| **burnout** | 108 | 38 | 0.852 | 0.778 | 0.778 | 0.778 | **0.833** | 0.40 |
| **turnover** | 120 | 11 | 0.367 | 0.10 | 0.667 | 0.174 | **0.543** | 0.15 |

Matrices de confusion (jeu de test) : désengagement {tn16, fp0, fn2, tp9} · burnout {tn16, fp2, fn2, tp7} · turnover {tn9, fp18, fn1, tp2}.

**Lecture honnête :** désengagement et burnout sont **exploitables** (AUC 0.90 / 0.83). Le **turnover est faible (AUC ≈ 0.54, proche du hasard)** : trop peu de positifs (11) sur données synthétiques. Il est présenté comme **indicatif** et ne doit pas fonder de décision. *(Les chiffres se reproduisent à l'identique pour toute l'équipe grâce à la graine fixe.)*

## 5. Explicabilité (§4.1)
Chaque prédiction renvoie ses **facteurs contributifs** (importances de la forêt × écart à la moyenne de cohorte × signe de corrélation) — affichés à l'utilisateur. *(Limite : ce n'est pas du SHAP ; c'est une attribution locale approchée. SHAP est une amélioration prévue.)*

## 6. Équité (audit de biais)
`fairness_audit` calcule le **taux de risque par groupe protégé** (genre, tranche d'âge, site, contrat) et le **disparate impact ratio** (règle des **4/5** : un ratio < 0.8 est signalé). Endpoint `GET /predict/fairness` (RH/Direction). *(Vérifié : `tests/test_data_ml.py::test_fairness_audit_runs`.)*

## 7. Limites & usage responsable
- Données **synthétiques** → performances non transférables telles quelles au réel.
- Modèle **non causal** : corrélations, pas causes. Un score n'est pas un jugement sur la personne.
- **Humain dans la boucle obligatoire** : aucune décision RH automatisée ; les scores nourrissent un plan d'action proposé, validé par un humain.
- **Consentement** : un collaborateur ayant retiré son consentement à la détection du désengagement est **exclu du scoring** (`tests/test_data_ml.py::test_consent_revocation_excludes_from_ml_scoring`).
- Ré-entraînement requis sur données réelles, avec base légale et minimisation, avant tout usage opérationnel.

## 8. Reproductibilité
`docker compose exec backend python -m app.db.advanced_seed --confirm` régénère le jeu déterministe ; `POST /predict/train` ré-entraîne ; métriques consultables via l'espace supervision (ModelEvaluation).
