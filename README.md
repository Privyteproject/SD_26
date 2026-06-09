# YDAYS 2026 - Plateforme IA RH 🚀

Une solution de Gestion des Ressources Humaines (SIRH) augmentée par l'Intelligence Artificielle (IA) et adaptée au contexte marocain, intégrant la protection des données personnelles (Loi 09-08).

---

## 🏛️ Architecture du Projet

Le projet adopte une architecture moderne et modulaire, entièrement conteneurisée :

```
             ┌─────────────────────────┐
             │   Navigateur Client     │
             │  (React / Tailwind v4)  │
             └────────────┬────────────┘
                          │ (Proxied requests)
                          ▼
             ┌─────────────────────────┐
             │      Vite Dev Server    │ (Port 5173)
             └────────────┬────────────┘
                          │ (localhost:5173/api/v1)
                          ▼
             ┌─────────────────────────┐
             │    FastAPI Backend      │ (Port 8000)
             └────────┬──────────────┬─┘
                      │              │
        ┌─────────────┼──────────────┼─────────────┐
        ▼             ▼              ▼             ▼
  ┌───────────┐ ┌───────────┐  ┌───────────┐ ┌───────────┐
  │ PostgreSQL│ │   Redis   │  │   MinIO   │ │ Keycloak  │
  │   (Db)    │ │  (Cache)  │  │ (Storage) │ │  (Auth)   │
  └───────────┘ └───────────┘  └───────────┘ └───────────┘
```

*   **Frontend**: React, React Router, TailwindCSS v4, Recharts, Lucide React.
*   **Backend**: FastAPI, SQLAlchemy 2.0 (Asynchrone), Alembic (Migrations), Pydantic v2.
*   **Sécurité & Authentification**: Keycloak (OAuth2/OIDC, RBAC 5 profils).
*   **Stockage de documents**: MinIO (S3 API).
*   **Base Vectorielle**: ChromaDB (RAG pour documents RH).
*   **Cache & Message Broker**: Redis.

---

## ⚙️ Démarrage Rapide (Docker Compose)

### 1. Variables d'environnement
Copiez le fichier d'exemple pour initialiser la configuration de base :
```bash
cp .env.example .env
```
Assurez-vous de renseigner votre clé `OPENROUTER_API_KEY` dans le fichier `.env` pour activer les services d'IA.

### 2. Lancement des conteneurs
Démarrez l'ensemble des services via Docker Compose :
```bash
docker compose up -d
```
Les ports exposés localement sont :
*   **Frontend**: `http://localhost:5173`
*   **Backend API**: `http://localhost:8000`
*   **Swagger Docs**: `http://localhost:8000/docs`
*   **Keycloak Admin**: `http://localhost:8080`
*   **MinIO Console**: `http://localhost:9001`

### 3. Exécuter les migrations de base de données
Pour initialiser le schéma de données PostgreSQL :
```bash
docker compose exec backend alembic upgrade head
```

---

## 📝 Résumé des Modifications Récentes (Sprint Actuel)

Durant ce cycle, l'intégration complète des API et de l'authentification de développement a été finalisée :

### 1. Infrastructure Backend & Docker Networking
*   **Correction d'Hôtes**: Résolution des variables d'environnement dans `.env` pour remplacer `localhost` par les noms de services internes du pont réseau Docker (`db`, `keycloak`, `minio`).
*   **Correction Multipart**: Ajout de `python-multipart` dans le fichier `backend/requirements.txt` pour permettre le téléversement et l'importation de fichiers (e.g. bulk-import de collaborateurs).
*   **Standardisation des Routes**: Suppression de tous les slashes de fin (`/`) dans les routes API du backend pour éviter des redirections HTML `307` inutiles.

### 2. Mécanisme de Contournement Dev (Auth Bypass)
*   **`dev-rh-token` / `dev-admin-token`**: Implémentation d'un décodage de secours dans `backend/app/core/security.py` quand `APP_ENV=dev`. Si ces tokens sont fournis dans l'en-tête d'autorisation Bearer, le backend provisionne instantanément une session locale simulée (`rh` ou `admin`) sans interroger Keycloak.

### 3. Client Frontend & Couche Service
*   **Configuration du Proxy**: Configuration de `changeOrigin: false` dans `frontend/vite.config.js` pour conserver l'en-tête d'hôte `localhost` du navigateur, évitant ainsi des erreurs `ERR_NAME_NOT_RESOLVED` sur les redirections automatiques.
*   **Client Axios Unique (`client.js`)**: Ajout d'intercepteurs de requêtes pour attacher le token Bearer actif et traitement structuré des erreurs de réponse.
*   **Service API Complet (`services.js`)**: Création de fonctions asynchrones pour l'ensemble des 20+ routes d'intégration (Collaborateurs, Congés, Documents, Métriques d'IA, Onboarding, Offboarding, Supervision, Logs d'audit).

### 4. Liaison des Pages et Affichage
*   Liaison des tableaux de bord RH et Collaborateurs avec les API d'analytique et de taux d'absentéisme.
*   Liaison du module de supervision d'IA, des alertes de sécurité, de la gestion des rôles, et des checklists onboarding/offboarding.
*   Mise en place de bannières d'alerte et de repli vers des données simulées en cas de défaillance du serveur.

---

## 🧪 Outils de Validation

*   **Test d'intégration rapide**: Un script Python autonome `test_live_apis.py` est disponible à la racine pour tester l'ensemble des routes en simulant un administrateur :
    ```bash
    python test_live_apis.py
    ```
*   **Tests Unitaires**: Pour exécuter la suite de tests unitaires et d'intégration globale :
    ```bash
    docker compose exec backend pytest
    ```
