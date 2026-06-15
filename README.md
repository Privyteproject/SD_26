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

**Magie DevOps :** Le conteneur du backend exécute automatiquement les migrations de base de données (Alembic) au démarrage, avant de lancer le serveur FastAPI.

### Accès aux services :
- **Frontend** : http://localhost:5173
- **Backend API (Swagger)** : http://localhost:8000/docs
- **Keycloak** : http://localhost:8080
- **MinIO Console** : http://localhost:9001
