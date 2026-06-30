# SD_26

Projet YDAYS 2026 - Solution RH augmentee par IA.

## Etat du travail documente

La documentation technique actuelle du travail realise se trouve dans :

- [backend/README.md](./backend/README.md)

Elle couvre :

- l'interface `LLMProvider`
- l'integration OpenRouter
- la conception des prompts systeme
- le pipeline IA RH
- l'ingestion des documents RH
- les embeddings locaux
- ChromaDB
- les procedures de test et verification

## Livrable backend actuellement valide

Le MVP backend permet deja :

- de lancer une API FastAPI
- d'indexer des documents RH dans ChromaDB
- d'utiliser un pipeline RAG avec filtrage par role
- d'interroger un LLM via OpenRouter

## Démarrage Rapide (Reproductible en moins de 10 minutes)

L'architecture locale est entièrement conteneurisée. Voici comment lancer l'ensemble du projet (Backend, Frontend, PostgreSQL, Redis, MinIO, Keycloak, ChromaDB) :

1. Assurez-vous d'avoir Docker et Docker Compose installés.
2. Copiez le fichier `.env.example` en `.env` à la racine :
   ```bash
   cp .env.example .env
   ```
3. (Optionnel) Modifiez les variables dans le `.env` si nécessaire.
4. Lancez l'infrastructure :
   ```bash
   docker compose up -d --build
   ```

**DevOps :** au démarrage, le backend crée le schéma puis applique des **migrations légères idempotentes** (`create_all` + `ALTER ... ADD COLUMN IF NOT EXISTS` dans `db/base.py`), avant de lancer FastAPI. *(Le passage à des migrations Alembic versionnées est une amélioration prévue.)*

### Jeu de données de démo (IDENTIQUE pour toute l'équipe)

Les données métier (employés, salaires, contrats, compétences, scores de risque…) ne sont **pas** versionnées dans Git : seul le **générateur** l'est. Au **premier** `docker compose up` (base **vide**), le backend sème automatiquement un **jeu DÉTERMINISTE** (graine fixe) : **120 employés**, historiques, compétences, puis entraînement ML + scoring. Résultat : **tout le monde obtient exactement les mêmes données** (mêmes noms, salaires, etc.) pour des tests reproductibles. Une base **déjà peuplée n'est jamais réécrasée** au démarrage.

- Contrôlé par `SEED_MODE` dans `.env` : `demo` (défaut, jeu complet) · `minimal` (8 comptes) · `none`. **En production : `SEED_MODE=none`.**
- Régénérer/réinitialiser manuellement le jeu de démo (DESTRUCTIF) :
  ```bash
  docker compose exec backend python -m app.db.advanced_seed --confirm
  ```
- Comptes de démo (mot de passe `demo1234`) : `admin@`, `direction@`, `rh@`, `manager@`, `medecine@`, `collaborateur@`, `nouveau@`, `depart@` `waminey.ma`.

### Accès aux services :
- **Frontend** : http://localhost:5173
- **Backend API (Swagger)** : http://localhost:8000/docs
- **Keycloak** : http://localhost:8080
- **MinIO Console** : http://localhost:9001

## Tests automatisés

Suite `pytest` (RBAC/ABAC, sécurité de l'assistant IA, ML & conformité) sur **SQLite isolé** + IA en **mode démo** (aucun service externe requis) :

```bash
# Dans le conteneur backend :
docker compose exec backend python -m pytest
# Ou en local : cd backend && pip install -r requirements-test.txt && pytest
```

CI : [.github/workflows/tests.yml](.github/workflows/tests.yml) exécute la suite à chaque push/PR, en plus de Semgrep (SAST) et Trivy (scan d'images).

## Documentation & conformité

- [Conformité RGPD / loi 09-08](docs/CONFORMITE_RGPD_0908.md) — registre des finalités, consentement, droits, anonymisation.
- [Rapport de sécurité](docs/RAPPORT_SECURITE.md) — modèle de menace STRIDE, contrôles, risques résiduels.
- [Rapport de tests d'intrusion](docs/RAPPORT_PENTEST.md) — Appendix D, contrôles rejoués automatiquement.
- [Model Card IA](docs/MODEL_CARD.md) — algorithme, métriques, biais, limites.
- [Charte éthique de l'IA](docs/AI_ETHICS.md) — principes §4.1.
- Architecture : `docs/architecture_technique_ydays26.drawio - Architecture Plateforme IA RH.png`.
