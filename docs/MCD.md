# Modèle Conceptuel de Données (MCD) / Modèle Logique de Données (MLD) - Synapse App

Ce document présente l'architecture de la base de données relationnelle interne du projet **YDAYS 2026 - Plateforme IA RH (Synapse Digital)**. Le modèle est géré par **SQLAlchemy** et contient 18 tables structurantes pour la gestion RH complète.

## Diagramme Entité-Association (ERD)

```mermaid
erDiagram
    %% ───────────────────────── Référentiels ─────────────────────────
    role {
        string code_role PK
        string libelle
    }

    type_demande {
        string code_type PK
        string libelle
    }

    modele_document {
        string code_modele PK
        string libelle
        text gabarit
    }

    modele_tache {
        string code_tache PK
        string libelle
        string type_parcours "ONBOARDING/OFFBOARDING"
        int ordre
        int delai_jours
    }

    %% ───────────────────────── Identité / RH ─────────────────────────
    utilisateur {
        int id_utilisateur PK
        string keycloak_sub UK "Identifiant Keycloak"
        string email UK
        boolean actif
        datetime date_creation
        string code_role FK
    }

    departement {
        int id_departement PK
        string nom UK
        text description
        datetime date_creation
        string matricule_chef FK
    }

    employe {
        string matricule PK
        string nom
        string prenom
        string poste
        date date_embauche
        string statut "NEW, ACTIVE, LEAVING"
        int id_departement FK
        string matricule_manager FK
        int id_utilisateur FK UK
    }

    dossier_confidentiel {
        string matricule PK "FK vers employe"
        string cin UK
        text adresse
    }

    historique_salaire {
        int id_historique PK
        numeric montant
        date date_effet
        string matricule FK
    }

    %% ───────────────────────── Demandes RH ─────────────────────────
    demande {
        int id_demande PK
        datetime date_depot
        date date_debut
        date date_fin
        text detail
        string statut "pending, validated, refused"
        date date_decision
        text commentaire
        string matricule FK
        string code_type FK
        int id_decideur FK
    }

    %% ───────────────────────── Documents ─────────────────────────
    document {
        int id_document PK
        string nom_fichier
        string cle_minio UK
        string statut
        datetime date_creation
        date date_validation
        string matricule FK
        string code_modele FK
        int id_valideur FK
    }

    %% ───────────────────────── Parcours (On/Offboarding) ─────────────────────────
    tache_parcours {
        int id_tache PK
        string statut "todo, in_progress, done"
        date date_echeance
        date date_realisation
        string code_tache FK
        string matricule FK
    }

    %% ───────────────────────── IA ─────────────────────────
    interaction_ia {
        int id_interaction PK
        text prompt
        text reponse
        int tokens_used
        string model_name
        string statut
        boolean sensible
        datetime date_creation
        int id_utilisateur FK
    }

    source_ia {
        int id_interaction PK FK
        int id_document PK FK
    }

    %% ───────────────────────── Pilotage / Audit ─────────────────────────
    alerte {
        int id_alerte PK
        string categorie
        string gravite "low, mid, high"
        text message
        boolean confidentielle
        boolean lue
        boolean resolue
        datetime date_creation
        date date_resolution
        int id_destinataire FK
        string matricule FK
        int id_resolveur FK
    }

    score_risque {
        int id_score PK
        string type "desengagement, burnout"
        numeric valeur
        string niveau "low, mid, high"
        date date_calcul
        string matricule FK
    }

    indicateur_rh {
        int id_indicateur PK
        string type "turnover, absenteisme, engagement"
        numeric valeur
        string periode
        date date_calcul
        int id_departement FK
    }

    journal_audit {
        int id_log PK
        string action
        string type_entite
        string id_entite
        text changements
        string adresse_ip
        datetime date_creation
        int id_utilisateur FK
    }

    %% Relations
    role ||--o{ utilisateur : "Définit"
    utilisateur ||--o| employe : "Compte lié"
    
    employe |o--o{ employe : "Manage"
    employe }o--o| departement : "Appartient à"
    departement |o--o| employe : "Est dirigé par"
    
    employe ||--|| dossier_confidentiel : "Possède (données sensibles)"
    employe ||--o{ historique_salaire : "Historique de rémunération"
    
    employe ||--o{ demande : "Soumet"
    type_demande ||--o{ demande : "Catégorise"
    utilisateur |o--o{ demande : "Valide/Décide"
    
    employe ||--o{ document : "Concerne"
    modele_document |o--o{ document : "Basé sur"
    utilisateur |o--o{ document : "Valide"
    
    employe ||--o{ tache_parcours : "Doit accomplir"
    modele_tache ||--o{ tache_parcours : "Instancie"
    
    utilisateur ||--o{ interaction_ia : "Initie"
    interaction_ia ||--o{ source_ia : "S'appuie sur"
    document ||--o{ source_ia : "Est cité dans"
    
    employe |o--o{ alerte : "Concerne"
    utilisateur |o--o{ alerte : "Est destinataire de"
    
    employe ||--o{ score_risque : "Est évalué"
    departement |o--o{ indicateur_rh : "Agrège les KPIs"
    
    utilisateur |o--o{ journal_audit : "Génère trace"
```

## Description des Domaines

### 1. Référentiels (Dictionnaires de données)
Les tables `role`, `type_demande`, `modele_document` et `modele_tache` stockent les paramètres statiques de l'application (ex: Liste des types de congés, liste des tâches d'onboarding).

### 2. Identité & Core RH
- **`utilisateur`** : Lien avec Keycloak (`keycloak_sub`).
- **`employe`** : Coeur de métier RH. Gère la hiérarchie (manager) et l'affectation (`departement`).
- **`dossier_confidentiel`** : Isolation RGPD (Relation 1:1) des données chiffrées (CIN, Adresse).
- **`historique_salaire`** : Traçabilité des augmentations.

### 3. Processus RH & Documents
- **`demande`** : Table générique (Absences, Télétravail, etc.) avec workflow de validation.
- **`document`** : Pointeurs vers le stockage d'objets (MinIO via `cle_minio`).
- **`tache_parcours`** : Tâches d'intégration/départ instanciées depuis `modele_tache`.

### 4. IA & Guardrails
- **`interaction_ia`** : Log de chaque prompt/réponse. Gère l'audit des coûts (`tokens_used`) et le flag `sensible`.
- **`source_ia`** : Table de liaison RAG (Trace quel document MinIO a été utilisé par l'IA pour générer sa réponse).

### 5. Pilotage, Risques & Audit
- **`alerte`** : Notifications poussées (IA détectant un ton agressif, ou expiration d'un document).
- **`score_risque`** : Calculs prédictifs sur les employés (burnout, désengagement).
- **`indicateur_rh`** : Données agglomérées pour le dashboard.
- **`journal_audit`** : Logging strict et immuable des actions sensibles (Mutation CRUD).
