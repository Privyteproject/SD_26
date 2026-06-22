# Vérification de conformité — §3.1 & §3.2 (YDAYS 2026 « Plateforme IA RH »)

> Vérification réalisée le **2026-06-21** contre le code réel du dépôt (backend FastAPI).
> Chaque point est tracé à un fichier/endpoint. Statuts : ✅ implémenté · 🟡 partiel · ❌ absent.
>
> **Synthèse : §3.1 = 13/13 ✅ · §3.2 = 23/23 ✅** (les 2 points autrefois partiels — recommandation
> de formations et simulation what-if absentéisme/mobilité — ont été complétés).

---

## §3.1 — Pour les utilisateurs collaborateurs

### Assistant IA RH conversationnel

| Sous-point | Statut | Implémentation |
|---|---|---|
| Réponses congés/absences/paie/mobilité/procédures/politiques | ✅ | Pipeline `services/pipeline.py` (moteurs E1 RAG / E2 doc / E3 parcours / E4 prédictif) + corpus 13 politiques `services/retrieval.py` (`KNOWLEDGE`). |
| Disponibilité 24/7 via interface web | ✅ | `POST /ai/chat` (`api/v1/endpoints/ai.py`) sans restriction horaire + UI chat React (auth Keycloak/JWT requise). |
| Réponses **à partir des documents RH validés** (RAG) | ✅ | `retrieval.retrieve()` (embeddings + ChromaDB + filtrage `audience` par rôle) injecté dans le prompt E1 ; prompt interdit l'invention hors sources. |
| Redirection automatique vers un référent RH (escalade) | ✅ | `_needs_escalation()` (mots-clés sensibles) → crée alerte `escalade` (gravité high) + message standardisé + badge UI. |
| Refus contrôlé hors périmètre (RBAC) | ✅ | Types `sensible`/`predictive` réservés aux rôles élevés ; refus sans appel LLM + alerte `acces_refuse` / `acces_refuse_repete`. |

### Génération automatique de documents RH

| Sous-point | Statut | Implémentation |
|---|---|---|
| Création assistée (attestations, formulaires, demandes, synthèses, courriers) | ✅ | **10 types** dans `services/document_types.py` (attestations, demandes, note de frais, lettre de recommandation, fiches, comptes-rendus, synthèses on/offboarding, formulaire de sortie). |
| Préremplissage intelligent depuis les données autorisées | ✅ | `_emp_dict()` + rendu Jinja2 (`services/doc_preview.py`) : identité, poste, date d'entrée, département. |
| Vérification de cohérence avant validation RH | ✅ | Workflow `draft` → `preview` (jeton HMAC + Redis) → `submit` → validation RH `PATCH /documents/{id}/status` (tracée, valideur + date). |
| Historisation des documents générés | ✅ | Table `Document` (statut, dates, valideur, cle_minio) + `GET /documents`, `/my`, `/{id}/download` + stockage MinIO + `JournalAudit`. |

### Parcours d'onboarding personnalisé

| Sous-point | Statut | Implémentation |
|---|---|---|
| Calendrier d'intégration sur 30 jours | ✅ | `POST /parcours/generate/{matricule}` + `onboarding_agent.generate_plan()` (LLM, repli déterministe). |
| Synthèse des manuels internes / feuille de route / infos poste | ✅ | `POST /parcours/{matricule}/onboarding-summary` (RAG sur le corpus + synthèse LLM en 5 sections, sources tracées). |
| Recommandation formations / interlocuteurs / documents / actions | ✅ | `GET /parcours/{matricule}/recommandations` : **catalogue de formations** (`services/formations.py`, modèle `Formation`) avec matching par poste robuste aux variantes + interlocuteurs (manager, chef de dépt, référent RH) + documents RAG à lire. `GET /parcours/formations` expose le catalogue. |
| Suivi de l'avancement + alerte étape en retard | ✅ | `PATCH /parcours/taches/{id}` (statut/`completed`) + `POST /parcours/check-overdue` → alertes `parcours_retard` idempotentes (gravité high si > 7 j). |

### Expérience collaborateur améliorée

| Sous-point | Statut | Implémentation |
|---|---|---|
| Accès centralisé, réduction du temps, compréhension, autonomie | ✅ | Assistant + génération documentaire en self-service + recherche globale + espace personnel (documents, parcours, demandes) côté front. |

---

## §3.2 — Pour les équipes RH, managers et décideurs

### Base de données RH interne

| Sous-point | Statut | Implémentation |
|---|---|---|
| Centralisation (collaborateurs, absences, documents, postes, départements, entretiens, indicateurs, feedbacks) | ✅ | Modèles ORM `db/models.py` (Employe, Demande, Document, Departement, EntretienAnnuel, EnqueteEngagement, Feedback, IndicateurRH, ScoreRisque, Alerte…). |
| Alimentation : saisie manuelle, import structuré, formulaires | ✅ | `POST /employees/import` (CSV) + endpoints d'écriture (employés, absences, feedbacks) + seeds (`seed.py`, `advanced_seed.py`). |
| Mise à jour contrôlée par profils autorisés (RBAC) | ✅ | `require_roles()` sur tous les endpoints d'écriture ; périmètre manager limité à son département. |
| Architecture ouverte pour SIRH ultérieur | ✅ | `POST /webhooks/external-sirh/sync` (clé API `X-API-Key`, serveur-à-serveur). *Réserve : limité à la synchro des salaires.* |

### Dashboard RH automatisé et prédictif

| Sous-point | Statut | Implémentation |
|---|---|---|
| Production automatique des tableaux de bord | ✅ | `GET /dashboard/kpis`, `/rh`, `/analytics`, `/indicateurs` (calcul dynamique + cache Redis). |
| KPI : effectifs, absentéisme, turnover, mobilité, pyramide, masse salariale, engagement | ✅ | Les **7** existent dans `services/kpi_service.py` (chacun accepte un filtre département). |
| Visualisation par entité/département/site/équipe | ✅ | `_dept_for()` (RBAC périmètre) + ventilation par site (masse salariale, effectifs). |
| Source unique centralisée | ✅ | Toutes les agrégations lisent la base unique ; Redis = cache de perf uniquement. |

### Analyse prédictive et scénarios RH

| Sous-point | Statut | Implémentation |
|---|---|---|
| Projection effectifs & masse salariale | ✅ | `kpi_service.projection()` + `GET /dashboard/projection` (1-36 mois). |
| Simulation de scénarios turnover/absentéisme/mobilité | ✅ | `projection()` étendue : leviers `turnover_pct`, `hiring_per_month`, `raise_pct`, **`absenteisme_pct`** (jours perdus + coût estimé) et **`mobilite_pct`** (mouvements internes attendus) + totaux cumulés. |
| Détection des écarts inhabituels (anomalies) | ✅ | `kpi_service.anomalies()` (règles trimestre T vs T-1) + alertes ML `risque_eleve` (`batch_score`). |
| Rapports conformes/auditables | ✅ | `POST /rapports/generate` → PDF ReportLab (effectifs, sites, pyramide, masse, alertes) + horodatage. |

### Détection précoce du désengagement

| Sous-point | Statut | Implémentation |
|---|---|---|
| Croisement absentéisme/maladie/enquêtes/entretiens/charge/**feedbacks** | ✅ | `ml_predictions._build_dataset()` agrège 6 sources dont `Feedback` (`feedback_moyen` dans les features turnover & absentéisme). |
| Identification des signaux faibles (burnout/désengagement/départ) | ✅ | 3 Random Forest (turnover/absent/mobilité) avec probabilités et niveaux (seuils 0.66/0.33). |
| Alertes préventives managers/RH | ✅ | `batch_score()` crée des alertes `risque_eleve` (gravité high) pour les départs probables. |
| Plans d'action ciblés (entretien, charge, accompagnement, formation, mobilité) | ✅ | `action_plan()` + `GET /predict/action-plan/{matricule}`. |

### Analyse des comportements avec l'assistant IA

| Sous-point | Statut | Implémentation |
|---|---|---|
| Collecte de logs des interactions IA | ✅ | Table `InteractionIA` (prompt, réponse, tokens, modèle, `sensible`) + log à chaque échange. |
| Comportements inhabituels (accès répétés, contournement, requêtes non autorisées) | ✅ | RBAC refusal + `count_recent_refusals()` (répétition) + détection d'exfiltration (`_is_exfil`). |
| Indicateurs de sécurité | ✅ | `repo.security_stats()` + `GET /ai/security-stats` (refus 24h/7j, alertes par gravité, taux sensibles). |
| Supervision **sans exposer le contenu personnel** | ✅ | `list_ia_interactions()` = métadonnées + email masqué ; contenu réservé ADMIN via `ia_interaction_detail()` tracé (`IA_LOG_VIEW`) ; masquage PII avant LLM. |

### Alertes RH et administrateurs

| Sous-point | Statut | Implémentation |
|---|---|---|
| Déclenchement sur tentative d'accès non autorisé via l'IA | ✅ | Alerte `acces_refuse` créée à chaque refus RBAC dans la pipeline. |
| Notification des admins/RH (comportement suspect/répétitif/critique) | ✅ | `GET /alertes/prioritized` (worklist triée gravité + date), réservé RH/Direction/Admin. |
| Classification par gravité | ✅ | Catégories : `acces_refuse` / `acces_refuse_repete` / `securite` / `fuite_donnees` / `escalade` / `risque_eleve` × gravité low/mid/high. |
| Historique des alertes pour audits | ✅ | Table `Alerte` (date_creation, resolue, date_resolution) + `resolve_alerte()` + `JournalAudit`. |

### Workflows agentiques d'offboarding

| Sous-point | Statut | Implémentation |
|---|---|---|
| Formulaires de sortie personnalisés (poste/ancienneté/contexte) | ✅ | Type `formulaire_sortie` + template Jinja2 : checklist adaptée au métier (passation managériale, transfert code/portefeuille) et à l'ancienneté (bloc droits/bilan si ≥ 5 ans). |
| Suivi des étapes de conformité (matériel, accès, clôture, transfert) | ✅ | Parcours OFFBOARDING (`generate_plan`) + suivi des tâches + `check-overdue`. |
| Capitalisation des connaissances avant départ | ✅ | `POST /parcours/{matricule}/transfer-summary` (synthèse IA à partir des tâches + sujets récents). |
| Synthèse de transfert (projets, outils, contacts, procédures) | ✅ | Même endpoint, 5 sections, document `synthese_transfert` validé/consultable. |

### Pilotage RH augmenté

| Sous-point | Statut | Implémentation |
|---|---|---|
| Centralisation dans une interface unique | ✅ | `GET /dashboard/rh` (KPIs + risques + indicateurs + anomalies en un appel). |
| Priorisation automatique des situations à intervention humaine | ✅ | `list_alertes_prioritized()` (tri gravité puis date) + remontée des risques ML. |
| Aide à la décision | ✅ | Scores de risque + plans d'action + projections/simulations. |

---

## Réserves transverses (connues, non bloquantes)

- **Notifications** : alertes consultées via le dashboard (pas de push/email).
- **Seuils ML** statiques (0.66 / 0.33), non adaptatifs par département.
- **Logs IA** : prompts/réponses stockés en clair en base interne (le masquage PII s'applique avant l'appel au LLM externe, pas dans les journaux internes — accès au contenu réservé ADMIN et tracé).
- **Webhook SIRH** : entrée limitée à la synchro des salaires (architecture extensible).

## Pour réactiver pleinement la feature « feedbacks » dans le ML
La feature `feedback_moyen` est branchée mais neutre tant qu'il n'y a pas de données ; pour l'activer :
```
docker compose exec backend python -m app.db.advanced_seed --confirm   # génère feedbacks corrélés
# puis POST /predict/train
```
