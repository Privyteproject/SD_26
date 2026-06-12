import { ROLES, STATUS } from "./constants";

// Stockage local (pas de base de données) : comptes + session.
// NB : authentification front uniquement (à remplacer par Keycloak plus tard).
const USERS_KEY = "sd-users-v1";
const SESSION_KEY = "sd-session-v1";
const DEMO_PWD = "demo1234";

// Comptes initiaux (créés par défaut). L'admin peut en créer d'autres.
const SEED = [
  { id: "u-admin", name: "Admin Système", email: "admin@synapse.io", password: DEMO_PWD, role: ROLES.ADMIN, status: STATUS.ACTIVE, dept: "SI" },
  { id: "u-rh", name: "Karim Benali", email: "rh@synapse.io", password: DEMO_PWD, role: ROLES.RH, status: STATUS.ACTIVE, dept: "RH" },
  { id: "u-mgr", name: "Sofia Alami", email: "manager@synapse.io", password: DEMO_PWD, role: ROLES.MANAGER, status: STATUS.ACTIVE, dept: "Ops" },
  { id: "u-dir", name: "Nadia Idrissi", email: "direction@synapse.io", password: DEMO_PWD, role: ROLES.DIRECTION, status: STATUS.ACTIVE, dept: "Direction" },
  { id: "u-med", name: "Dr. N. Saidi", email: "medecine@synapse.io", password: DEMO_PWD, role: ROLES.MEDECINE, status: STATUS.ACTIVE, dept: "Santé" },
  { id: "u-new", name: "Yannick Keke", email: "yannick@synapse.io", password: DEMO_PWD, role: ROLES.COLLABORATEUR, status: STATUS.NEW, dept: "SI" },
  { id: "u-act", name: "Lina Cherkaoui", email: "lina@synapse.io", password: DEMO_PWD, role: ROLES.COLLABORATEUR, status: STATUS.ACTIVE, dept: "Ventes" },
  { id: "u-leave", name: "Sami Lahlou", email: "sami@synapse.io", password: DEMO_PWD, role: ROLES.COLLABORATEUR, status: STATUS.LEAVING, dept: "Ops" },
];

export const DEMO_PASSWORD = DEMO_PWD;

function safeGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

export function loadUsers() {
  const existing = safeGet(USERS_KEY);
  if (existing && Array.isArray(existing) && existing.length) return existing;
  safeSet(USERS_KEY, SEED);
  return SEED;
}
export function saveUsers(users) { safeSet(USERS_KEY, users); }

export function loadSession() {
  const s = safeGet(SESSION_KEY);
  if (!s) return null;
  // On revalide l'utilisateur depuis la liste (au cas où il aurait été supprimé)
  const users = loadUsers();
  return users.find((u) => u.id === s.id) || null;
}
export function saveSession(user) {
  if (user) safeSet(SESSION_KEY, { id: user.id });
  else { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }
}

// Authentifie par e-mail + mot de passe. Renvoie l'utilisateur ou null.
export function authenticate(email, password) {
  const users = loadUsers();
  const e = (email || "").trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === e && u.password === password) || null;
}

export function makeUser({ name, email, password, role, status, dept }) {
  return {
    id: "u-" + Math.random().toString(36).slice(2, 9),
    name: name.trim(), email: email.trim(), password, role,
    status: status || STATUS.ACTIVE, dept: dept || "—",
  };
}
