import { createContext, useContext, useEffect, useState } from "react";
import {
  loadUsers, saveUsers, loadSession, saveSession,
  authenticate, makeUser,
} from "../../lib/authStore";
import { loginWithPassword, kcLogout } from "../../lib/keycloak";
import { getAccessToken, clearTokens, appRoleFromToken } from "../../lib/tokens";
import { getMe, createEmployee } from "../../lib/api";
import { STATUS } from "../../lib/constants";

// Mode démo (hors-ligne) si VITE_USE_MOCK !== "false". En mode réel, l'auth passe par Keycloak.
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [users, setUsers] = useState(() => loadUsers());
  const [currentUser, setCurrentUser] = useState(() => (USE_MOCK ? loadSession() : null));
  const [booting, setBooting] = useState(!USE_MOCK);

  // Construit l'utilisateur courant à partir du profil backend + du rôle porté par le JWT.
  function buildUserFromApi(me) {
    const d = (me && me.data) || me || {};
    const token = getAccessToken();
    return {
      id: d.id || d.user_id || "me",
      name: d.nom ? `${d.prenom || ""} ${d.nom}`.trim() : (d.name || d.email || "Utilisateur"),
      email: d.email || "",
      role: appRoleFromToken(token),
      status: d.status || STATUS.ACTIVE,
      dept: d.department_id || d.dept || "—",
    };
  }

  // Restauration de session au démarrage (mode réel) : un jeton présent => on récupère le profil.
  useEffect(() => {
    if (USE_MOCK) return;
    let alive = true;
    (async () => {
      if (!getAccessToken()) { setBooting(false); return; }
      try {
        const me = await getMe();
        if (alive) setCurrentUser(buildUserFromApi(me));
      } catch {
        clearTokens();
        if (alive) setCurrentUser(null);
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Déconnexion forcée si le client API signale une session expirée.
  useEffect(() => {
    const onExpired = () => { setCurrentUser(null); };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  // Connexion : Keycloak en mode réel, vérification locale en mode démo.
  const login = async (email, password) => {
    if (USE_MOCK) {
      const u = authenticate(email, password);
      if (!u) return { ok: false };
      setCurrentUser(u); saveSession(u);
      return { ok: true, user: u };
    }
    try {
      await loginWithPassword(email, password);
      const me = await getMe();
      const user = buildUserFromApi(me);
      setCurrentUser(user);
      return { ok: true, user };
    } catch {
      clearTokens();
      return { ok: false };
    }
  };

  const logout = () => {
    if (USE_MOCK) saveSession(null);
    else kcLogout();
    setCurrentUser(null);
  };

  // Gestion locale des comptes (espace admin, mode démo).
  const addUser = async (data) => { 
    if (USE_MOCK) {
      const u = makeUser(data); const next = [...users, u]; setUsers(next); saveUsers(next); return u; 
    } else {
      const [prenom, ...nomParts] = data.name.trim().split(" ");
      const nom = nomParts.join(" ") || " ";
      const payload = {
        prenom: prenom || " ",
        nom: nom,
        email: data.email,
        password: data.password,
        role: data.role,
        status: data.status,
        department_id: data.dept
      };
      await createEmployee(payload);
      
      // Mettre à jour l'état local pour rafraîchir l'interface (en attendant la route GET /users unifiée)
      const u = makeUser(data); const next = [...users, u]; setUsers(next); saveUsers(next); return u;
    }
  };
  const deleteUser = (id) => {
    const next = users.filter((u) => u.id !== id); setUsers(next); saveUsers(next);
    if (currentUser && currentUser.id === id) logout();
  };
  const updateUser = (id, patch) => {
    const next = users.map((u) => (u.id === id ? { ...u, ...patch } : u)); setUsers(next); saveUsers(next);
    if (currentUser && currentUser.id === id) setCurrentUser({ ...currentUser, ...patch });
  };

  const loggedIn = !!currentUser;
  const role = currentUser ? currentUser.role : null;
  const status = currentUser ? currentUser.status : null;

  return (
    <SessionContext.Provider
      value={{ loggedIn, currentUser, role, status, users, booting, useMock: USE_MOCK,
               login, logout, addUser, deleteUser, updateUser }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() { return useContext(SessionContext); }
