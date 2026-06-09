/**
 * AuthContext — Synapse Digital
 * Gestion JWT : stockage sécurisé (httpOnly simulé en mémoire),
 * refresh token, RBAC depuis payload, Keycloak SSO.
 *
 * En production : les tokens doivent être dans des cookies httpOnly
 * côté serveur. Ici on utilise le mode mémoire (variable module)
 * pour éviter les attaques XSS via localStorage.
 */

import { createContext, useContext, useState, useCallback } from "react";
import axios from "axios";

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const KC_URL   = import.meta.env.VITE_KC_URL   || "http://localhost:8180";
const KC_REALM = import.meta.env.VITE_KC_REALM || "synapse";
const KC_CLIENT= import.meta.env.VITE_KC_CLIENT|| "synapse-frontend";

// ─── Stockage mémoire (sécurité XSS) ─────────────────────────────────────────
// Les tokens ne sont JAMAIS dans localStorage / sessionStorage.
// Ils vivent uniquement dans la mémoire du module JS.
let _accessToken  = null;
let _refreshToken = null;
let _refreshTimer = null;

export const TokenStore = {
  get access()  { return _accessToken; },
  get refresh() { return _refreshToken; },
  set(access, refresh) {
    _accessToken  = access;
    _refreshToken = refresh;
    // Planifier le refresh automatique (à 80% de la durée du token)
    const exp = TokenStore.decodePayload(access)?.exp;
    if (exp) {
      const msLeft = (exp * 1000 - Date.now()) * 0.80;
      clearTimeout(_refreshTimer);
      _refreshTimer = setTimeout(() => TokenStore.triggerRefresh?.(), Math.max(msLeft, 5000));
    }
  },
  clear() {
    _accessToken = null;
    _refreshToken = null;
    clearTimeout(_refreshTimer);
  },
  decodePayload(token) {
    if (!token) return null;
    try {
      const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(base64));
    } catch { return null; }
  },
  triggerRefresh: null, // sera injecté par le contexte
};

// ─── Axios intercepteur ───────────────────────────────────────────────────────
axios.interceptors.request.use((config) => {
  if (TokenStore.access) {
    config.headers.Authorization = `Bearer ${TokenStore.access}`;
  }
  return config;
});

axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry && TokenStore.refresh) {
      original._retry = true;
      try {
        const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, {
          refreshToken: TokenStore.refresh,
        });
        TokenStore.set(data.accessToken, data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axios(original);
      } catch {
        TokenStore.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ─── RBAC helpers ─────────────────────────────────────────────────────────────
export const ROLES = {
  COLLABORATEUR: "collaborateur",
  MANAGER:       "manager",
  RH:            "rh",
  DIRECTION:     "direction",
  ADMIN:         "admin",
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]:         5,
  [ROLES.DIRECTION]:     4,
  [ROLES.RH]:            3,
  [ROLES.MANAGER]:       2,
  [ROLES.COLLABORATEUR]: 1,
};

export function getRoleFromPayload(payload) {
  if (!payload) return ROLES.COLLABORATEUR;
  // Keycloak stocke les rôles dans realm_access.roles
  const realmRoles = payload?.realm_access?.roles || [];
  // Fallback champ custom
  const customRole = payload?.role || payload?.synapse_role;
  const all = [...realmRoles, customRole].filter(Boolean).map(r => r.toLowerCase());

  if (all.includes(ROLES.ADMIN))    return ROLES.ADMIN;
  if (all.includes(ROLES.DIRECTION)) return ROLES.DIRECTION;
  if (all.includes(ROLES.RH))       return ROLES.RH;
  if (all.includes(ROLES.MANAGER))  return ROLES.MANAGER;
  return ROLES.COLLABORATEUR;
}

export function hasRole(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

export function getDefaultRoute(role) {
  if (role === ROLES.ADMIN)     return "/admin";
  if (role === ROLES.RH)        return "/rh/dashboard";
  if (role === ROLES.MANAGER)   return "/rh/dashboard";
  if (role === ROLES.DIRECTION) return "/rh/dashboard";
  return "/dashboard";
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // { id, name, email, role, initials }
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // Injecter le refresh dans TokenStore
  TokenStore.triggerRefresh = useCallback(async () => {
    if (!TokenStore.refresh) return logout();
    try {
      const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, {
        refreshToken: TokenStore.refresh,
      });
      TokenStore.set(data.accessToken, data.refreshToken);
      const payload = TokenStore.decodePayload(data.accessToken);
      if (payload) setUser(buildUser(payload));
    } catch {
      logout();
    }
  }, []);

  function buildUser(payload) {
    const role = getRoleFromPayload(payload);
    const name = payload.name || payload.preferred_username || payload.email || "Utilisateur";
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    return {
      id:       payload.sub,
      name,
      email:    payload.email || "",
      role,
      initials,
      dept:     payload.department || "",
    };
  }

  // ── Login classique email/mdp ──────────────────────────────────────────────
  async function login(email, password) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
      TokenStore.set(data.accessToken, data.refreshToken);
      const payload = TokenStore.decodePayload(data.accessToken);
      const u = buildUser(payload);
      setUser(u);
      return { ok: true, role: u.role };
    } catch (err) {
      const msg = err.response?.data?.message || "Identifiants incorrects.";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }

  // ── Register ──────────────────────────────────────────────────────────────
  async function register(name, email, password) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API_BASE}/api/auth/register`, { name, email, password });
      TokenStore.set(data.accessToken, data.refreshToken);
      const payload = TokenStore.decodePayload(data.accessToken);
      const u = buildUser(payload);
      setUser(u);
      return { ok: true, role: u.role };
    } catch (err) {
      const msg = err.response?.data?.message || "Erreur lors de l'inscription.";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }

  // ── Keycloak SSO ──────────────────────────────────────────────────────────
  async function loginSSO() {
    try {
      const Keycloak = (await import("keycloak-js")).default;
      const kc = new Keycloak({ url: KC_URL, realm: KC_REALM, clientId: KC_CLIENT });
      const authenticated = await kc.init({ onLoad: "login-required", checkLoginIframe: false });
      if (authenticated) {
        TokenStore.set(kc.token, kc.refreshToken);
        // Refresh automatique Keycloak
        kc.onTokenExpired = () => kc.updateToken(60).then(() => {
          TokenStore.set(kc.token, kc.refreshToken);
        });
        const payload = TokenStore.decodePayload(kc.token);
        const u = buildUser(payload);
        setUser(u);
        return { ok: true, role: u.role };
      }
    } catch (err) {
      console.error("Keycloak SSO error:", err);
      setError("Erreur SSO. Vérifiez la configuration Keycloak.");
      return { ok: false };
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  function logout() {
    TokenStore.clear();
    setUser(null);
  }

  // ── Mode démo (sans backend) ──────────────────────────────────────────────
  function loginDemo(role = ROLES.COLLABORATEUR) {
    // JWT démo signé localement (payload uniquement, pas vérifié côté serveur)
    const payload = {
      sub: "demo-user-001",
      name: role === ROLES.ADMIN ? "Admin Système"
          : role === ROLES.RH    ? "Marie Rousseau"
          : role === ROLES.MANAGER ? "Thomas Leroy"
          : "Arush Ramisami",
      email: `demo.${role}@synapse.ma`,
      role,
      realm_access: { roles: [role] },
      department: role === ROLES.ADMIN ? "IT" : role === ROLES.RH ? "RH" : "Tech & Produit",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
    // Simuler un JWT encodé (header.payload.signature)
    const encode = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, "");
    const fakeToken = `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.demo-signature`;
    TokenStore.set(fakeToken, "demo-refresh");
    const u = buildUser(payload);
    setUser(u);
    return { ok: true, role: u.role };
  }

  const value = {
    user, loading, error,
    login, register, loginSSO, loginDemo, logout,
    isAuthenticated: !!user,
    role: user?.role || null,
    hasRole: (r) => hasRole(user?.role, r),
    getDefaultRoute: () => getDefaultRoute(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
