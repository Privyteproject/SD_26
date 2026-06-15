# 🧪 Guide de test — SD_26 / Synapse Digital

Ce guide couvre **4 types de tests**, à réaliser **dans cet ordre** :

1. ✅ **Tests fonctionnels** (à faire en premier) — vérifier que chaque fonctionnalité marche, par **scénarios**.
2. 🔬 **Tests unitaires** — tester chaque route de l'API isolément.
3. ⚡ **Tests de performance** — temps de réponse, charge, limite de débit.
4. 🔒 **Tests de sécurité** — droits d'accès, authentification, filtrage IA.

---

## ⚙️ Préparation (une seule fois)

1. Démarrer l'application :
   ```bash
   cd "c:\Users\Hp\Downloads\SD_26-develop (2)\SD_26-develop"
   docker compose up -d
   ```
2. `docker compose ps` → toutes les lignes en **`Up`**.
3. Ouvrir **http://localhost:5173** puis **`Ctrl + Shift + R`**.

### 👥 Comptes — mot de passe commun : `demo1234`

| Rôle | Email |
|---|---|
| 🟣 Admin | `yannick.keke@entreprise.com` |
| 🟢 RH | `karim.benali@entreprise.com` |
| 🔵 Manager | `sofia.alami@entreprise.com` |
| 🩺 Médecine | `nora.idrissi@entreprise.com` |
| ⚪ Collaborateur | `adam.roux@entreprise.com` |
| 🆕 Nouvel arrivant | `yasmine.haddad@entreprise.com` |
| 🚪 En départ | `sami.lahlou@entreprise.com` |

> 💡 **Changer de compte** = bouton **Déconnexion** (en haut), puis se reconnecter.

### 🧰 (Optionnel) Lire les appels réseau — DevTools
1. `F12` (ou clic droit → **Inspecter**).
2. Onglet **`Network`** (Réseau).
3. Clique un menu du site → des lignes apparaissent → clique la ligne `employees`.
4. Onglet **`Headers`** → tu dois voir `Authorization: Bearer ...` (le token passe).
5. Colonne **Status** : `200/201` = OK · `401` = non connecté · `403` = interdit · `404/500` = erreur.

---

# 1. ✅ TESTS FONCTIONNELS (à faire en premier)

Chaque test = un **scénario** : un objectif, **l'utilisateur à utiliser**, des étapes, un résultat attendu.

| Réf | Scénario | Se connecter en |
|---|---|---|
| SF-01 | Connexion et redirection selon le rôle | Admin / Collaborateur |
| SF-02 | Connexion refusée (mauvais identifiants) | — |
| SF-03 | Consulter l'annuaire des collaborateurs | RH |
| SF-04 | **Ajout d'un utilisateur** | Admin |
| SF-05 | Modification d'un utilisateur (rôle) | Admin |
| SF-06 | Suppression d'un utilisateur | Admin |
| SF-07 | Vérifier la synchro Keycloak | Admin |
| SF-08 | Créer une demande d'absence | Collaborateur |
| SF-09 | Valider une demande de congé | Manager |
| SF-10 | Refuser une demande | Manager |
| SF-11 | Demande avec dates invalides | Collaborateur |
| SF-12 | Tableau de bord RH (KPIs) | RH |
| SF-13 | Accueil personnel | Collaborateur |
| SF-14 | Initialiser un parcours d'onboarding | RH |
| SF-15 | Cocher une tâche d'onboarding | RH |
| SF-16 | Onboarding en lecture seule | Nouvel arrivant |
| SF-17 | Suivi d'offboarding | RH |
| SF-18 | Poser une question à l'assistant IA | Collaborateur |
| SF-19 | Superviser les échanges IA | Admin |
| SF-20 | Générer un document | Collaborateur |
| SF-21 | Télécharger un document | Collaborateur |

---

### SF-01 — Connexion et redirection selon le rôle
- **Objectif :** se connecter et arriver sur le bon espace.
- **Utilisateur :** Admin (`yannick.keke@entreprise.com`)
- **Étapes :**
  1. Ouvrir http://localhost:5173
  2. Saisir l'email + `demo1234` → **Se connecter**
- **Résultat attendu :** redirection vers l'espace **admin**, sans erreur.
- **Variante :** refaire avec Collaborateur (`adam.roux`) → arrive sur l'**Accueil** personnel.

### SF-02 — Connexion refusée (mauvais identifiants)
- **Objectif :** vérifier le message d'erreur.
- **Utilisateur :** aucun (page de connexion)
- **Étapes :** saisir un email connu + un **mauvais** mot de passe → Se connecter.
- **Résultat attendu :** message rouge « E-mail ou mot de passe incorrect », **pas** de connexion.

### SF-03 — Consulter l'annuaire des collaborateurs
- **Objectif :** afficher la liste réelle des employés.
- **Utilisateur :** RH (`karim.benali@entreprise.com`)
- **Étapes :** menu **Collaborateurs**.
- **Résultat attendu :** liste de **9 employés réels** (nom, poste, département, statut).

### SF-04 — Ajout d'un utilisateur
- **Objectif :** créer un nouveau compte.
- **Utilisateur :** Admin (`yannick.keke@entreprise.com`)
- **Étapes :**
  1. Menu **Utilisateurs & rôles**
  2. Bouton **Nouvel utilisateur**
  3. Remplir : Nom complet, Email, Rôle, Département
  4. Cliquer **Créer le compte**
- **Résultat attendu :** la nouvelle personne **apparaît dans la liste** immédiatement.

### SF-05 — Modification d'un utilisateur (rôle)
- **Objectif :** changer le rôle d'un employé.
- **Utilisateur :** Admin
- **Étapes :**
  1. Menu **Utilisateurs & rôles**
  2. Bouton **✏️ (crayon)** sur une ligne
  3. Changer le **Rôle** → **Enregistrer**
- **Résultat attendu :** le badge de rôle de la personne **change** dans la liste.

### SF-06 — Suppression d'un utilisateur
- **Objectif :** supprimer un compte.
- **Utilisateur :** Admin
- **Étapes :**
  1. Bouton **🗑️ (corbeille)** sur la personne créée en SF-04
  2. Confirmer la pop-up
- **Résultat attendu :** la ligne **disparaît**, sans erreur.
- **Remarque :** la corbeille de **ton propre** compte est désactivée (protection).

### SF-07 — Vérifier la synchro Keycloak
- **Objectif :** confirmer que créer/supprimer dans l'appli agit dans Keycloak.
- **Utilisateur :** Admin (appli) + console Keycloak
- **Étapes :**
  1. Ouvrir http://localhost:8080 → se connecter `admin` / `admin`
  2. En haut à gauche, choisir le realm **`ydays`**
  3. Menu **Users** → chercher l'email créé en SF-04
- **Résultat attendu :** l'utilisateur créé **est présent** (onglet *Role mapping* = le rôle choisi) ; après SF-06, il **n'y est plus**.

### SF-08 — Créer une demande d'absence
- **Objectif :** soumettre un congé.
- **Utilisateur :** Collaborateur (`adam.roux@entreprise.com`)
- **Étapes :**
  1. Menu **Mes demandes**
  2. Bouton **Nouvelle demande**
  3. Choisir un **Type** (Congé payé…), une **date de début**, une **date de fin**, un motif
  4. Cliquer **Soumettre la demande**
- **Résultat attendu :** une nouvelle ligne en statut **« En validation »**.

### SF-09 — Valider une demande de congé
- **Objectif :** approuver une demande.
- **Utilisateur :** Manager (`sofia.alami@entreprise.com`)
- **Étapes :**
  1. Menu **Demandes**
  2. Repérer la demande d'Adam (créée en SF-08)
  3. Cliquer **Approuver (✓)**
- **Résultat attendu :** statut → **Validé**. (Vérif : se reconnecter en Collaborateur → la demande est « Validé ».)

### SF-10 — Refuser une demande
- **Objectif :** rejeter une demande.
- **Utilisateur :** Manager
- **Étapes :** menu **Demandes** → **Refuser (✗)** sur une demande.
- **Résultat attendu :** statut → **Refusée**.

### SF-11 — Demande avec dates invalides (cas d'erreur)
- **Objectif :** vérifier le contrôle de saisie.
- **Utilisateur :** Collaborateur
- **Étapes :** Nouvelle demande avec **date de fin AVANT date de début** → Soumettre.
- **Résultat attendu :** message d'erreur, la demande **n'est pas créée**.

### SF-12 — Tableau de bord RH (KPIs)
- **Objectif :** afficher les indicateurs réels.
- **Utilisateur :** RH (`karim.benali@entreprise.com`)
- **Étapes :** menu **Tableau de bord**.
- **Résultat attendu :** KPIs réels (**Effectif 9, Turnover 8,2 %, Absentéisme 2,7 %, Engagement 84 %**), graphique des indicateurs par période, effectifs par département, et liste des **collaborateurs à risque**.

### SF-13 — Accueil personnel
- **Objectif :** voir ses infos perso.
- **Utilisateur :** Collaborateur (`adam.roux`)
- **Étapes :** menu **Accueil**.
- **Résultat attendu :** carte **« Demandes en cours »** = tes vraies absences, et **ton prénom** dans le titre.

### SF-14 — Initialiser un parcours d'onboarding
- **Objectif :** créer les tâches d'un nouvel arrivant.
- **Utilisateur :** RH (`karim.benali`)
- **Étapes :**
  1. Menu **Suivi des intégrations**
  2. Sélectionner **Yasmine Haddad**
  3. Si aucune tâche → bouton **Initialiser le parcours** → cliquer
- **Résultat attendu :** des tâches d'onboarding apparaissent.
- **⚠️ Remarque :** le bouton **« Initialiser »** n'apparaît **que si le parcours est vide**. Si Yasmine a **déjà** des tâches (parce qu'elles ont été créées auparavant), c'est **normal** : tu vois directement ses tâches → passe alors au **SF-15**. Pour re-tester l'initialisation sur quelqu'un de vierge, crée un nouvel employé avec le statut **« Nouvel arrivant »** (via Admin → Utilisateurs) et sélectionne-le.

### SF-15 — Cocher une tâche d'onboarding
- **Objectif :** mettre à jour l'avancement (et vérifier la persistance).
- **Utilisateur :** RH
- **Étapes :**
  1. Toujours sur Yasmine, **cocher** une tâche
  2. Appuyer sur **F5** (recharger la page)
- **Résultat attendu :** la barre de progression monte, et après F5 la tâche **reste cochée**.

### SF-16 — Onboarding en lecture seule
- **Objectif :** un collaborateur voit mais ne modifie pas.
- **Utilisateur :** Nouvel arrivant (`yasmine.haddad@entreprise.com`)
- **Étapes :** menu **Onboarding**.
- **Résultat attendu :** ses tâches + progression, mention **« lecture seule »**, cases **non modifiables**.

### SF-15b — Ajouter une tâche personnalisée (et la supprimer)
- **Objectif :** créer une tâche sur mesure pour un employé (au-delà des tâches par défaut).
- **Utilisateur :** RH (`karim.benali`)
- **Étapes :**
  1. Menu **Suivi des intégrations** → sélectionner un employé
  2. En bas de ses tâches, champ **« Nom de la tâche »** → saisir (ex. « Visite médicale d'entrée ») → bouton **Ajouter**
  3. La tâche apparaît dans sa liste → on peut la **cocher** ou la **supprimer (🗑️)**
- **Résultat attendu :** la tâche personnalisée est ajoutée à **ce seul** employé (elle n'apparaît pas chez les autres).

### SF-15c — Gérer les modèles de tâches par défaut
- **Objectif :** créer/modifier/supprimer les tâches appliquées automatiquement aux nouveaux parcours.
- **Utilisateur :** RH (`karim.benali`)
- **Étapes :**
  1. Menu **Suivi des intégrations** → bloc **« Modèles de tâches par défaut »** (en bas de page)
  2. **Ajouter** : saisir un libellé (+ délai en jours optionnel) → **Ajouter**
  3. **Modifier** (✏️) un modèle → nouveau libellé ; **Supprimer** (🗑️) un modèle
- **Résultat attendu :** le modèle ajouté sera proposé aux **prochaines initialisations** de parcours. La suppression d'un modèle **déjà utilisé** est refusée (message d'avertissement).

### SF-17 — Suivi d'offboarding
- **Objectif :** gérer un départ.
- **Utilisateur :** RH
- **Étapes :** menu **Offboarding** → sélectionner **Sami Lahlou** → initialiser si besoin → cocher « Restituer le matériel ».
- **Résultat attendu :** progression mise à jour et conservée.

### SF-18 — Poser une question à l'assistant IA
- **Objectif :** obtenir une réponse RH.
- **Utilisateur :** Collaborateur (`adam.roux`)
- **Étapes :** menu **Assistant IA** → écrire *« Quelle est la politique de télétravail ? »* → Entrée.
- **Résultat attendu :** réponse + badges (**périmètre RH**, modèle, juge, sources).

### SF-19 — Superviser les échanges IA
- **Objectif :** consulter les journaux IA.
- **Utilisateur :** Admin (`yannick.keke`)
- **Étapes :** menu **Supervision IA**.
- **Résultat attendu :** compteurs (Échanges, Tokens, Sensibles) + tableau des **vrais échanges** (dont la question de SF-18).

### SF-20 — Générer un document
- **Objectif :** créer une attestation.
- **Utilisateur :** Collaborateur (`adam.roux`)
- **Étapes :** menu **Documents** → choisir **Attestation de travail** → **Soumettre pour validation**.
- **Résultat attendu :** un document apparaît dans l'historique (statut *pending*). Générer 2× → les 2 apparaissent (pas d'erreur).

### SF-21 — Télécharger un document
- **Objectif :** récupérer le fichier.
- **Utilisateur :** Collaborateur
- **Étapes :** menu **Documents** → bouton **⬇️ (Télécharger)** sur une ligne.
- **Résultat attendu :** un fichier se télécharge, contenant une attestation **à ton nom**.

---

# 2. 🔬 TESTS UNITAIRES (par route d'API, via Swagger)

> À faire **après** les tests fonctionnels. On teste chaque route **isolément** dans l'interface **Swagger** (la doc interactive de l'API). On ne passe plus par les écrans, on appelle directement le serveur.

## 🔑 Étape préalable obligatoire — s'authentifier dans Swagger

Avant tout test, il faut donner ton « badge » (token) à Swagger :

1. Connecte-toi à l'appli **http://localhost:5173** avec le rôle voulu (ex. **RH**).
2. Appuie sur **`F12`** → onglet **Application** (ou *Storage*) → **Local Storage** → **http://localhost:5173**.
3. Repère la clé **`sd-access-token`** → **double-clic sur sa valeur → copie-la** (très longue chaîne `eyJ...`).
4. Ouvre **http://localhost:8000/docs** (c'est Swagger).
5. Clique le bouton **Authorize** 🔒 (en haut à droite).
6. Dans le champ, **colle juste le token** (sans écrire « Bearer ») → **Authorize** → **Close**.

> 🔁 **Changer de rôle** = se reconnecter à l'appli avec un autre compte, recopier le nouveau `sd-access-token`, et refaire l'étape Authorize. (TU-16 demande un token **Admin**.)

**Comment lancer un test dans Swagger :** déplier la route → bouton **Try it out** → remplir les champs / le corps JSON → **Execute** → lire le **Code** (Server response) et le corps renvoyé.

---

### TU-01 — `GET /health`
- **Token :** non requis
- **Étapes :** déplier `GET /health` → Try it out → Execute.
- **Attendu :** **200**, corps `{"status":"ok","version":"1.0.0"}`.

### TU-02 — `GET /api/v1/employees/me`
- **Token :** RH
- **Étapes :** déplier → Try it out → Execute.
- **Attendu :** **200**, `data.role = "RH"`, `data.email = karim.benali@entreprise.com`.

### TU-03 — `GET /api/v1/employees`
- **Token :** RH (ou Admin)
- **Étapes :** Try it out → Execute (laisser les filtres vides).
- **Attendu :** **200**, `data` contient ~9 employés. 👉 **Note un `id` (ex. `EMP008`)** pour TU-05/TU-06.

### TU-04 — `POST /api/v1/employees` (création)
- **Token :** Admin
- **Corps JSON :**
  ```json
  {
    "prenom": "Test",
    "nom": "Unitaire",
    "email": "test.unitaire@entreprise.com",
    "password": "demo1234",
    "role": "COLLABORATEUR",
    "status": "ACTIVE"
  }
  ```
- **Attendu :** **201**, la réponse renvoie un `data.id` (ex. `EMP0xx`). 👉 **Note cet id** pour TU-05 et TU-06.

### TU-05 — `PUT /api/v1/employees/{employee_id}` (modification)
- **Token :** Admin
- **Paramètre :** `employee_id` = l'id créé en TU-04
- **Corps JSON :**
  ```json
  { "role": "MANAGER", "poste": "Chef de projet" }
  ```
- **Attendu :** **200**, `data.role = "MANAGER"`.

### TU-06 — `DELETE /api/v1/employees/{employee_id}` (suppression)
- **Token :** Admin
- **Paramètre :** `employee_id` = l'id créé en TU-04
- **Attendu :** **200**. Refaire un `GET /employees/{id}` sur le même id → **404** (bien supprimé).

### TU-07 — `POST /api/v1/absences` (dates valides)
- **Token :** Collaborateur
- **Corps JSON :**
  ```json
  {
    "type": "CONGE",
    "start_date": "2026-10-01",
    "end_date": "2026-10-05",
    "reason": "Test unitaire"
  }
  ```
- **Attendu :** **201**, `data.status = "pending"`. 👉 **Note `data.id`** pour TU-09.

### TU-08 — `POST /api/v1/absences` (dates inversées — cas d'erreur)
- **Token :** Collaborateur
- **Corps JSON :**
  ```json
  { "type": "CONGE", "start_date": "2026-10-10", "end_date": "2026-10-01" }
  ```
- **Attendu :** **422** (date de fin avant le début rejetée).

### TU-09 — `PATCH /api/v1/absences/{absence_id}/status`
- **Token :** Manager
- **Paramètre :** `absence_id` = l'id de TU-07
- **Corps JSON :**
  ```json
  { "status": "validated" }
  ```
- **Attendu :** **200**, `data.status = "validated"` et `data.date_decision` rempli.
- **Bonus sécurité :** refaire ce même appel avec un token **Collaborateur** → **403**.

### TU-10 — `GET /api/v1/dashboard/rh`
- **Token :** RH
- **Attendu :** **200**, le `data` contient `headcount`, `risques`, `indicateurs`.
- **Bonus :** avec un token **Collaborateur** → **403**.

### TU-11 — `POST /api/v1/parcours/{matricule}/init`
- **Token :** RH
- **Paramètre :** `matricule` = `EMP008` (Yasmine, nouvelle arrivante)
- **Corps JSON :**
  ```json
  { "type_parcours": "ONBOARDING" }
  ```
- **Attendu :** **201**, une liste de tâches. 👉 **Note l'`id` d'une tâche** pour TU-12.

### TU-12 — `PATCH /api/v1/parcours/taches/{id_tache}`
- **Token :** RH
- **Paramètre :** `id_tache` = un id de tâche de TU-11
- **Corps JSON :**
  ```json
  { "status": "done", "date_realisation": "2026-06-13" }
  ```
- **Attendu :** **200**, `data.status = "done"`.
- **Bonus sécurité :** même appel avec token **Collaborateur** → **403**.

### TU-13 — `POST /api/v1/documents` (génération)
- **Token :** Collaborateur
- **Corps JSON :**
  ```json
  { "code_modele": "ATTEST_TRAVAIL" }
  ```
- **Attendu :** **201**, `data.statut = "pending"`. 👉 **Note `data.id`** pour TU-14.
- **Cas d'erreur :** envoyer `{ "code_modele": "NEXISTEPAS" }` → **422**.

### TU-14 — `GET /api/v1/documents/{document_id}/download`
- **Token :** Collaborateur (le propriétaire du document de TU-13)
- **Paramètre :** `document_id` = l'id de TU-13
- **Attendu :** **200**, un contenu de fichier texte est renvoyé.
- **Bonus sécurité :** essayer un `document_id` appartenant à un **autre** employé → **403**.

### TU-15 — `POST /api/v1/ai/chat`
- **Token :** Collaborateur
- **Corps JSON :**
  ```json
  { "message": "Quelle est la politique de télétravail ?", "history": [], "judge": false }
  ```
- **Attendu :** **200**, `data.reply` non vide + `data.meta` (périmètre, etc.).

### TU-16 — `GET /api/v1/ai/logs` (réservé Admin)
- **Token :** **Admin** (⚠️ recopier le token d'un compte admin)
- **Attendu :** **200**, `data` = liste des échanges, `meta` = `{count, total_tokens, sensibles}`.
- **Bonus sécurité :** avec un token **Collaborateur** → **403**.

---

# 3. ⚡ TESTS DE PERFORMANCE

> Objectif : vérifier que les pages/API répondent vite et tiennent la charge.

### TP-01 — Temps de réponse (simple, via DevTools)
- `F12` → **Network** → ouvrir une page (ex. Tableau de bord).
- Regarder la colonne **Time** des appels `/api/v1/...`.
- **Attendu :** chaque appel < ~500 ms en local.

### TP-02 — Charge sur un endpoint (outil en ligne de commande)
- Avec un token valide, lancer (exemple) :
  ```bash
  # 200 requêtes, 10 en parallèle
  ab -n 200 -c 10 -H "Authorization: Bearer <TOKEN>" http://localhost:8000/api/v1/employees
  ```
  *(`ab` = Apache Bench ; alternative moderne recommandée : **k6** ou **hey**.)*
- **Attendu :** aucune erreur, temps moyen stable.

### TP-03 — Limite de débit de l'assistant (rate-limit)
- **Utilisateur :** Collaborateur, page **Assistant IA**.
- Le seuil est de **20 requêtes par minute et par utilisateur**. Envoyer **plus de 20 messages** rapidement (ou tester via l'API).
- **Attendu :** à partir du **21ᵉ**, message **« Trop de requêtes — patientez une minute »** (HTTP **429**). C'est le comportement voulu. ✅ *(vérifié : 20× 200 puis 429.)*

---

# 4. 🔒 TESTS DE SÉCURITÉ

> Objectif : vérifier les droits d'accès et les protections.

### TS-01 — Accès sans authentification
- **Étapes :** se déconnecter, aller sur `http://localhost:5173/admin`.
- **Attendu :** redirection vers **/login**. (Côté API : `GET /api/v1/employees` sans token → **401**.)

### TS-02 — Cloisonnement par rôle (RBAC)
- **Utilisateur :** Collaborateur (`adam.roux`)
- **Étapes :** vérifier que les menus **Utilisateurs & rôles**, **Supervision IA**, **Tableau de bord RH** ne sont **pas** accessibles.
- **Attendu :** pas d'accès ; via API, ces routes renvoient **403**.

### TS-03 — Un collaborateur ne voit que ses données
- **Utilisateur :** Collaborateur
- **Étapes :** menu **Mes demandes** / **Documents**.
- **Attendu :** uniquement **ses** absences et **ses** documents (pas ceux des autres).

### TS-04 — Téléchargement non autorisé
- **Utilisateur :** Collaborateur
- **Étapes (via Swagger ou URL)** : tenter `GET /documents/{id}/download` avec l'`id` d'un document **d'un autre employé**.
- **Attendu :** **403**.

### TS-05 — Filtrage de l'assistant IA
- **Utilisateur :** Collaborateur, page **Assistant IA**
- **Étapes :** poser une question **dangereuse** ou **hors-sujet**, puis demander des **données d'un autre service** (ex. salaire d'un collègue).
- **Attendu :** réponse de **refus** / hors-périmètre, badge « Bloqué » ou « accès refusé ».

### TS-06 — Jeton invalide
- **Étapes (Swagger)** : mettre un token bidon (`Bearer abc`) et appeler `GET /employees/me`.
- **Attendu :** **401** (jeton invalide).

---

## 📌 Récapitulatif « qui se connecte pour quoi » (fonctionnel)

| Connecte-toi en… | Scénarios |
|---|---|
| 🟣 **Admin** (`yannick.keke`) | SF-01, SF-04, SF-05, SF-06, SF-07, SF-19 |
| 🟢 **RH** (`karim.benali`) | SF-03, SF-12, SF-14, SF-15, SF-17 |
| 🔵 **Manager** (`sofia.alami`) | SF-09, SF-10 |
| ⚪ **Collaborateur** (`adam.roux`) | SF-08, SF-11, SF-13, SF-18, SF-20, SF-21 |
| 🆕 **Nouvel arrivant** (`yasmine.haddad`) | SF-16 |

---

## 🐞 En cas de souci
```bash
docker compose logs backend --tail 50      # erreurs serveur / Keycloak
docker compose logs frontend --tail 30     # erreurs d'affichage
```
Note le **numéro du scénario** (ex. SF-09) + le message d'erreur pour faciliter la correction.
