# Document de Livraison Frontend
## Synapse Digital — Plateforme IA RH
## YDAYS 2026 · Arush Ramisami

---

# PARTIE 1 — CE QUI A ÉTÉ FAIT CÔTÉ FRONTEND

## S1 — Structure & Tokens

### Architecture
| Fichier | Rôle |
|---------|------|
| `src/theme.js` | Design tokens centralisés (palette dorée/sombre, dark mode) |
| `src/components/Mark.jsx` | Logo SVG Synapse partagé entre toutes les pages |
| `src/components/Sidebar.jsx` | Navigation latérale avec rôle dynamique depuis JWT |
| `src/components/Layout.jsx` | Wrapper partagé sidebar + topbar |
| `src/components/Skeleton.jsx` | Loaders skeleton pour tous les fetch API |
| `src/components/RoleGuard.jsx` | Affichage conditionnel de blocs JSX selon le rôle |
| `src/components/GlobalLoader.jsx` | Barre de progression navigation + bandeau hors ligne + indicateur mode démo |

### Gestion des tokens JWT
- Tokens stockés **uniquement en mémoire** (variable module JS) — jamais dans `localStorage` ni `sessionStorage` → protection XSS
- Refresh automatique planifié à **80% de la durée de vie** du token
- Axios intercepteur injecte `Authorization: Bearer <token>` sur **toutes les requêtes**
- Retry automatique en cas de 401 : tente un refresh puis redirige vers `/login` si échec
- `TokenStore.decodePayload()` décode le payload JWT sans librairie tierce

---

## S2 — Authentification côté front

### Pages
| Page | Route | Description |
|------|-------|-------------|
| `Authentification.jsx` | `/login` | Login email/mot de passe + SSO Keycloak — inscription supprimée (app interne) |
| `ForgotPassword.jsx` | `/forgot-password` | Demande de réinitialisation par email |
| `ResetPassword.jsx` | `/reset-password?token=xxx` | Formulaire nouveau mot de passe avec vérification token |

### Fonctionnalités auth
- `login(email, password)` → `POST /api/auth/login` → stocke les tokens en mémoire
- `loginSSO()` → **Keycloak-js** (lazy-loaded, ne charge que si besoin) → lit `realm_access.roles` dans le JWT
- `loginDemo(role)` → mode démo sans backend (DEV uniquement, masqué en production)
- `logout()` → vide la mémoire tokens + redirige `/login`
- Indicateur force mot de passe en temps réel (Faible / Moyen / Fort / Très fort)
- `public/keycloak.json` prêt pour configuration Keycloak

---

## S3 — Affichage conditionnel par rôle + Chat

### RBAC
- `ProtectedRoute` sur **chaque route** → vérifie token non expiré + rôle suffisant
- Redirect automatique `/403` si rôle insuffisant, `/login` si non connecté
- `RoleGuard` dans les pages pour masquer/afficher boutons selon le rôle (ex : bouton "Agir" visible seulement pour RH+)
- Hiérarchie des rôles : `admin > direction > rh > manager > collaborateur`

### Pages avec données dynamiques
| Page | Route | Données |
|------|-------|---------|
| `DashboardCollaborateur.jsx` | `/dashboard` | KPIs, onboarding, alertes depuis `GET /api/kpi/collaborateur` |
| `DashboardRH.jsx` | `/rh/dashboard` | Effectifs, engagement, alertes désengagement depuis `GET /api/kpi/rh` |
| `DashboardAdmin.jsx` | `/admin` | Logs, alertes sécurité, rôles depuis `GET /api/admin/*` |
| `AssistantIA.jsx` | `/assistant` | Chat branché `POST /api/ia/chat` + fallback démo |
| `GenerationDocuments.jsx` | `/documents` | Historique `GET /api/documents` + génération `POST /api/documents/generate` |
| `Onboarding.jsx` | `/onboarding` | Parcours `GET /api/onboarding/me` + toggle étapes `PATCH /api/onboarding/steps/:id` |
| `Offboarding.jsx` | `/offboarding/:id` | Checklist `GET /api/offboarding/:id` + synthèse IA `POST /api/ia/synthese` |
| `ProfilUtilisateur.jsx` | `/profil` | Profil `GET/PUT /api/profil/me` + sessions + notifications |

### Skeleton loaders
- Toutes les pages affichent des skeletons animés pendant le chargement API
- Fallback démo silencieux si le backend est indisponible
- Bandeau "Mode démo actif" affiché en bas à droite si les données viennent du fallback

### Chat IA
- Détection **prompt injection** côté client (17 patterns FR + EN) avant envoi à l'API
- Messages bloqués journalisés visuellement + toast d'alerte
- Sanitisation DOMPurify sur toutes les réponses affichées
- Historique des conversations affiché dans la sidebar

---

## S4 — Sécurité XSS + Polish

### Sécurité
| Mesure | Détail |
|--------|--------|
| DOMPurify | Tous les contenus API/utilisateur sont sanitisés avant affichage |
| Détection prompt injection | 17 patterns (FR + EN) : ignore instructions, tu es maintenant, script tags, javascript:, etc. |
| Validation formulaires | email, password (force + règles), nom (anti-HTML), texte libre (anti-< >) |
| CSP nginx | `script-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'` |
| Headers sécurité | X-Frame-Options DENY, X-Content-Type-Options nosniff, X-XSS-Protection |
| Tokens en mémoire | Jamais localStorage — résistant aux attaques XSS |
| ProtectedRoute | Vérifie expiration JWT + rôle avant tout rendu |

### Tests
- **42 tests Vitest** couvrant : sanitize XSS (10 cas), prompt injection (12 cas), validators (12 cas), TokenStore JWT (3 cas)
- Commande : `npm run test`

### Déploiement
| Fichier | Rôle |
|---------|------|
| `Dockerfile` | Build multi-stage Node 20 + Nginx Alpine |
| `nginx.conf` | Proxy backend, SPA fallback, CSP, cache statiques, health check |
| `docker-compose.yml` | Stack complète frontend + backend + Keycloak + PostgreSQL |
| `.env.example` | Variables d'environnement documentées |

### Qualité code
- **0 erreur ESLint** (0 erreur, warnings uniquement sur deps hooks)
- Build Vite production propre
- Responsive mobile/desktop sur toutes les pages

---

# PARTIE 2 — CE QUI RESTE À FAIRE CÔTÉ BACKEND

## Priorité CRITIQUE — Bloque le login

### 1. Keycloak
```
À configurer dans Keycloak Admin :

Realm : synapse

Client : synapse-frontend
  - Client type        : OpenID Connect
  - Valid redirect URIs: http://localhost:5173/*, https://[votre-domaine]/*
  - Web origins        : http://localhost:5173, https://[votre-domaine]
  - Standard flow      : ON
  - Direct access      : OFF

Rôles realm (noms exacts) :
  - collaborateur
  - manager
  - rh
  - direction
  - admin
```

### 2. Endpoint Login
```
POST /api/auth/login
Body  : { "email": "...", "password": "..." }
Retour: { "accessToken": "JWT...", "refreshToken": "JWT..." }
```

Le JWT doit contenir :
```json
{
  "sub": "uuid",
  "name": "Prénom Nom",
  "email": "email@entreprise.ma",
  "department": "Nom du département",
  "realm_access": { "roles": ["collaborateur"] },
  "exp": 1234567890
}
```

### 3. Endpoint Refresh
```
POST /api/auth/refresh
Body  : { "refreshToken": "..." }
Retour: { "accessToken": "...", "refreshToken": "..." }
```

---

## Priorité HAUTE — Bloque les dashboards

### 4. KPIs Collaborateur
```
GET /api/kpi/collaborateur
Headers: Authorization: Bearer <token>
Retour :
{
  "congesRestants": 18,
  "absencesMois": 2,
  "formationsOk": 4,
  "formationsTotal": 6,
  "scoreEngagement": 87,
  "notifications": [{ "type": "info|warn|success", "text": "...", "time": "Il y a 2h" }],
  "onboardingSteps": [{ "label": "...", "done": true }],
  "alertes": [{ "type": "warn", "msg": "...", "action": "Planifier" }]
}
```

### 5. KPIs RH
```
GET /api/kpi/rh
Headers: Authorization: Bearer <token> (rôle manager minimum)
Retour :
{
  "effectifTotal": 148, "effectifDelta": 3,
  "tauxAbsenteisme": 4.2, "absenteismeDelta": -0.8,
  "tauxTurnover": 12.1, "turnoverDelta": 1.2,
  "alertesActives": 7, "alertesDelta": 2,
  "scoreEngagement": 74,
  "repartitionEngagement": [{ "label": "Très engagés", "pct": 32 }],
  "absenteismeMensuel": [3.8, 4.0, 5.1, 4.6, 3.9, 4.2],
  "absenteismeLabels": ["Jan","Fév","Mar","Avr","Mai","Jun"],
  "alertesDesengagement": [{ "name": "...", "dept": "...", "risk": "Élevé", "reason": "...", "score": 82 }]
}
```

### 6. Admin — Logs & Alertes
```
GET /api/admin/logs    → [{ "time": "10:22", "user": "...", "action": "...", "module": "...", "status": "OK|REFUSÉ|BLOQUÉ" }]
GET /api/admin/alerts  → [{ "id": "ALT-001", "level": "Critique|Élevé|Moyen|Faible", "user": "...", "role": "...", "action": "...", "time": "...", "date": "...", "count": 1, "ip": "..." }]
GET /api/admin/roles   → [{ "name": "Administrateurs", "count": 3, "perms": ["Accès total"] }]
```

### 7. Assistant IA
```
POST /api/ia/chat
Body  : { "message": "...", "history": [{ "role": "user|assistant", "content": "..." }] }
Retour: { "reply": "Réponse de l'IA..." }

Important côté backend :
- Vérifier le rôle de l'utilisateur AVANT de traiter la requête
- Limiter les sujets accessibles selon le rôle (ex: collaborateur ne peut pas accéder aux données des autres)
- Logguer toutes les tentatives d'accès à des données hors périmètre
- Implémenter une deuxième couche de détection prompt injection côté serveur
```

---

## Priorité NORMALE — Fonctionnalités complètes

### 8. Mot de passe oublié
```
POST /api/auth/forgot-password
Body  : { "email": "..." }
Action: Envoyer un email avec lien contenant un token signé (expiration 30 min)
Retour: { "ok": true }  ← toujours 200 (sécurité : ne pas révéler si l'email existe)

GET  /api/auth/reset-password/verify?token=xxx
Retour: { "valid": true } ou 400 si token expiré/invalide

POST /api/auth/reset-password
Body  : { "token": "...", "newPassword": "..." }
Retour: { "ok": true } ou 400 si token invalide
```

### 9. Documents RH
```
GET  /api/documents        → [{ "id": "...", "name": "...", "date": "...", "status": "Disponible|En cours|Approuvé", "icon": "📄" }]
POST /api/documents/generate → { "type": "attestation_travail|...", "fields": {} } → { "id": "...", "status": "..." }
GET  /api/documents/:id/pdf  → Fichier PDF (Content-Type: application/pdf)
```

### 10. Onboarding
```
GET   /api/onboarding/me                   → Objet parcours complet (voir README pour la structure)
PATCH /api/onboarding/steps/:id            → { "done": true } → { "ok": true }
```

### 11. Offboarding
```
GET   /api/offboarding/:id                 → Objet offboarding complet
PATCH /api/offboarding/steps/:id           → { "done": true } → { "ok": true }
POST  /api/ia/synthese                     → { "userId": "..." } → { "content": "markdown..." }
```

### 12. Profil utilisateur
```
GET    /api/profil/me                      → { prenom, nom, email, telephone, poste, departement, localisation, embauche }
PUT    /api/profil/me                      → Même structure → { "ok": true }
PATCH  /api/profil/password                → { "current": "...", "newPassword": "..." } → { "ok": true }
GET    /api/profil/sessions                → [{ "device": "...", "location": "...", "time": "...", "current": true }]
DELETE /api/profil/sessions/:id            → { "ok": true }
PATCH  /api/profil/notifications           → { email, push, rh, alertes, onboarding } → { "ok": true }
```

---

## Sécurité Backend à implémenter

### Côté serveur — indispensable

| Mesure | Pourquoi |
|--------|---------|
| Validation du rôle JWT sur CHAQUE endpoint | Le frontend vérifie aussi, mais le backend ne doit JAMAIS faire confiance au client |
| Double détection prompt injection côté serveur | Le frontend bloque les patterns connus, mais de nouveaux peuvent passer |
| Rate limiting sur `/api/auth/login` | Empêcher le brute-force (ex: 5 tentatives / 15 min par IP) |
| Rate limiting sur `/api/ia/chat` | Éviter le spam et les coûts IA excessifs |
| Journalisation de TOUTES les tentatives d'accès refusées | Alimenter le dashboard admin en temps réel |
| Cookies httpOnly pour les tokens | En production, migrer vers cookies httpOnly + SameSite=Strict au lieu de JWT Bearer |
| CORS strict | Autoriser uniquement les origines de prod (pas de wildcard `*`) |
| Validation des inputs côté serveur | Ne jamais faire confiance à ce que le frontend envoie (SQL injection, etc.) |
| Chiffrement des données sensibles en base | Paie, données médicales, notes d'entretien |
| Audit trail complet | Chaque action sensible (génération document, modification profil, etc.) doit être tracée |

### Headers CORS requis
```
Access-Control-Allow-Origin: https://[votre-domaine] (pas de *)
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Expose-Headers: Authorization
```

### Codes HTTP attendus par le frontend
| Code | Situation |
|------|-----------|
| 200 | Succès |
| 201 | Ressource créée |
| 400 | Données invalides → `{ "message": "Détail erreur" }` |
| 401 | Token expiré → le frontend tentera un refresh automatiquement |
| 403 | Rôle insuffisant → le frontend redirige vers /403 |
| 404 | Ressource inexistante |
| 429 | Rate limit → le frontend affichera un message d'attente |
| 500 | Erreur serveur → `{ "message": "Erreur interne" }` |

---

## Récapitulatif final

### Frontend — Statut
| Sprint | Tâche | Statut |
|--------|-------|--------|
| S1 | Structure front + design system | ✅ Complet |
| S1 | Tokens JWT en mémoire + RBAC | ✅ Complet |
| S2 | Login + SSO Keycloak | ✅ Complet |
| S2 | Mot de passe oublié + réinitialisation | ✅ Complet |
| S2 | Page inscription supprimée (app interne) | ✅ Complet |
| S3 | ProtectedRoute + RoleGuard | ✅ Complet |
| S3 | Données dynamiques depuis API (tous les dashboards) | ✅ Complet |
| S3 | Skeleton loaders + mode démo | ✅ Complet |
| S3 | Chat IA branché API + fallback | ✅ Complet |
| S3 | Offboarding avec ID dynamique (/offboarding/:id) | ✅ Complet |
| S4 | DOMPurify + détection prompt injection | ✅ Complet |
| S4 | Validation formulaires (email, password, nom) | ✅ Complet |
| S4 | 42 tests Vitest sécurité | ✅ Complet |
| S4 | nginx.conf avec CSP + headers sécurité | ✅ Complet |
| S4 | Dockerfile + docker-compose.yml | ✅ Complet |
| S4 | Global loader navigation + bandeau hors ligne | ✅ Complet |

**Build : 0 erreur — Tests : 42/42 — ESLint : 0 erreur**

### Backend — Priorités
| Priorité | Tâche |
|----------|-------|
| 🔴 CRITIQUE | Keycloak : realm + client + 5 rôles |
| 🔴 CRITIQUE | POST /api/auth/login + /refresh |
| 🟠 HAUTE | GET /api/kpi/collaborateur + /kpi/rh |
| 🟠 HAUTE | GET /api/admin/logs + /alerts |
| 🟠 HAUTE | POST /api/ia/chat |
| 🟡 NORMALE | /api/auth/forgot-password + /reset-password |
| 🟡 NORMALE | /api/documents (liste + génération + PDF) |
| 🟡 NORMALE | /api/onboarding + /offboarding |
| 🟡 NORMALE | /api/profil/me + sessions + notifications |
| 🟢 SÉCURITÉ | Rate limiting login + chat IA |
| 🟢 SÉCURITÉ | Double validation prompt injection serveur |
| 🟢 SÉCURITÉ | Journalisation accès refusés → dashboard admin |
| 🟢 SÉCURITÉ | Cookies httpOnly en production |
