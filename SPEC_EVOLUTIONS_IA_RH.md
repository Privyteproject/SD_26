# Spécification fonctionnelle — Évolutions de la plateforme IA RH (Synapse Digital)

> Document de cadrage fonctionnel. Chaque évolution est décrite avec : description,
> utilisateurs concernés, cas d'usage, règles métier, bénéfices, impacts UI, et
> améliorations techniques. Les références au code existant (tables, endpoints,
> composants) servent de point d'ancrage pour l'implémentation.

## Rappel de l'architecture actuelle (base de travail)

- **Backend** FastAPI + SQLAlchemy. Pipeline conversationnel `app/services/pipeline.py`
  (modes `rag` / `general` / `refusal`, moteurs RH `E1` RAG, `E2` génération doc,
  `E3` parcours, `E4` prédictif).
- **Persistance IA** : table `interaction_ia` (prompt, réponse, statut, tokens, sensible,
  utilisateur) — déjà alimentée par `_audit()` à chaque échange.
- **Documents** : tables `document` (statuts `draft/pending/validated/refused`) +
  `modele_document` (gabarits). Endpoints `/documents`, `/documents/{id}/status`,
  `/documents/{id}/download`. Validation RH via la page `DocumentsRh.jsx`.
- **Front** React/Vite : `Assistant.jsx`, `Documents.jsx`, espaces collaborateur / RH / admin.
- **Sécurité** : JWT Keycloak + RBAC (`require_roles`), audit automatique (`journal_audit`).

---

## 1. Historique des chats

### Description
Conserver et restituer les conversations de chaque utilisateur avec l'assistant IA :
liste des conversations passées, ouverture d'une conversation, reprise du fil (avec
contexte), et traçabilité (date, périmètre, modèle).

### Utilisateurs concernés
Tous les utilisateurs authentifiés (collaborateur, manager, RH, direction, admin).
Chaque utilisateur ne voit **que ses propres** conversations ; l'admin garde la
supervision globale via la page Supervision IA existante.

### Cas d'usage principaux
- Consulter la liste de mes conversations (titre, date, dernier message).
- Rouvrir une conversation et **reprendre** la discussion là où elle s'est arrêtée.
- Renommer / supprimer une conversation.
- Rechercher dans mes conversations (cf. §4 Barre de recherche).

### Règles métier
- Une **conversation** regroupe N échanges (tours question/réponse) liés.
- L'historique est **strictement cloisonné par utilisateur** (RBAC : l'utilisateur ne
  lit que `id_utilisateur = courant`).
- Le **titre** est auto-généré à partir du 1ᵉʳ message (tronqué), renommable.
- Les messages restent soumis aux règles PII/sécurité existantes (pas de stockage de
  données masquées en clair au-delà de ce qui existe déjà).
- Suppression = **soft delete** (conservation pour l'audit `journal_audit`).
- Rétention configurable (ex. 12 mois) — purge automatique au-delà.

### Bénéfices attendus
Continuité d'expérience, gain de temps (reprise de contexte), traçabilité des demandes,
auto-support (l'utilisateur retrouve une réponse déjà obtenue).

### Impacts UI
- Panneau latéral « Conversations » dans `Assistant.jsx` (liste + bouton « Nouvelle
  conversation »).
- Au clic sur une conversation : rechargement des messages dans le fil.
- Actions par conversation (renommer / supprimer) via le menu contextuel (§7).

### Améliorations techniques
- Nouvelle table `conversation_ia` (id, id_utilisateur, titre, date_creation,
  date_maj, archivée) + ajout d'une FK `id_conversation` sur `interaction_ia`
  (migration Alembic ; **ne pas casser** l'existant : colonne nullable).
- Endpoints : `GET /ai/conversations`, `GET /ai/conversations/{id}` (messages),
  `POST /ai/conversations` (création), `PATCH /ai/conversations/{id}` (renommer/archiver),
  `DELETE /ai/conversations/{id}` (soft delete).
- `POST /ai/chat` accepte un `conversation_id` optionnel ; l'historique envoyé au LLM
  est reconstruit côté serveur depuis la conversation (au lieu de dépendre du client).

---

## 2. Génération de documents → brouillon avant soumission

### Description
Un document généré par l'IA **n'est jamais soumis automatiquement**. Il est créé en
**brouillon** (`draft`) dans la section « Documents », où l'utilisateur peut le
consulter, le modifier, puis **confirmer explicitement** la soumission (`pending`),
qui déclenche le circuit de validation RH existant.

### Utilisateurs concernés
- **Collaborateur / Manager** : génèrent, relisent, modifient, soumettent leurs documents.
- **RH / Direction** : valident ou refusent les documents soumis (`DocumentsRh.jsx`).

### Cas d'usage principaux
1. L'utilisateur demande à l'IA un document (via Assistant ou bouton « Générer »).
2. Le document apparaît en **brouillon** dans « Documents ».
3. L'utilisateur le **relit / modifie** le contenu.
4. Il clique **« Soumettre »** → statut `pending` → visible côté RH.
5. RH **valide** (`validated`) ou **refuse** (`refused`, avec motif).

### Règles métier
- Cycle de statut : `draft → pending → validated | refused`. Retour `refused → draft`
  autorisé (correction puis re-soumission).
- Tant qu'il est en `draft`, le document est **modifiable** par son auteur uniquement.
- La **soumission est explicite** (action utilisateur) — jamais implicite à la génération.
- Un document `validated` devient **non modifiable** (verrouillé, téléchargeable).
- Toute transition de statut est tracée (`journal_audit`).
- Le contenu reste lié à un `modele_document` (type) + données réelles de l'employé.

### Bénéfices attendus
Contrôle qualité, réduction des erreurs, conformité (rien n'est soumis sans relecture),
responsabilisation de l'utilisateur, charge RH réduite (documents déjà relus).

### Impacts UI
- L'IA renvoie un **aperçu** + bouton « Enregistrer en brouillon » (pas d'envoi direct).
- Section « Documents » : onglets/filtre par statut (Brouillons / En attente / Validés /
  Refusés), éditeur de contenu pour les brouillons, bouton « Soumettre ».
- Badge de statut clair + motif de refus affiché.

### Améliorations techniques
- `document` : champ `contenu` (Text) éditable + réutilisation du statut `draft` existant.
- Endpoints : `POST /documents` (crée en `draft`), `PATCH /documents/{id}` (édition contenu,
  auteur + statut `draft` uniquement), `PATCH /documents/{id}/status` (soumission/validation).
- Le moteur **E2** (`rh_engines.py`) produit le **contenu proposé** mais persiste en `draft`.

---

## 3. Types de documents multiples

### Description
Étendre la génération au-delà des attestations : plusieurs types de documents RH,
pilotés par les **modèles** (`modele_document`), plus un type **personnalisé**.

### Utilisateurs concernés
Collaborateur, Manager (génération) ; RH (gestion des modèles + validation).

### Types cibles (exemples)
Attestation de travail · Demande de congé · Certificat · Lettre administrative ·
Document d'onboarding · Document d'offboarding · Compte rendu · **Document personnalisé**.

### Cas d'usage principaux
- Choisir un **type** au moment de la génération (liste des modèles disponibles).
- Générer un document personnalisé en décrivant le besoin à l'IA.
- RH : **créer / modifier / désactiver** des modèles (gabarits).

### Règles métier
- Chaque type = un `modele_document` (code, libellé, gabarit, catégorie).
- Le gabarit peut contenir des **champs dynamiques** (nom, poste, dates…) remplis depuis
  les données réelles de l'employé (jamais inventées — cohérent avec E2).
- Certains types peuvent être **restreints par rôle** (ex. lettre administrative = RH).
- Le type « personnalisé » suit le même circuit brouillon → soumission → validation.

### Bénéfices attendus
Couverture fonctionnelle élargie, autonomie des utilisateurs, standardisation des
documents, moins de ressaisie.

### Impacts UI
- Sélecteur de **type de document** (modèles) dans l'Assistant et dans « Documents ».
- Espace RH : gestion des modèles (similaire au `ModeleManager` déjà fait pour les parcours).

### Améliorations techniques
- `modele_document` : ajouter `categorie` + `champs` (JSON des variables) + `actif`.
- `GET /documents/modeles` (déjà existant) enrichi ; `POST/PUT/DELETE /documents/modeles`
  (réservé RH) sur le modèle de ce qui existe pour `/parcours/modeles`.
- E2 sélectionne le gabarit selon le type et fusionne les variables réelles.

---

## 4. Barre de recherche (recherche globale)

### Description
Recherche transverse permettant de retrouver rapidement le contenu de la plateforme
depuis un point unique, avec résultats **filtrés selon les droits** de l'utilisateur.

### Utilisateurs concernés
Tous, mais le **périmètre des résultats dépend du rôle** (RBAC).

### Champ de recherche (par catégorie)
- **Documents** (par nom, type, statut).
- **Conversations IA** (titre, contenu des messages de l'utilisateur).
- **Demandes RH** (absences/congés, statut).
- **Collaborateurs** (annuaire — visible RH/Manager/Direction).
- **Procédures internes / tâches de parcours** (onboarding/offboarding).
- **Réponses déjà fournies par l'IA** (FAQ implicite issue de `interaction_ia`).

### Cas d'usage principaux
- « Je cherche mon attestation de mars » → résultat dans Documents.
- « Retrouver la conversation sur le télétravail » → résultat dans Conversations.
- RH : « trouver le collaborateur Dupont » → fiche annuaire.

### Règles métier
- Résultats **cloisonnés** : un collaborateur ne trouve que ses documents/conversations
  et les ressources publiques ; RH/Manager voient plus selon leur périmètre.
- Regroupement des résultats **par catégorie**, triés par pertinence puis récence.
- Pas d'exposition de données sensibles non autorisées (réutilise le RBAC existant).

### Bénéfices attendus
Productivité, point d'entrée unique, réduction des clics, meilleure découvrabilité.

### Impacts UI
- Barre de recherche globale dans le header (raccourci clavier ⌘/Ctrl-K).
- Panneau de résultats groupés par catégorie avec navigation directe.

### Améliorations techniques
- Endpoint `GET /search?q=...&types=...` qui agrège plusieurs sources (documents,
  conversations, demandes, employés, parcours) en appliquant le RBAC par source.
- V1 : recherche SQL `ILIKE` par table. V2 (optionnel) : réutiliser l'index vectoriel
  ChromaDB déjà présent pour la recherche sémantique des réponses IA / procédures.

---

## 5. Langue de réponse de l'IA (multilingue)

### Description
L'assistant répond automatiquement **dans la langue du message** de l'utilisateur
(français, anglais, arabe…), sans réglage manuel.

### Utilisateurs concernés
Tous les utilisateurs de l'assistant.

### Cas d'usage principaux
- Prompt en français → réponse en français.
- Prompt en anglais → réponse en anglais.
- Prompt en arabe → réponse en arabe (support RTL à l'affichage).

### Règles métier
- La langue est **détectée à partir du dernier message** de l'utilisateur.
- En cas de doute (message très court / mélange), reprendre la langue de la conversation
  ou, à défaut, la langue de l'interface.
- La consigne de langue s'applique à **tous les modes** (rag, general, E1–E4) et au juge.
- La détection n'altère pas le classifieur de périmètre (sécurité inchangée).

### Bénéfices attendus
Accessibilité, inclusion (équipes multilingues), expérience naturelle.

### Impacts UI
- Aucune action utilisateur requise.
- Affichage **RTL** automatique pour les réponses en arabe.

### Améliorations techniques
- Détection de langue légère côté serveur (heuristique Unicode pour l'arabe + librairie
  type `langid`/`langdetect` pour latin), résultat injecté dans le system prompt :
  « Réponds dans la même langue que l'utilisateur ({lang}). »
- Retirer le « Réponds en français » figé des `SYSTEM_PROMPT_*` au profit de la consigne
  dynamique. Exposer `meta.lang` (interne, non bloquant).

---

## 6. Assistant IA dédié Managers & RH

### Description
Un assistant **à périmètre élargi** pour managers et RH, en complément de l'assistant
collaborateur. Il aide à analyser les demandes, suivre les équipes, générer des
documents, préparer des réponses, consulter les indicateurs et automatiser des tâches.

### Utilisateurs concernés
Manager, RH, Direction (selon RBAC). **Non accessible** aux collaborateurs.

### Cas d'usage principaux
- « Résume les demandes de congé en attente de mon équipe. »
- « Quels collaborateurs ont un onboarding en retard ? »
- « Prépare une réponse de refus motivée pour la demande #123. »
- « Donne-moi le turnover et les risques du trimestre. » (E4)
- « Génère les attestations pour les nouveaux arrivants. » (E2 en lot)

### Règles métier
- S'appuie sur les moteurs **E3** (parcours) et **E4** (prédictif) déjà restreints aux
  rôles élevés — **le RBAC reste la seule barrière d'accès** (inchangé).
- Accès aux données d'**équipe / département** selon le périmètre du manager (et non à
  toute l'organisation) — cf. amélioration « périmètre manager ».
- Les actions sensibles proposées (validations, envois) restent **confirmées
  explicitement** par l'humain (l'IA propose, l'utilisateur décide).
- Toute action déclenchée est tracée (`journal_audit`).

### Bénéfices attendus
Gain de temps RH/manager, décisions mieux informées, automatisation contrôlée,
homogénéité des réponses.

### Impacts UI
- Entrée de menu « Assistant RH » dans l'espace RH/Manager (distincte de l'assistant
  collaborateur), avec suggestions d'actions contextuelles (analyse, génération en lot,
  indicateurs).
- Réponses pouvant inclure des **actions cliquables** (ouvrir la demande, valider…).

### Améliorations techniques
- Réutiliser `pipeline.run_chat` avec un **profil assistant** (`audience = collaborateur |
  rh`) qui élargit les moteurs autorisés et ajoute un system prompt orienté pilotage.
- Nouveaux « skills » côté E-moteurs : synthèse de demandes (`demande`), suivi parcours
  d'équipe (`tache_parcours`), génération en lot (E2). RBAC appliqué en amont, comme
  aujourd'hui.

---

## 7. Menu contextuel

### Description
Menu d'actions rapides, **dépendant du contexte** (type d'élément + statut + rôle),
pour accéder directement aux opérations principales.

### Utilisateurs concernés
Tous, avec des actions filtrées par rôle et par statut de l'élément.

### Actions selon le contexte
- **Document** : Ouvrir · Modifier (si `draft`) · Soumettre (si `draft`) · Valider/Refuser
  (RH, si `pending`) · Télécharger (si `validated`) · Voir l'historique.
- **Conversation IA** : Reprendre · Renommer · Supprimer · Rechercher dedans.
- **Demande RH** : Ouvrir · Valider/Refuser (manager/RH) · Relancer · Voir l'historique.
- **Collaborateur** (RH) : Voir la fiche · Parcours · Documents · Lancer l'assistant sur ce profil.

### Règles métier
- Les actions affichées respectent **strictement le RBAC** et l'**état** de l'objet
  (ex. « Soumettre » uniquement sur un brouillon ; « Télécharger » uniquement si validé).
- Les actions destructives (supprimer) demandent **confirmation**.

### Bénéfices attendus
Rapidité, ergonomie, réduction de la navigation, cohérence des actions.

### Impacts UI
- Composant réutilisable `ContextMenu` (clic droit + bouton « ⋯ » sur les lignes/cartes).
- Centralisation de la logique « actions disponibles » selon (type, statut, rôle).

### Améliorations techniques
- Composant React générique piloté par une description déclarative des actions
  (`{label, icon, visibleIf(role, item), onClick}`).
- Pas de nouvel endpoint : réutilise les routes existantes (documents, demandes, parcours,
  conversations).

---

## Synthèse des impacts techniques

| Évolution | Données | API | Front |
|---|---|---|---|
| 1. Historique chats | table `conversation_ia` + FK sur `interaction_ia` | CRUD `/ai/conversations`, `conversation_id` dans `/ai/chat` | panneau Conversations |
| 2. Brouillon documents | champ `contenu` sur `document` | `POST/PATCH /documents` | éditeur + bouton Soumettre |
| 3. Types de documents | `modele_document` enrichi (catégorie, champs, actif) | CRUD `/documents/modeles` | sélecteur de type + gestion modèles |
| 4. Recherche globale | (lecture multi-tables) | `GET /search` (RBAC par source) | barre globale ⌘K |
| 5. Multilingue | — | détection langue → system prompt dynamique | RTL arabe |
| 6. Assistant RH/Manager | — | `audience` dans `run_chat` + skills E3/E4 | menu « Assistant RH » |
| 7. Menu contextuel | — | (réutilise l'existant) | composant `ContextMenu` |

## Priorisation suggérée (incrémentale, sans rupture)
1. **Multilingue (5)** et **Menu contextuel (7)** — rapides, fort impact UX, sans schéma BDD.
2. **Brouillon documents (2)** + **Types (3)** — cœur métier, réutilisent l'existant.
3. **Historique des chats (1)** — nécessite migration BDD légère.
4. **Assistant RH/Manager (6)** — s'appuie sur E3/E4 déjà en place.
5. **Recherche globale (4)** — transverse, à livrer après les sources de données ci-dessus.

> Contraintes transverses : conserver le RBAC comme **unique** barrière d'accès, tracer
> toute mutation dans `journal_audit`, ne jamais soumettre/valider sans action humaine
> explicite, et préserver les garde-fous IA existants (sécurité, PII, anti-invention).
