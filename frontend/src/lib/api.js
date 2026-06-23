// Client API centralisé (fetch). Préfixe /api/v1, injecte le Bearer, gère 401 (refresh
// silencieux puis redirection) et 403 (toast). Toutes les fonctions renvoient le JSON { data, meta, errors }.
import { getAccessToken, clearTokens } from "./tokens";
import { refreshTokens } from "./keycloak";

const BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export class ApiError extends Error {
  constructor(status, message, payload) { super(message); this.status = status; this.payload = payload; }
}
function emit(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* ignore */ } }
function qs(params) {
  if (!params) return "";
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : "";
}
async function parse(res) { try { return await res.json(); } catch { return null; } }

async function request(path, { method = "GET", body, params, _retry = false } = {}) {
  const headers = {};
  const isFormData = body instanceof FormData;
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}${qs(params)}`, {
    method,
    headers,
    body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });


  // 401 : tenter un refresh silencieux UNE fois, puis rejouer la requête
  if (res.status === 401 && !_retry) {
    try {
      await refreshTokens();
      return request(path, { method, body, params, _retry: true });
    } catch {
      clearTokens();
      emit("auth:expired");
      throw new ApiError(401, "Session expirée");
    }
  }
  if (res.status === 403) emit("api:error", { message: "Accès non autorisé" });

  const data = await parse(res);
  if (!res.ok) {
    const msg = (data && (data.detail || (data.errors && data.errors[0]))) || res.statusText;
    throw new ApiError(res.status, msg, data);
  }
  return data;
}

// ---- Authentification ----
// (le login Keycloak passe par lib/keycloak.js ; getMe lit le profil connecté)
export const getMe = () => request("/employees/me");

// ---- Employés ----
export const getEmployees = (params) => request("/employees", { params });
export const getEmployee = (id) => request(`/employees/${id}`);
export const createEmployee = (data) => request("/employees", { method: "POST", body: data });
export const updateEmployee = (id, data) => request(`/employees/${id}`, { method: "PUT", body: data });
export const deleteEmployee = (id) => request(`/employees/${id}`, { method: "DELETE" });

// ---- Absences ----
export const getAbsences = (params) => request("/absences", { params });
export const createAbsence = (data) => request("/absences", { method: "POST", body: data });
export const updateAbsenceStatus = (id, status) => request(`/absences/${id}/status`, { method: "PATCH", body: { status } });
export const getAbsenceStats = (params) => request("/absences/stats", { params });

// ---- Dashboard ----
export const getDashboardKpis = () => request("/dashboard/kpis");
export const getDashboardRh = () => request("/dashboard/rh");
export const getDashboardIndicateurs = (params) => request("/dashboard/indicateurs", { params });
export const getDashboardRisques = (params) => request("/dashboard/risques", { params });

// ---- Parcours (onboarding / offboarding) ----
export const getParcoursModeles = (params) => request("/parcours/modeles", { params });
export const getParcours = (matricule, params) => request(`/parcours/${matricule}`, { params });
export const initParcours = (matricule, typeParcours) =>
  request(`/parcours/${matricule}/init`, { method: "POST", body: { type_parcours: typeParcours } });
export const updateTacheStatus = (id, status, dateRealisation) =>
  request(`/parcours/taches/${id}`, { method: "PATCH", body: { status, date_realisation: dateRealisation } });
// Tâche personnalisée pour un employé + suppression d'une tâche
export const addParcoursTache = (matricule, data) =>
  request(`/parcours/${matricule}/taches`, { method: "POST", body: data });
export const deleteParcoursTache = (id) =>
  request(`/parcours/taches/${id}`, { method: "DELETE" });
// Gestion des modèles de tâches par défaut
export const createModele = (data) => request("/parcours/modeles", { method: "POST", body: data });
export const updateModele = (code, data) => request(`/parcours/modeles/${code}`, { method: "PUT", body: data });
export const deleteModele = (code) => request(`/parcours/modeles/${code}`, { method: "DELETE" });

// ---- Assistant IA ----
// Renvoie { data: { reply, model, degraded, judge, meta: { perimetre, conversation_id… } }, ... }
export const sendChatMessage = (message, { history = [], judge = false, sessionId = null, audience = "collaborateur" } = {}) =>
  request("/ai/chat", { method: "POST", body: { message, history, judge, session_id: sessionId, audience } });

// ---- Historique des chats (sessions persistées en base) ----
export const getChatSessions = () => request("/chat/sessions");
export const createChatSession = () => request("/chat/sessions", { method: "POST" });
export const getChatSessionMessages = (id) => request(`/chat/sessions/${id}/messages`);
export const deleteChatSession = (id) => request(`/chat/sessions/${id}`, { method: "DELETE" });

// Journaux d'audit IA (supervision ADMIN) : { data: [...], meta: { count, total_tokens, sensibles } }
export const getAiLogs = (params) => request("/ai/logs", { params });

// ---- Recherche globale ----
// { data: { results: [{type,id,title,subtitle,url,icon}], total, query } }
export const globalSearch = (q, limit = 10) => request("/search", { params: { q, limit } });

// ---- Journal d'audit (ADMIN) ----
// Mutations tracées automatiquement : { data: [{ date, action, entite, actor, ip, changements }], meta: { total } }
export const getAuditLogs = (params) => request("/audit", { params });

// ---- Documents ----
export const getDocuments = (params) => request("/documents", { params });
export const getDocumentModeles = (params) => request("/documents/modeles", { params });
// Gestion des types de documents (RH/Direction).
export const createDocumentModele = (data) => request("/documents/modeles", { method: "POST", body: data });
export const updateDocumentModele = (code, data) => request(`/documents/modeles/${code}`, { method: "PUT", body: data });
export const uploadDocumentModeleFile = (code, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return request(`/documents/modeles/${code}/upload`, { method: "POST", body: fd });
};
export const previewDocumentTemplate = (data) => request("/documents/modeles/preview", { method: "POST", body: data });
export const deleteDocumentModele = (code) => request(`/documents/modeles/${code}`, { method: "DELETE" });
export const createDocument = (data) => request("/documents", { method: "POST", body: data });
// Types de documents disponibles (filtrés par rôle) : champs requis/optionnels + validation RH.
export const getDocumentTypes = () => request("/documents/types");
// Workflow preview -> submit (aperçu signé HMAC puis confirmation).
export const previewDocument = (data) => request("/documents/preview", { method: "POST", body: data });
export const confirmDocument = (preview_token) => request("/documents/submit", { method: "POST", body: { preview_token } });
export const getMyDocuments = () => request("/documents/my");
// Édition d'un brouillon (nom et/ou contenu) — propriétaire, statut draft/refused.
export const updateDocument = (id, data) => request(`/documents/${id}`, { method: "PATCH", body: data });
// Soumission explicite : draft|refused -> pending (validation RH).
export const submitDocument = (id) => request(`/documents/${id}/submit`, { method: "POST" });
export const updateDocumentStatus = (id, status) =>
  request(`/documents/${id}/status`, { method: "PATCH", body: { status } });

// Téléchargement sécurisé (Bearer) : récupère le binaire et déclenche l'enregistrement.
export async function downloadDocument(id) {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/documents/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "Téléchargement impossible");
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename="?([^"]+)"?/.exec(cd);
  const filename = m ? m[1] : `document-${id}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default { getMe, getEmployees, getEmployee, getAbsences, createAbsence, updateAbsenceStatus, getDashboardKpis, sendChatMessage };
