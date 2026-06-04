# Synapse Digital — Frontend (application complète)

Maquette front de la plateforme RH augmentée par l'IA. **Front uniquement** :
navigation, thème, langue, graphiques et logique conditionnelle/RBAC fonctionnent ;
aucune authentification, base de données ou IA réelle (données 100% fictives).

## Lancer
```bash
npm install
npm run dev
```
Ouvrir l'adresse affichée (http://localhost:5173).

## Mode démo (header)
Le sélecteur "Mode démo" pilote toute l'adaptation de l'interface :
- **Rôle** : Collaborateur / Manager / RH / Direction / Admin / Médecine du travail
  → l'espace, la sidebar, les données et les accès changent.
- **Statut** : Nouvel arrivant / Actif / En départ
  → fait apparaître/disparaître les sections Onboarding / Offboarding.

## Contenu (4 lots)
- **Collaborateur** : tableau de bord (cartes onboarding/offboarding conditionnelles),
  assistant IA (UI vide), documents (génération + historique), onboarding 30 jours,
  mes demandes, profil.
- **RH / Manager / Direction** : tableau de bord adaptatif (Manager vs DRH),
  analytique (turnover, masse salariale [restreinte], absentéisme), désengagement
  (anonymisé pour la médecine du travail), offboarding agentique, collaborateurs,
  équipe, rapports, suivi des intégrations.
- **Admin / Supervision** : supervision sécurité, supervision IA (logs en
  métadonnées), alertes par gravité, utilisateurs & matrice rôles × permissions,
  journal d'audit, données RH, configuration (sources + garde-fous).

## Stack
React + Vite + Tailwind v4 + React Router + Recharts + lucide-react.
Organisation par feature dans `src/features/*` ; couches transverses dans
`src/app`, `src/components`, `src/hooks`, `src/services`, `src/lib`.

## Important
Maquette : si vous rechargez la page (F5), la session simulée se réinitialise et
renvoie au login (pas de token persistant). En usage normal (navigation par les
liens), tout reste fluide. Le câblage réel (Keycloak, API FastAPI, RAG) reste à faire.
