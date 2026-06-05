# Répartition des Tâches - Plateforme IA RH

Ce document trace la répartition des rôles et l'avancement global de l'équipe technique sur 4 semaines. (Support de pilotage tenu par Malak - Project Manager).

## 1. Rôles & missions de l'équipe

| Membre | Niveau | Poste officiel | Mission principale |
|---|---|---|---|
| BENDARI Malak | B2 | Project Manager & Business/Finance Analyst | Gestion de projet, jalons, documentation, présentation + étude de viabilité, marché, go-to-market (4.6) + User Stories |
| SELMOUNI Nossayba | B1 | UI/UX Designer | Maquettes des 3 interfaces : portail collaborateur, dashboard manager, espace de supervision admin |
| JOULID El Mehdi | B1 | UI/UX Designer | Maquettes & design system (avec Nossayba) |
| SOUIRI Ilyann | B2 | Front-End Developer | Intègre les maquettes, développe l'interface web responsive, connexion aux API |
| TIENTCHEU Arush | B2 | Front-End Developer + appui Sécurité | Front + RBAC côté client + UI des alertes (en appui de Mohamed) |
| TOUZANI Mohamed | B3 | CyberSecurity Specialist | Sécurité applicative, chiffrement, moteur de supervision IA (Guardrails) |
| MOUAHIDI Walid | M1 Data | Data Architect & DevOps Engineer | Pipeline RAG, prompts système, orchestrateur de requêtes, modèles prédictifs |
| KEKE Yannick | M1 Data | Solution Architect & DevOps Engineer | Architecture globale, modèle de BD, API REST ouverte (SIRH-ready) + CI/CD + monitoring |
| TAZI Elmokhtar | B3 Data | Backend Developer | Logique métier serveur, BDD interne, auth/RBAC, workflows documentaires & agentiques |

---

## 2. Plan détaillé sur 4 semaines

### Malak — Project Manager & Business Analyst
- **S1** : Kanban + backlog + Gantt ; CR de lancement ; rédiger les User Stories (collaborateur, manager, RH) ; squelette du rapport.
- **S2** : Suivi quotidien + CR des stand-ups ; rédaction contexte / analyse du besoin / personas ; étude de marché + segmentation (4.6).
- **S3** : Suivi + déblocage ; business model / go-to-market / différenciation + comparatif coûts API (4.6) ; scénario de démo.
- **S4** : Finaliser le rapport ; slides ; coordonner les répétitions ; check-list des livrables ; vidéo de secours.

### Nossayba — UI/UX Designer
- **S1** : Prise en main Figma ; wireframes des 3 interfaces (avec Mehdi) ; benchmark visuel SaaS RH.
- **S2** : Maquettes haute-fidélité + design system (couleurs, composants) ; parcours par rôle (à figer pour le front).
- **S3** : Maquettes des écrans IA (chatbot), génération de documents, onboarding ; prototypes cliquables des modules non codés (offboarding, alertes).
- **S4** : Ajustements UX selon les retours ; accessibilité ; visuels pour les slides / le rapport.

### El Mehdi — UI/UX Designer
- **S1** : Prise en main Figma ; co-conception des wireframes ; cartes de priorisation & visualisations du dashboard.
- **S2** : Maquettes des écrans collaborateur + formulaires ; déclinaison du design system.
- **S3** : Maquettes dashboard manager + supervision admin ; visualisations (tendances, scores, alertes).
- **S4** : Finitions, cohérence visuelle ; captures d'écran pour la démo / le rapport.

### Ilyann — Front-End Developer
- **S1** : Structure React/Tailwind ; cadre les maquettes avec les UI/UX ; définit la navigation par rôle.
- **S2** : Front en place (routing, layout, login Keycloak) ; composants de base ; connexion à l'API.
- **S3** : Dashboard avec Recharts ; écran du chatbot ; intègre les maquettes.
- **S4** : Espace de supervision admin (avec Mohamed/Arush) ; polish responsive ; prêt pour la démo.

### Arush — Front-End Developer + appui Sécurité
- **S1** : Avec Ilyann, structurer le front ; se former avec Mohamed (gestion des tokens, RBAC côté client).
- **S2** : Écrans (collaborateur, génération de documents) ; auth côté front (tokens Keycloak).
- **S3** : Affichage conditionnel selon le rôle ; intègre le chat ; dès les maquettes figées : renfort backend / intégration.
- **S4** : UI des alertes de sécurité (avec Mohamed) ; tests XSS côté front ; polish.

### Mohamed — Security Specialist
- **S1** : Matrice rôles/permissions (5 profils) ; plan sécurité (chiffrement, logs, RGPD / loi 09-08) ; architecture des guardrails.
- **S2** : Sécurise l'auth/RBAC (avec Mokhtar) ; chiffrement des données sensibles ; journalisation des accès.
- **S3** : Moteur de supervision IA : logs d'interaction, détection des requêtes non autorisées, alertes + classification de gravité ; anti SQL/XSS.
- **S4** : Anti-prompt-injection + filtrage des réponses ; démo sécurité (refus + injection bloquée) ; chapitre sécurité/RGPD.

### Walid — Data Architect & DevOps
- **S1** : Architecture conversationnelle (pipeline RAG) ; clé Gemini ; interface LLMProvider avec Yannick ; conception des prompts système.
- **S2** : Ingestion des docs RH + embeddings locaux + ChromaDB ; premier appel Gemini ; le chatbot répond.
- **S3** : Orchestrateur de requêtes ; RAG enrichi (citations, redirection humaine, refus contrôlé selon le rôle) ; modèles prédictifs (effectifs, masse salariale, détection d'écarts).
- **S4** : Garde-fous anti-prompt-injection (avec Mohamed) ; explicabilité (prédictions / recommandations, éthique 4.1) ; documentation IA. Workflow offboarding.

### Yannick — Solution Architect & DevOps
- **S1** : Architecture globale (schéma des couches) ; modèle de BD interne (MCD/MLD) avec Mokhtar ; API REST ouverte (SIRH-ready) ; init Git + Docker.
- **S2** : Backend FastAPI de base ; CI/CD + environnement reproductible ; co-développe les endpoints avec Mokhtar.
- **S3** : Monitoring ; intègre les modules ; pipeline de données pour les KPI / le prédictif ; soutient le backend.
- **S4** : Intégration finale + stabilisation ; monitoring de la démo ; documentation architecture ; gel du code.

### Mokhtar — Backend Developer
- **S1** : Modélise la BDD RH avec Yannick ; PostgreSQL + SQLAlchemy/Alembic ; spécifie les endpoints + workflows.
- **S2** : Schéma + migrations ; endpoints CRUD (collaborateurs, absences) ; import de fichiers ; auth/RBAC (avec Mohamed) ; données fictives.
- **S3** : Logique métier ; génération documentaire (templates, préremplissage, historisation) ; workflow onboarding ; KPI (alimente le dashboard).
- **S4** : Maquette ; qualité des données ; tests d'intégration ; documentation backend.
