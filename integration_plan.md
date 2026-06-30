# Plan d'Intégration - Équipe Synapse Digital

Ce plan détaille la mise en production et l'intégration des fonctionnalités complétées (Checklists de parcours par acteur, Upload de gabarits de documents et Correction des comptes démo).

---

## 1. Description des Fonctionnalités Livrées

### A. Tâches de Parcours par Acteur (Onboarding/Offboarding)
* **Distinction des rôles** : Les tâches ont désormais un attribut `acteur` (valeurs : `RH` ou `EMPLOYE`).
* **Restriction de validation** : Les collaborateurs ne peuvent cocher que les tâches qui leur sont attribuées (`acteur = 'EMPLOYE'`). S'ils tentent de cocher une tâche RH, l'API renvoie un statut `403 Forbidden`.
* **Interface Collaborateur** : La checklist est scindée en deux sections distinctes :
  1. *Mes tâches (À faire par vous)* : Liste interactive et validable par l'employé.
  2. *Tâches RH / Manager* : Liste informative en lecture seule (visuelle uniquement).
* **Interface RH / Modèles** :
  * Un sélecteur d'acteur (`RH / Manager` vs `Collaborateur`) a été ajouté lors de la création de modèles par défaut ou de tâches personnalisées.
  * Des badges colorés identifient clairement le responsable de chaque tâche.

### B. Upload de Gabarits de Documents
* Un bouton d'upload a été intégré directement dans la table des modèles de documents RH (à côté du bouton supprimer) pour modifier et écraser à chaud les fichiers de modèles `.docx` ou `.pdf`.

### C. Comptes Démo
* Le mot de passe par défaut des comptes démo Keycloak (`EMP001` à `EMP008`) a été harmonisé à `demo1234` pour correspondre à la configuration d'authentification de l'application et garantir la connexion.

---

## 2. Modifications de la Base de Données

Une migration idempotente légère est exécutée automatiquement au démarrage du backend :
* **Table** : `modele_tache`
* **Colonne** : `acteur` (`VARCHAR(20)`, valeur par défaut `'RH'`, non nulle).

Le script d'initialisation en base `backend/app/db/base.py` se charge d'ajouter cette colonne si elle n'est pas présente.

---

## 3. Schéma de Validation des API

### Schémas Pydantic (`backend/app/schemas/hr.py`)
* `ModeleTacheCreate` : Ajout de `acteur: Optional[str] = "RH"`.
* `ModeleTacheUpdate` : Ajout de `acteur: Optional[str] = None`.
* `TacheCreate` : Ajout de `acteur: Optional[str] = "RH"`.

---

## 4. Plan de Vérification & Tests

Pour s'assurer que l'intégration ne produit pas de régression, la suite de tests de fumée (`smoke_test.py`) a été enrichie. Elle teste automatiquement :
1. La création de tâches modèles et personnalisées avec différents acteurs.
2. La validation réussie par le collaborateur de ses propres tâches.
3. Le blocage (`403 Forbidden`) d'un collaborateur qui tente de valider une tâche RH.
4. Le workflow de soumission de document avant validation (qui corrigeait un échec de test).

### Commande de test à exécuter :
```bash
# Copier le script de test mis à jour dans le conteneur backend
docker cp backend/smoke_test.py ydays_backend:/app/smoke_test.py

# Exécuter les tests dans le conteneur
docker compose exec backend python /app/smoke_test.py
```
*Le résultat attendu en fin d'exécution est `RESULTAT: TOUT OK` et `EXTRA: OK`.*
