# Synapse Digital — Plateforme IA RH
## YDAYS 2026 · Frontend · Arush Ramisami

---

## Lancement rapide

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # Build production → dist/
npm run test       # 42 tests XSS/sécurité
```

---

## Structure du projet

```
src/
├── auth/
│   ├── AuthContext.jsx      # JWT mémoire, RBAC, Keycloak, refresh auto
│   ├── ProtectedRoute.jsx   # Guard rôle → /403, token expiré → /login
│   ├── useApi.js            # Axios sécurisé, Bearer auto, retry 401
│   ├── useKpi.js            # Hooks KPIs avec fallback démo
│   └── useSecurity.js       # DOMPurify, prompt injection, validators
├── components/
│   ├── Layout.jsx           # Wrapper sidebar + topbar partagé
│   ├── Mark.jsx             # Logo SVG Synapse
│   ├── RoleGuard.jsx        # Affichage conditionnel par rôle
│   ├── Sidebar.jsx          # Navigation avec rôle dynamique
│   └── Skeleton.jsx         # Skeleton loaders
├── pages/
│   ├── Authentification.jsx # Login + SSO Keycloak (sans inscription)
│   ├── DashboardCollaborateur.jsx
│   ├── DashboardRH.jsx
│   ├── DashboardAdmin.jsx
│   ├── AssistantIA.jsx      # Chat + détection injection + fallback démo
│   ├── GenerationDocuments.jsx
│   ├── Onboarding.jsx
│   ├── Offboarding.jsx
│   ├── ProfilUtilisateur.jsx
│   └── ErrorPages.jsx       # 404 + 403
├── tests/
│   └── security.test.js    # 42 tests XSS, injection, JWT, validation
├── App.jsx                  # Routing + AuthProvider + ProtectedRoute
├── theme.js                 # Design tokens dark/light
└── main.jsx
```

---

## Routes & Rôles

| Route | Page | Rôle minimum |
|-------|------|-------------|
| `/` | Login | Public |
| `/dashboard` | Dashboard Collaborateur | collaborateur |
| `/rh/dashboard` | Dashboard RH | manager |
| `/admin` | Dashboard Admin | admin |
| `/assistant` | Assistant IA RH | collaborateur |
| `/documents` | Génération Documents | collaborateur |
| `/onboarding` | Onboarding 30 jours | collaborateur |
| `/offboarding` | Offboarding checklist | manager |
| `/profil` | Profil & Paramètres | collaborateur |
| `/403` | Accès refusé | Public |
| `/*` | 404 | Public |

---

## Déploiement

### Docker
```bash
docker build \
  --build-arg VITE_API_URL=https://api.synapse.ma \
  --build-arg VITE_KC_URL=https://auth.synapse.ma \
  -t synapse-frontend .

docker run -p 80:80 synapse-frontend
```

### Docker Compose (stack complète)
```bash
docker-compose up -d
```

### Nginx seul
```bash
npm run build
# Copier dist/ dans /var/www/synapse/
# Copier nginx.conf dans /etc/nginx/conf.d/synapse.conf
nginx -s reload
```

---

## Variables d'environnement

```bash
VITE_API_URL=https://api.synapse.ma      # URL backend
VITE_KC_URL=https://auth.synapse.ma      # URL Keycloak
VITE_KC_REALM=synapse                    # Realm Keycloak
VITE_KC_CLIENT=synapse-frontend          # Client ID Keycloak
```

---

## Sécurité implémentée (S1→S4)

| Mesure | Fichier | Détail |
|--------|---------|--------|
| Tokens JWT en mémoire | AuthContext.jsx | Jamais localStorage |
| Refresh automatique | AuthContext.jsx | À 80% de la durée du token |
| ProtectedRoute RBAC | ProtectedRoute.jsx | Vérif rôle + expiration |
| Axios Bearer auto | useApi.js | Intercepteur + retry 401 |
| DOMPurify XSS | useSecurity.js | Tous les contenus API |
| Prompt injection | useSecurity.js | 17 patterns FR + EN |
| Validation formulaires | useSecurity.js | email, password, nom, texte |
| Affichage conditionnel | RoleGuard.jsx | Boutons selon rôle |
| CSP headers | nginx.conf | script-src self uniquement |
| Tests sécurité | security.test.js | 42 tests Vitest |

---

## Tests

```bash
npm run test          # 42 tests
npm run test:watch    # Mode watch
```

Couvre : sanitize XSS, détection prompt injection (17 patterns), 
validators (email/password/nom/texte), TokenStore JWT decode.
