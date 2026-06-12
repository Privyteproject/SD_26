# Synapse Digital — Frontend fonctionnel (sans backend)

Application front **opérationnelle** : authentification réelle (locale), sessions
persistées, accès filtrés par rôle, gestion de comptes par l'admin. **Sans base de
données ni IA** pour l'instant — tout est stocké dans le navigateur (localStorage).

## Lancer
```bash
npm install
npm run dev
```
Ouvrir http://localhost:5173

## Connexion
Aucune inscription : les comptes sont créés par l'administrateur. Comptes de
démonstration (bouton « Comptes de démonstration » sur l'écran de connexion) —
**mot de passe commun : `demo1234`**

| Rôle | E-mail | Statut |
|------|--------|--------|
| Administrateur | admin@synapse.io | — |
| Ressources Humaines | rh@synapse.io | — |
| Manager | manager@synapse.io | — |
| Direction | direction@synapse.io | — |
| Médecine du travail | medecine@synapse.io | — |
| Collaborateur (nouvel arrivant) | yannick@synapse.io | onboarding visible |
| Collaborateur (actif) | lina@synapse.io | — |
| Collaborateur (en départ) | sami@synapse.io | offboarding visible |

## Ce qui fonctionne réellement
- **Connexion** par e-mail + mot de passe (vérification locale, message d'erreur).
- **Session persistée** : un rafraîchissement (F5) ne déconnecte plus.
- **Rôles appliqués** : l'espace, la navigation et les accès dépendent du compte connecté.
- **Admin = gestion des comptes** : créer / supprimer des utilisateurs (rôle + statut).
  L'admin **n'a pas accès aux données RH** (page retirée de son espace).
- **Gestion de compte complète (admin)** : créer, **modifier** et supprimer des comptes (rôle, statut, mot de passe).
- **Mes demandes** : le collaborateur soumet une demande (congé, attestation…) — réellement enregistrée.
- **Validation des demandes (RH / Manager / Direction)** : page « Demandes » pour **approuver / refuser** ; le statut se met à jour côté collaborateur.
- **Génération de documents** : le document soumis s'ajoute à l'historique avec son statut.
- **Profil** : affiche le compte connecté et permet de **changer son mot de passe**.
- **Déconnexion** depuis le menu profil (en haut à droite).
- Thème clair/sombre et bilingue FR/EN, persistés.

## Volontairement hors périmètre (pour l'instant)
- **IA** : l'assistant reste une interface vide (pas d'intégration).
- **Base de données / backend** : remplacés par du stockage navigateur.
- Le SSO **Keycloak** est affiché mais désactivé (à brancher plus tard ; il remplacera
  alors l'authentification locale).

## Note de sécurité
L'authentification locale (mots de passe en clair dans le navigateur) sert uniquement
à la maquette fonctionnelle. En production, l'authentification passera par Keycloak et
les données par le backend.
