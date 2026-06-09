/**
 * useApi — Synapse Digital
 * Hook pour tous les appels API : JWT automatique, retry 401, erreurs normalisées.
 */

import { useState, useCallback } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const call = useCallback(async (method, path, data = null, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios({
        method,
        url: `${API_BASE}${path}`,
        data,
        ...config,
      });
      return { ok: true, data: res.data };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur réseau.";
      setError(msg);
      return { ok: false, error: msg, status: err.response?.status };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading, error,
    get:    (path, config)        => call("GET",    path, null, config),
    post:   (path, data, config)  => call("POST",   path, data, config),
    put:    (path, data, config)  => call("PUT",    path, data, config),
    patch:  (path, data, config)  => call("PATCH",  path, data, config),
    delete: (path, config)        => call("DELETE", path, null, config),
  };
}

// ─── Endpoints nommés ─────────────────────────────────────────────────────────
export const API = {
  // Auth
  LOGIN:           "/api/auth/login",
  REGISTER:        "/api/auth/register",
  REFRESH:         "/api/auth/refresh",

  // Assistant IA
  CHAT:            "/api/ia/chat",
  CHAT_HISTORY:    "/api/ia/chat/history",

  // Documents
  DOCUMENTS_LIST:  "/api/documents",
  DOCUMENTS_GEN:   "/api/documents/generate",
  DOCUMENTS_PDF:   (id) => `/api/documents/${id}/pdf`,

  // Dashboard
  KPI_COLLAB:      "/api/kpi/collaborateur",
  KPI_RH:          "/api/kpi/rh",

  // Onboarding
  ONBOARDING:      "/api/onboarding/me",
  ONBOARDING_STEP: (id) => `/api/onboarding/steps/${id}`,

  // Offboarding
  OFFBOARDING:     (id) => `/api/offboarding/${id}`,
  OFFBOARDING_STEP:(id) => `/api/offboarding/steps/${id}`,
  OFFBOARDING_SYNTHESE: "/api/ia/synthese",

  // Admin
  ADMIN_LOGS:      "/api/admin/logs",
  ADMIN_ALERTS:    "/api/admin/alerts",
  ADMIN_ROLES:     "/api/admin/roles",

  // Profil
  PROFIL:          "/api/profil/me",
  PROFIL_PASSWORD: "/api/profil/password",
  PROFIL_SESSIONS: "/api/profil/sessions",
  PROFIL_NOTIFS:   "/api/profil/notifications",
};
