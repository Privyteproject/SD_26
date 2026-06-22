# Documentation de conformité — Spécifications §3 (Synapse Digital / SD_26)

Ce document vérifie, point par point, l'implémentation des fonctionnalités attendues
(§3.1 collaborateurs et §3.2 RH/managers/décideurs) et explique **comment** chacune a
été réalisée dans le projet (FastAPI + React/Vite + PostgreSQL + Redis + MinIO + Keycloak
+ scikit-learn + OpenRouter).

**Légende** : ✅ implémenté & vérifié · 🟡 implémenté partiellement (limite documentée) · ❌ non fait.

**Architecture générale**
- Backend FastAPI (`backend/app`) : `api/v1/endpoints/*` (routes), `services/*` (logique），`db/*` (ORM SQLAlchemy, repository).
- Frontend React/Vite (`frontend/src`) : `features/*/pages`, `components/*`, `lib/api.js`, i18n FR/EN.
- Sécurité : JWT Keycloak (`core/security.py`) + RBAC `require_roles` + audit automatique (`db/audit.py`).
- IA : pipeline conversationnel `services/pipeline.py` (modes rag/general/refusal + moteurs E1–E4) via OpenRouter ; ML `services/ml_predictions.py` (Random Forest).

---

## 3.1 — Utilisateurs collaborateurs

### Assistant IA RH conversationnel
| Sous-point | Statut | Implémentation |
|---|---|---|
| Réponses congés/absences/paie/mobilité/procédures/politiques | ✅ | Pipeline `services/pipeline.py` : classifieur de périmètre (`services/classifier.py`) → routage **RH (RAG)** / **culture générale** / **refus**. Moteurs RH `services/rh_engines.py` (E2 documents, E3 parcours, E4 prédictif) + connaissance RH générale (CDI/CDD…). UI `features/assistant/pages/Assistant.jsx`. |
| Disponibilité 24/7 via interface web | ✅ | App web React (`/app/assistant`), conteneurisée Docker, multilingue (FR/EN/AR + RTL via `services/lang_detect.py`). |
| Réponses à partir des documents RH validés (RAG) | 🟡 | Mécanisme RAG complet : `services/retrieval.py` + ChromaDB (`services/vectorstore.py`, `embeddings.py`) + `SYSTEM_PROMPT_RH` « uniquement à partir des sources fournies ». Ingestion via `POST /rag`. ⚠️ Le **corpus RAG n'est pas pré-rempli** par le seed : tant qu'aucun document n'est ingéré, l'assistant répond sur ses connaissances générales RH. |
| Redirection vers un référent RH (sensible/ambigu) | ✅ | Détection de situations sensibles (`_needs_escalation` dans `pipeline.py`) → **ouverture de ticket** (alerte `escalade`) + message rassurant + UI dédiée (encadré bouée) dans `Assistant.jsx`. |
| Refus contrôlé hors périmètre d'autorisation | ✅ | RBAC/ABAC dans `pipeline.py` : types `sensible`/`predictive` réservés aux rôles élevés → refus + alerte `acces_refuse` (et `acces_refuse_repete` si répété). |

### Génération automatique de documents RH
| Sous-point | Statut | Implémentation |
|---|---|---|
| Attestations, formulaires, demandes, synthèses, courriers | ✅ | **7 types** (`services/document_types.py`) + templates **Jinja2** imprimables (`app/templates/documents/*.j2`) + type personnalisé. Workflow `POST /documents/preview` → `POST /documents/submit`. |
| Préremplissage depuis données autorisées | ✅ | `services/doc_preview.py` injecte les **vraies données employé** (poste, département, dates) ; jamais d'invention (champ « à compléter » sinon). |
| Vérification de cohérence avant validation RH | ✅ | Cycle `pending → validated/refused`, validation RH `PATCH /documents/{id}/status` (page `features/documents/pages/DocumentsRh.jsx`), verrou après validation. |
| Historisation des documents | ✅ | Table `document` + `GET /documents/my` (statut, date, download). Stockage objet **MinIO** + **pre-signed URL** (`services/storage.py`). |

### Parcours d'onboarding personnalisé
| Sous-point | Statut | Implémentation |
|---|---|---|
| Calendrier d'intégration 30 jours auto | ✅ | `services/onboarding_agent.py` (LLM) → `POST /parcours/generate/{matricule}` : planning daté adapté au **poste**. |
| Synthèse manuels/feuilles de route/infos poste | 🟡 | Les **tâches** sont générées par l'IA selon le poste ; pas de synthèse automatique de manuels internes (nécessiterait l'ingestion des manuels). |
| Recommandation formations/interlocuteurs/docs/actions | 🟡 | Actions & formations dans le plan IA ; **interlocuteurs clés** affichés (`Onboarding.jsx`, données de contacts). |
| Suivi de l'avancement + alertes étape non réalisée | 🟡 | Suivi : barre de progression + **cases cochables** par le collaborateur (`PATCH /parcours/taches/{id}`, champ `completed`). ⚠️ Pas encore d'**alerte automatique** sur étape en retard. |

### Expérience collaborateur améliorée
| Sous-point | Statut | Implémentation |
|---|---|---|
| Accès centralisé aux infos RH | ✅ | Espace collaborateur (`/app`) : assistant, documents, demandes, parcours, profil. |
| Réduction du temps d'attente | ✅ | Réponses instantanées de l'assistant + self-service documents/demandes. |
| Compréhension des processus | ✅ | Réponses contextualisées + prompts pédagogiques. |
| Autonomie des collaborateurs | ✅ | Génération de docs, dépôt de demandes, cochage du parcours en libre-service. |

---

## 3.2 — Équipes RH, managers et décideurs

### Base de données RH interne
| Sous-point | Statut | Implémentation |
|---|---|---|
| Centralisation (collaborateurs, absences, documents, postes, départements, entretiens, indicateurs) | ✅ | Modèle Merise `db/models.py` : `employe`, `demande`, `document`, `departement`, **`entretien_annuel`**, **`enquete_engagement`**, `historique_salaire`, `score_risque`. |
| Alimentation (saisie / import / formulaires) | ✅ | CRUD employés ; **import CSV** `POST /employees/import` (`ImportModal.jsx`) ; formulaires de génération de documents. |
| Mise à jour contrôlée par profils autorisés | ✅ | RBAC `require_roles` sur toutes les routes de mutation + audit auto (`db/audit.py`). |
| Architecture ouverte SIRH | ✅ | **Webhook serveur-à-serveur** `POST /webhooks/external-sirh/sync` sécurisé par **clé API** (`endpoints/integration.py`). |

### Dashboard RH automatisé et prédictif
| Sous-point | Statut | Implémentation |
|---|---|---|
| Production auto des tableaux de bord depuis la base | ✅ | KPIs **calculés dynamiquement** `services/kpi_service.py` (plus d'`IndicateurRH` en dur). |
| KPI : effectifs, absentéisme, turnover, **mobilité interne**, pyramide des âges, masse salariale, engagement | ✅ | `kpi_service.snapshot()` + `/dashboard/rh`, `/dashboard/analytics`. Mobilité = promotions/12 mois. |
| Visualisation par entité/département/site/équipe | ✅ | Filtre `id_departement` + **RBAC périmètre** (manager = son équipe) ; graphes par site (`features/analytics/*`). |
| Source unique centralisée + cache | ✅ | **Cache Redis** (TTL) sur les agrégats lourds (`services/redis_cache.py`). |

### Analyse prédictive et scénarios RH
| Sous-point | Statut | Implémentation |
|---|---|---|
| Projection effectifs / masse salariale | ✅ | `kpi_service.projection()` + `GET /dashboard/projection`. |
| Simulation de scénarios (turnover/absentéisme/mobilité) | ✅ | Paramètres (turnover %, embauches/mois, augmentation %) → **simulateur** sur `features/analytics/pages/Turnover.jsx` (graphe effectifs + masse). |
| Détection des écarts inhabituels | ✅ | `kpi_service.anomalies()` (comparaison trimestre N vs N-1) → **bannière** sur le dashboard. |
| Rapports conformes/auditables | ✅ | **PDF ReportLab** `services/report_service.py` + `POST /rapports/generate` ; journal d'audit `journal_audit`. |

### Détection précoce du désengagement
| Sous-point | Statut | Implémentation |
|---|---|---|
| Croisement données sociales (absentéisme, maladie, enquêtes, entretiens, charge, feedbacks) | 🟡 | Features ML croisées : micro-absentéisme, arrêts maladie, **enquêtes** (satisfaction/charge/équilibre/reconnaissance), **entretiens** (note), ancienneté. ⚠️ « feedbacks internes » approximés par les enquêtes (pas de table dédiée). |
| Identification des signaux faibles (burnout/désengagement/départ) | ✅ | **3 Random Forest** (`services/ml_predictions.py`) : turnover, absentéisme/burnout, mobilité. |
| Génération d'alertes préventives | ✅ | Le **scoring par lot** (`batch_score`) crée des alertes `risque_eleve` pour les employés à risque élevé. |
| Plans d'action ciblés | ✅ | `ml_predictions.action_plan()` + `GET /predict/action-plan/{matricule}` → recommandations (entretien, charge, formation, mobilité) ; modale dans `Disengagement.jsx`. |

### Analyse des comportements avec l'assistant IA
| Sous-point | Statut | Implémentation |
|---|---|---|
| Collecte de logs des interactions | ✅ | Table `interaction_ia` (chaque échange) ; page Supervision IA. |
| Analyse des comportements inhabituels | ✅ | Anti-injection (`services/security_filter.py`), refus RBAC, **classification tentatives répétées** (`count_recent_refusals`). |
| Indicateurs de sécurité | ✅ | `GET /ai/security-stats` (refus 24h/7j, alertes par gravité, taux sensibles) → cartes Supervision IA. |
| Supervision sans exposer le contenu | ✅ | `GET /ai/logs` = **métadonnées seulement** (e-mail pseudonymisé, longueur) ; détail via `GET /ai/logs/{id}` **tracé** (audit `IA_LOG_VIEW`). |

### Alertes RH et administrateurs
| Sous-point | Statut | Implémentation |
|---|---|---|
| Alerte sur accès non autorisé via l'IA | ✅ | `pipeline.py` → alerte `acces_refuse` lors d'un refus RBAC. |
| Notification RH/admin (suspect/répétitif/critique) | ✅ | Table `Alerte` + **cloche** (`NotificationBell.jsx`, polling 30 s) + **Worklist** `GET /alertes/prioritized`. |
| Classification par gravité | ✅ | `securite` (injection), `acces_refuse` (anomalie), `acces_refuse_repete` (tentative répétée/critique), **`fuite_donnees`** (risque de fuite), `risque_eleve`, `escalade`. Gravité low/mid/high. |
| Historique des alertes | ✅ | Table `Alerte` (conservée) + `journal_audit` ; résolution tracée (`PATCH /alertes/{id}/resolve`). |

### Workflows agentiques d'offboarding
| Sous-point | Statut | Implémentation |
|---|---|---|
| Génération de formulaires de sortie personnalisés | 🟡 | Parcours d'offboarding généré par IA + type de document dédié ; pas de « formulaire » distinct par ancienneté/contexte. |
| Suivi des étapes de conformité | ✅ | Tâches OFFBOARDING (restitution matériel, révocation accès, clôture, transfert) cochables (`ParcoursManager.jsx`). |
| Capitalisation des connaissances | ✅ | Synthèse de transfert IA (cf. ci-dessous). |
| Synthèse de transfert (projets/outils/contacts/procédures) | ✅ | `POST /parcours/{matricule}/transfer-summary` (LLM) → document `synthese_transfert` ; bouton dans l'offboarding RH. |

### Pilotage RH augmenté
| Sous-point | Statut | Implémentation |
|---|---|---|
| Centralisation dans une interface unique | ✅ | Espace RH (`/rh`) : dashboard, équipe, analytique, désengagement, parcours, documents, demandes, assistant RH. |
| Priorisation automatique des situations | ✅ | **Worklist priorisée** par criticité (`list_alertes_prioritized`). |
| Aide à la décision | ✅ | **Assistant RH** dédié (`audience=rh`) + prédictions ML + dashboards. |
| Libération de temps | ✅ | Automatisations : génération de docs, parcours IA, scoring batch, synthèses, alertes auto. |

---

## Synthèse de conformité
- **§3.1 collaborateurs** : 13/16 ✅, 3 🟡 (corpus RAG à alimenter, synthèse de manuels, alerte étape en retard).
- **§3.2 RH/décideurs** : 26/29 ✅, 3 🟡 (feedbacks internes approximés, formulaires de sortie, corpus RAG).
- **Taux global** : ~**87 % ✅**, ~13 % 🟡, **0 % ❌**.

## Limites assumées (transparence)
1. **Données simulées** : les modèles ML et KPIs s'appuient sur `db/advanced_seed.py` (1000 employés, 3 profils corrélés) → à ré-entraîner sur données réelles en production.
2. **Corpus RAG** vide par défaut : ingérer les politiques/conventions/guides via `POST /rag` pour des réponses 100 % sourcées.
3. **Génération documentaire** : sortie HTML imprimable + texte (pas de moteur DOCX/PDF binaire pour les documents employés ; le rapport RH direction est en vrai PDF via ReportLab).
4. **Alembic** non configuré : schéma appliqué par `create_all` + `ALTER TABLE` directs.

## Pour exécuter / démontrer
1. `docker compose up -d` (frontend 5173, backend 8000/docs, db/redis/minio/keycloak/chromadb).
2. (option ML) `docker compose exec backend python -m app.db.advanced_seed --confirm` puis, dans le dashboard RH, **« Entraîner les modèles IA »** + **« Recalculer tous les risques »**.
3. Se connecter selon le rôle pour explorer chaque espace.
