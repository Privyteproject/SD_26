# Synapse Digital — API (FastAPI) · v1

Backend de la plateforme IA RH. Routeur **v1** agrégé sous `/api/v1`
(= `BASE` du front, `lib/api.js`). Persistance **SQLAlchemy fidèle au MLD v1.0
(18 tables)**, auth **Keycloak (JWT)**, assistant branché sur l'**API Anthropic**
avec journalisation des échanges.

## Démarrage
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000   # Swagger: /docs
```
1er lancement : tables créées + données de démo semées (SQLite `synapse.db`).

## Modèle de données (conforme au MLD Merise v1.0)

`app/db/models.py` implémente les 18 tables : `role`, `utilisateur`, `employe`,
`dossier_confidentiel`, `departement`, `historique_salaire`, `type_demande`,
`demande`, `modele_document`, `document`, `modele_tache`, `tache_parcours`,
`interaction_ia`, `source_ia`, `alerte`, `score_risque`, `indicateur_rh`,
`journal_audit`.

Points clés repris du MLD :
- **UTILISATEUR (compte) ≠ EMPLOYE (personne)** : l'email et le rôle sont portés
  par `utilisateur` ; `employe` est rattaché via `id_utilisateur` (UK).
- **RBAC** : rôle en table `role` (FK), plus de texte libre.
- **Les absences sont des `demande`** dont `code_type ∈ {CONGE, MALADIE,
  TELETRAVAIL, RTT}` — l'endpoint `/absences` filtre dessus.
- **1:1** `dossier_confidentiel` (PK = FK vers `employe`, RGPD / loi 09‑08).
- **Réflexive** `employe.matricule_manager` (hiérarchie).
- **N:M** `source_ia` (interaction_ia ↔ document).
- `montant` en `NUMERIC(12,2)`, index sur FK + colonnes de recherche.

### Pont API ↔ MLD (sans casser le front)
Le front manipule un format plat (`employees`, `absences`). La couche
`repository.py` traduit :
- `employees` → `employe` (+ `utilisateur` pour email/rôle). `to_dict()` expose
  `id = matricule`, `email`, `role`, `department_id` (id) et `department` (nom).
- création d'employé → crée le **couple `utilisateur` + `employe`**.
- `department_id` reçu du front : résolu par **id OU nom** (`resolve_departement_id`).
- `absences` → `demande` ; `PATCH .../status` trace `date_decision` + décideur.

> Tables non encore exposées par un endpoint (documents, parcours, alertes,
> scores, indicateurs, audit) : schéma prêt, à brancher au fil des features.

## Assistant IA (OpenRouter) — agent + juge
`app/services/ai.py` appelle OpenRouter (`/api/v1/chat/completions`, format
compatible OpenAI, via urllib — aucune dépendance ajoutée). **Deux modèles** :
- `AGENT_MODEL` pour les réponses (défaut `google/gemma-4-31b-it`),
- `JUDGE_MODEL` pour l'évaluation LLM-as-judge (défaut `qwen/qwen3.6-27b`).

`POST /ai/chat` renvoie la réponse de l'agent ; avec `{"judge": true}` il y ajoute
une évaluation JSON (note 1‑5, verdict, critères). `POST /ai/judge` évalue un
couple (question, réponse) à la demande. Prompt système RH (pas d'invention de
données, pas de conseil juridique/médical). Sans `OPENROUTER_API_KEY` → mode démo.
Chaque échange est journalisé dans `interaction_ia`.

> La clé OpenRouter (`sk-or-v1-...`) se met **uniquement dans `.env`** (protégé
> par `.gitignore`), jamais dans le code.

## Auth & rôles
JWT Keycloak (Bearer) ; rôle dérivé de `realm_access.roles` avec le **même
mapping/priorité que le front** (`lib/tokens.js`). `AUTH_VERIFY_SIGNATURE=false`
en dev, `true` en prod (vérif JWKS).

## Endpoints (v1)
| Méthode | Chemin | Accès |
|---|---|---|
| GET | /employees/me | authentifié |
| GET/POST | /employees | lecture: ADMIN+espace RH · écriture: ADMIN/RH/DIRECTION |
| GET/PUT/DELETE | /employees/{matricule} | idem |
| GET/POST | /absences | authentifié (collab = siennes) |
| PATCH | /absences/{id}/status | ADMIN/RH/MANAGER/DIRECTION |
| GET | /absences/stats | ADMIN/RH/MANAGER/DIRECTION |
| GET | /demandes/types | authentifié |
| GET/POST | /demandes | authentifié (collab = siennes) |
| GET | /demandes/{id} | propriétaire ou rôle élevé |
| PATCH | /demandes/{id}/status | ADMIN/RH/MANAGER/DIRECTION |
| GET | /parcours/modeles | authentifié |
| POST | /parcours/{matricule}/init | ADMIN/RH/MANAGER/DIRECTION |
| GET | /parcours/{matricule} | l'employé concerné ou rôle élevé |
| PATCH | /parcours/taches/{id} | ADMIN/RH/MANAGER/DIRECTION |
| GET/POST | /documents | génération; collab = siens |
| GET | /documents/modeles | authentifié |
| GET | /documents/{id} | propriétaire ou rôle élevé |
| PATCH | /documents/{id}/status | ADMIN/RH/DIRECTION (validation tracée) |
| GET | /dashboard/kpis | authentifié |
| GET | /dashboard/rh | espace RH (RH/MEDECINE/DIRECTION/MANAGER/ADMIN) |
| GET | /dashboard/risques | RH/MEDECINE/DIRECTION/ADMIN (confidentiel) |
| GET | /dashboard/indicateurs | espace RH |
| POST | /ai/chat · /ai/judge | authentifié |

## Pipeline conversationnelle (services/pipeline.py)

`POST /ai/chat` exécute désormais la pipeline complète du schéma RAG v2 :
rate-limit → sécurité (anti-injection) → classification (périmètre + type RH) →
cache sémantique → routage (RH / culture / hors-sujet / dangereux) →
[RH] RBAC/ABAC → RAG (récupération filtrée par rôle + reranking + garde
anti-hallucination) → prompt enrichi → **masquage PII** → LLM (agent Gemma +
**fallback**) → post-filtrage → validation → **juge Qwen** → conformité
(reformulation si note < seuil) → audit (`interaction_ia`).

Briques (toutes locales, sans dépendance, remplaçables) :
`security_filter`, `classifier`, `pii`, `cache`, `rate_limit`, `retrieval`
(base de connaissances RH filtrée par `audience`). La réponse renvoie un bloc
`meta` (perimetre, type_rh, authorized, sources, pii_masked, cache_hit…).

> Points marqués « PROVISOIRE » à industrialiser : embeddings + ChromaDB à la
> place de la similarité lexicale ; cache vectoriel ; NER pour le PII ; Redis
> pour le rate-limit multi-instances. Les interfaces ne changeront pas.

## RAG : embeddings + vector store (ChromaDB)

La récupération documentaire passe par deux couches abstraites, **pluggables** :
- `app/services/embeddings.py` — backends : `hash` (local, défaut de repli),
  `st` (sentence-transformers, vrais embeddings locaux), `openrouter` (`/embeddings`).
- `app/services/vectorstore.py` — backends : `memory` (repli) et `chroma` (persistant).

`RAG_VECTOR_BACKEND=auto` / `RAG_EMBED_BACKEND=auto` choisissent automatiquement
ChromaDB + sentence-transformers s'ils sont installés (`pip install -r requirements-rag.txt`),
sinon ils retombent sur mémoire + hashing — le RAG **tourne donc sans rien installer**.

`app/services/retrieval.py` garde l'interface `retrieve(query, role, k)` : il embedde
la requête, interroge le store, puis **filtre par `audience`/rôle** (« documents RH
autorisés uniquement »).

Endpoints `/rag` :
- `POST /rag/ingest` (ADMIN/RH) — indexe des chunks `{title, text, audience}` ;
- `GET /rag/search?q=` — récupération filtrée par le rôle de l'appelant (preview) ;
- `GET /rag/stats` — backend embeddings/vector + nombre de chunks.

> Le seuil `RAG_MIN_SCORE` dépend du backend d'embeddings (~0.05 en hashing,
> ~0.30 en sentence-transformers).

## Test
```bash
python smoke_test.py   # base SQLite temporaire + IA en mode démo + vérifs MLD
```
