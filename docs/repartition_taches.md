# Répartition des Tâches - Plateforme IA RH

Ce document trace la répartition des rôles et l'avancement global de l'équipe technique.

## Yannick (Solution Architect & DevOps)

### Semaine 1 (Terminé)
- [x] Schéma d'architecture global (couches, flux, zones) → validé par toute l'équipe J3
- [x] MCD/MLD de la base de données avec Mokhtar (tables, relations, champs)
- [x] Définir le contrat API REST : nommage, versioning `/api/v1/`, format réponses
- [x] Init monorepo Git : `backend/`, `frontend/`, `infra/`
- [x] `docker-compose.yml` dev : PostgreSQL, Redis, ChromaDB, Keycloak, MinIO
- [x] `.env.example` complet → `.env` dans `.gitignore`
- [x] Interface LLMProvider avec Walid (abstraction LLM)

### Semaine 2 (Terminé)
- [x] Structure FastAPI : `api/`, `models/`, `services/`, `core/`, `tests/`
- [x] Alembic configuré + migration initiale (schéma complet)
- [x] Middleware de logging structuré (JSON) : `user_id`, `endpoint`, `status`, `latence`
- [x] Pipeline CI/CD : lint + pytest + Trivy scan à chaque PR (`.woodpecker.yml`)
- [x] `docker-compose up` reproductible en moins de 10 min → documenté dans `README.md`
- [x] Interface LLMProvider implémentée + testée avec Walid

## Mokhtar (Backend Developer)
- Co-développement endpoints structurants (auth, RBAC, CRUD de base) (En cours)
- *(À compléter avec les tâches backend)*

## Walid (AI Engineer / Dev)
- Implémentation du pipeline RAG et Agentic (Terminé)
- Configuration de ChromaDB (Terminé)
- *(À compléter avec les futures tâches IA)*
