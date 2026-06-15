# Architecture Technique V2 (Synapse-App)

Ce document décrit la nouvelle architecture globale de la plateforme **YDAYS 2026 - IA RH (Synapse Digital)** suite à l'intégration de la nouvelle base de code.

## Diagramme d'Architecture Cible

```mermaid
flowchart TD
    %% Couche Utilisateur
    subgraph "Clients / Utilisateurs"
        Browser[Navigateur Web\nEmployé / Manager / RH]
    end

    %% Couche Frontend
    subgraph "Couche Présentation (Frontend)"
        ReactApp[Application React\n+ ViteJS + TailwindCSS]
    end

    %% Fournisseur d'Identité
    subgraph "Identité & Sécurité (Docker)"
        Keycloak[Serveur Keycloak\nOIDC / RBAC]
    end

    %% Couche Backend (Core API)
    subgraph "Couche Applicative (Backend - FastAPI)"
        FastAPI[Serveur FastAPI\nPort 8000]
        Router[API Router\n/api/v1/]
        
        subgraph "Modules Métiers"
            AuthModule[Module Auth/JWT]
            RHModule[Module CRUD RH\nEmployés, Demandes]
            IAModule[Module IA & RAG]
        end
        
        FastAPI --> Router
        Router --> AuthModule
        Router --> RHModule
        Router --> IAModule
    end

    %% Couche Données
    subgraph "Couche Données & Services (Docker)"
        Postgres[(PostgreSQL 16\nBase Relationnelle\n18 Tables)]
        MinIO[(MinIO / S3\nStockage Documents)]
        ChromaDB[(ChromaDB\nBase Vectorielle)]
        Redis[(Redis\nCache & Session)]
    end

    %% API Externes
    subgraph "LLM Provider (Cloud)"
        OpenRouter[OpenRouter API\nGemma 4 / Qwen]
    end

    %% Flux de données
    Browser <-->|HTTP/REST| ReactApp
    ReactApp <-->|JWT / OIDC| Keycloak
    ReactApp <-->|Appels API REST| FastAPI
    
    AuthModule <-->|Validation JWKS| Keycloak
    RHModule <-->|SQLAlchemy (Sync)| Postgres
    RHModule <-->|Upload/Download| MinIO
    
    IAModule <-->|Requêtes Embeddings| ChromaDB
    IAModule <-->|Chat & Évaluation| OpenRouter
    
    FastAPI -.->|Mise en cache| Redis

    %% Styles
    classDef frontend fill:#3b82f6,stroke:#1e40af,stroke-width:2px,color:white;
    classDef backend fill:#10b981,stroke:#047857,stroke-width:2px,color:white;
    classDef db fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:white;
    classDef auth fill:#8b5cf6,stroke:#5b21b6,stroke-width:2px,color:white;
    classDef external fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:white;

    class ReactApp frontend;
    class FastAPI,Router,AuthModule,RHModule,IAModule backend;
    class Postgres,MinIO,ChromaDB,Redis db;
    class Keycloak auth;
    class Browser,OpenRouter external;
```

## Évolutions majeures de l'architecture V2

1. **Richesse du Modèle Relationnel (PostgreSQL)** : La base passe à 18 tables complètes gérant le "Core RH" (Départements, Employés, Rémunération) et la "Sécurité" (Guardrails, Logs IA, Alertes).
2. **Couplage Frontend/Backend simplifié** : Le proxy local de Vite redirige directement les appels `/api` vers FastAPI.
3. **Pipeline RAG Hybride** : L'IA ne tourne plus nécessairement en local pur. FastAPI interroge **OpenRouter** pour bénéficier des modèles les plus performants (Gemma, Qwen) tout en gardant ChromaDB en local pour injecter le contexte RH (RAG) dans les requêtes.
4. **Authentification** : Keycloak reste le maître des identités, FastAPI valide la signature JWT (JWKS) de chaque requête.
