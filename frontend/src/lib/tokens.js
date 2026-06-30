// Stockage des jetons + décodage JWT + mapping des rôles Keycloak vers les rôles de l'app.
const ACCESS_KEY = "sd-access-token";
const REFRESH_KEY = "sd-refresh-token";

export function setTokens({ access_token, refresh_token }) {
  try {
    if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  } catch { /* ignore */ }
}
export function getAccessToken() { try { return localStorage.getItem(ACCESS_KEY); } catch { return null; } }
export function getRefreshToken() { try { return localStorage.getItem(REFRESH_KEY); } catch { return null; } }
export function clearTokens() {
  try { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
}

// Décode le payload d'un JWT (sans vérifier la signature — la vérif est côté backend).
export function decodeJwt(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}

// Rôles realm Keycloak (minuscules) -> rôles applicatifs (constants.js)
const REALM_TO_APP = {
  admin: "ADMIN", rh: "RH", manager: "MANAGER",
  direction: "DIRECTION", medecine: "MEDECINE", collaborateur: "COLLABORATEUR",
};
const PRIORITY = ["ADMIN", "DIRECTION", "RH", "MANAGER", "MEDECINE", "COLLABORATEUR"];

export function appRoleFromToken(token) {
  const payload = decodeJwt(token);
  const realmRoles = (payload && payload.realm_access && payload.realm_access.roles) || [];
  const appRoles = realmRoles.map((r) => REALM_TO_APP[String(r).toLowerCase()]).filter(Boolean);
  for (const r of PRIORITY) if (appRoles.includes(r)) return r;
  return "COLLABORATEUR";
}
