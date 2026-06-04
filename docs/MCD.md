# Modèle Conceptuel de Données (MCD) / Modèle Logique de Données (MLD)

Ce document présente l'architecture de la base de données relationnelle interne du projet **YDAYS 2026 - Plateforme IA RH**. Le modèle est géré par **SQLAlchemy** et **Alembic**.

## Diagramme Entité-Association (ERD)

```mermaid
erDiagram
    users {
        uuid id PK
        string keycloak_sub UK "Identifiant Keycloak"
        string email UK
        string role
        boolean is_active
        datetime created_at
    }

    employees {
        uuid id PK
        uuid user_id FK "Peut être null si non activé"
        uuid department_id FK
        uuid manager_id FK "Auto-référence (Manager)"
        string first_name
        string last_name
        string position
        date hire_date
        string status "active, inactive, onboarding, offboarding"
    }

    departments {
        uuid id PK
        string name UK
        string description
        datetime created_at
    }

    absences {
        uuid id PK
        uuid employee_id FK
        string type
        date start_date
        date end_date
        string status "pending, approved, rejected"
    }

    documents {
        uuid id PK
        uuid employee_id FK
        string type
        string file_name
        string minio_object_key UK "Référence du fichier dans MinIO"
        datetime created_at
    }

    onboarding_tasks {
        uuid id PK
        uuid employee_id FK
        string task_name
        string status "pending, completed"
        date due_date
        datetime completed_at
    }

    offboarding_tasks {
        uuid id PK
        uuid employee_id FK
        string task_name
        string status "pending, completed"
        date due_date
        datetime completed_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK "Acteur de l'action"
        string action
        string entity_type
        uuid entity_id
        jsonb changes
        string ip_address
        datetime created_at
    }

    ai_interaction_logs {
        uuid id PK
        uuid user_id FK
        text prompt
        text response
        int tokens_used
        string model_name
        datetime created_at
    }

    alerts {
        uuid id PK
        uuid user_id FK
        string type
        text message
        boolean is_read
        datetime created_at
    }

    %% Relations
    users ||--o| employees : "1 à 0..1 (Profil employé lié au compte)"
    departments ||--o{ employees : "1 à 0..* (Appartient à)"
    employees |o--o{ employees : "1 à 0..* (Est managé par)"
    
    employees ||--o{ absences : "1 à 0..* (Déclare)"
    employees ||--o{ documents : "1 à 0..* (Possède)"
    employees ||--o{ onboarding_tasks : "1 à 0..* (Doit accomplir)"
    employees ||--o{ offboarding_tasks : "1 à 0..* (Doit accomplir)"

    users ||--o{ audit_logs : "1 à 0..* (Génère une trace)"
    users ||--o{ ai_interaction_logs : "1 à 0..* (Interagit avec l'IA)"
    users ||--o{ alerts : "1 à 0..* (Reçoit)"
```

## Description des Domaines

### 1. Domaine Utilisateurs & Sécurité (Auth / RBAC)
- **`users`** : Table centrale de l'authentification. Elle ne stocke pas de mot de passe car l'authentification est déléguée à Keycloak. Le champ `keycloak_sub` fait le lien avec l'Identity Provider.
- **`audit_logs`** : Permet la traçabilité complète des actions sensibles (CRUD, modération) pour la conformité sécurité.
- **`alerts`** : Notifications poussées aux utilisateurs (sécurité, workflow RH).

### 2. Domaine Ressources Humaines (SIRH Core)
- **`employees`** : Table principale du métier RH contenant les informations personnelles et organisationnelles de l'employé.
- **`departments`** : Nomenclature des départements.
- **`absences`** : Gestion des congés et absences.
- **`documents`** : Pointeurs vers les documents réels stockés dans MinIO via le champ `minio_object_key`.
- **`onboarding_tasks` / `offboarding_tasks`** : Listes de contrôle (checklists) pour l'intégration et le départ des collaborateurs.

### 3. Domaine Intelligence Artificielle (RAG / LLM)
- **`ai_interaction_logs`** : Conserve l'historique des prompts et réponses générées par les modèles de LLM (Gemini/Mistral) pour un utilisateur, permettant l'analyse de l'usage, le calcul des coûts (tokens), et l'audit des "guardrails".
