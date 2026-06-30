# Intégration Frontend ↔ Backend — Synapse Digital (YDAYS 2026)

Connecter le front **React/Vite** (ce dossier `frontend/`) au backend **FastAPI** + **Keycloak**.
Le code front est **déjà branché** ; les snippets backend sont dans `backend-snippets/`.

> Ordre de test conseillé : **2 (CORS) → 1 (Keycloak) → 3 (e2e) → 4 (401/refresh) → 5 (env)**.

Bascule mock ⇄ réel via une seule variable front : `VITE_USE_MOCK=false` (réel) / `true` (démo hors-ligne).

---

## POINT 2 — CORS (à régler EN PREMIER)

C'est le premier blocage : sans CORS, le navigateur refuse toute requête cross-origin.

**Fichier : `backend-snippets/main_cors.py`** → à reporter dans `backend/app/main.py` :

```python
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,  # ["http://localhost:5173", "https://app.synapse.ma"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Ajouter dans `app/core/config.py` :

```python
BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]
JWT_AUDIENCE: str = "account"
```

**Tester le preflight** (doit répondre `200/204` avec les en-têtes `access-control-allow-origin`) :

```bash
curl -i -X OPTIONS http://localhost:8000/api/v1/employees \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
```

---

## POINT 1 — Flow Keycloak complet

### A. Configuration dans l'admin console Keycloak (`http://localhost:8080`)

1. **Créer le realm** `ydays`.
2. **Rôles** (Realm roles) : `collaborateur`, `manager`, `rh`, `admin` (+ `direction`, `medecine` si besoin).
3. **Client public `frontend-app`** (utilisé par le navigateur) :
   - *Client authentication* : **OFF** (public).
   - *Direct access grants* : **ON** ← indispensable pour le flow **ROPC** (login par mot de passe en dev).
   - *Standard flow* : **ON** (si vous voulez aussi l'Authorization Code).
   - *Valid redirect URIs* : `http://localhost:5173/*` (+ l'URL de prod).
   - *Web origins* : `http://localhost:5173` (ou `+`).
4. **Client confidentiel `backend-api`** : *Client authentication* **ON**. Le backend ne fait que **vérifier** les JWT (clé publique via JWKS), il n'a pas besoin de plus côté code.
5. **Créer les utilisateurs** (onglet Users → Credentials pour le mot de passe) et leur **assigner un rôle** (Role mapping).

### B. Code frontend (déjà présent)

- `src/lib/keycloak.js` → `loginWithPassword(username, password)` (ROPC, `grant_type=password`, client `frontend-app`) et `refreshTokens()`.
- `src/lib/tokens.js` → stockage des jetons + `appRoleFromToken()` (mappe `realm_access.roles` → rôles de l'app).
- `src/app/providers/SessionProvider.jsx` → en mode réel, `login()` appelle Keycloak puis `getMe()` et construit l'utilisateur courant.

> **ROPC vs Authorization Code** : le ROPC (implémenté ici) est parfait pour le dev — pas de redirection, un simple POST. Pour la prod, l'**Authorization Code + PKCE** est recommandé (redirection vers la page de login Keycloak) ; il suffirait de remplacer `loginWithPassword` par une lib comme `keycloak-js`. La couche `api.js` / `tokens.js` reste identique.

---

## POINT 3 — Test end-to-end d'un endpoint

**1) Obtenir un token depuis Keycloak (ROPC, client public `frontend-app`)**

```bash
TOKEN=$(curl -s -X POST \
  http://localhost:8080/realms/ydays/protocol/openid-connect/token \
  -d grant_type=password \
  -d client_id=frontend-app \
  -d username=rh@synapse.io \
  -d password=VOTRE_MDP | jq -r .access_token)

echo "$TOKEN" | cut -c1-40   # doit afficher le début d'un JWT
```

**2) Appeler l'endpoint protégé avec ce token**

```bash
curl -s http://localhost:8000/api/v1/employees \
  -H "Authorization: Bearer $TOKEN" | jq
# Attendu : { "data": [ ... ], "meta": { "total": N, "page": 1, "limit": 20 }, "errors": [] }
```

Sans token → `401`. Avec un rôle insuffisant → `403`.

**3) Vérifier l'affichage des vraies données dans le front**

```bash
cd frontend
cp .env.example .env        # puis éditer :
#   VITE_USE_MOCK=false
npm run dev
```

Ouvrir `http://localhost:5173`, se connecter avec un compte **Keycloak** (le panneau « comptes de démonstration » disparaît automatiquement en mode réel), et vérifier que les listes affichent les données du backend (et non `mockData`).

---

## POINT 4 — Gestion des erreurs CORS et 401 (refresh silencieux)

**Que fait le front sur un 401 ?** (déjà codé dans `src/lib/api.js`)

1. Tente **un seul** refresh silencieux via le `refresh_token` (`lib/keycloak.js → refreshTokens()`).
2. Si le refresh réussit → la requête initiale est **rejouée** automatiquement (transparent pour l'utilisateur).
3. Si le refresh échoue → on **efface les tokens**, on émet l'événement `auth:expired`, le `SessionProvider` déconnecte, et `ProtectedRoute` redirige vers `/login`.

```javascript
// src/lib/api.js (extrait)
if (res.status === 401 && !_retry) {
  try {
    await refreshTokens();                                   // refresh silencieux
    return request(path, { method, body, params, _retry: true }); // rejoue UNE fois
  } catch {
    clearTokens();
    emit("auth:expired");                                    // -> logout + redirect /login
    throw new ApiError(401, "Session expirée");
  }
}
if (res.status === 403) emit("api:error", { message: "Accès non autorisé" }); // toast
```

```javascript
// src/lib/keycloak.js (extrait)
export async function refreshTokens() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) throw new Error("no_refresh_token");
  const data = await tokenRequest({ grant_type: "refresh_token", client_id: CLIENT_ID, refresh_token });
  setTokens(data);
  return data.access_token;
}
```

> Les **erreurs CORS** ne sont pas rattrapables en JS (le navigateur bloque avant la réponse) : elles se règlent **uniquement** côté backend (POINT 2). Si une requête « échoue sans statut », c'est presque toujours un CORS mal configuré.

---

## POINT 5 — Variables d'environnement (dev ET prod)

**Frontend** — `frontend/.env.example` :

```
VITE_USE_MOCK=true                 # false = vrai backend
VITE_API_BASE_URL=/api/v1          # passe par le proxy Vite en dev
VITE_PROXY_TARGET=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=ydays
VITE_KEYCLOAK_CLIENT_ID=frontend-app
```

Le proxy est configuré dans `frontend/vite.config.js` (`/api` → `VITE_PROXY_TARGET`).
En **prod**, servez le build derrière un reverse-proxy qui route `/api` vers le backend, ou mettez `VITE_API_BASE_URL=https://api.synapse.ma/api/v1`.

**Backend** — `backend-snippets/.env.backend.example` (à copier en `backend/.env`).
Points clés dev vs prod Docker :

| Variable | Dev local | Prod Docker (réseau compose) |
|---|---|---|
| `KEYCLOAK_URL` | `http://localhost:8080` | `http://keycloak:8080` |
| `POSTGRES_HOST` | `localhost` | `db` |
| `REDIS_HOST` | `localhost` | `redis` |
| `MINIO_ENDPOINT` | `localhost:9000` | `minio:9000` |
| `BACKEND_CORS_ORIGINS` | `["http://localhost:5173"]` | `[..., "https://app.synapse.ma"]` |

---

## Rappels backend (importants)

- **Ordre des routes FastAPI** : déclarer les routes spécifiques (`/me`, `/stats`) **avant** les routes dynamiques (`/{id}`), sinon `/me` est capturé par `/{id}`. Voir `backend-snippets/endpoints_employees.py`.
- **Lecture = soft delete** : toutes les requêtes GET/KPI filtrent `WHERE is_deleted = False`. Voir les exemples dans `endpoints_employees.py`.
- **Auth** : `backend-snippets/auth.py` valide le JWT via le **JWKS** Keycloak (RS256) et fournit `get_current_user` / `require_role(...)` + filtre par `department_id` pour les managers.

## Carte des fichiers

```
frontend/
  vite.config.js                      # proxy /api -> backend
  .env.example                        # variables VITE_*
  src/lib/tokens.js                   # stockage jetons + mapping rôles
  src/lib/keycloak.js                 # login ROPC + refresh
  src/lib/api.js                      # client fetch (Bearer, 401->refresh, 403->toast)
  src/app/providers/SessionProvider.jsx  # mock ⇄ Keycloak, restauration de session
  src/components/Toast.jsx            # toast 403 / session expirée
backend-snippets/
  main_cors.py                        # POINT 2 — CORS
  auth.py                             # validation JWT Keycloak (JWKS)
  endpoints_employees.py             # CRUD (ordre des routes + is_deleted)
  .env.backend.example                # POINT 5 — env backend
```
