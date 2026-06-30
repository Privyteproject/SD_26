import { createContext, useContext, useState } from "react";
import { ROLES, STATUS } from "../../lib/constants";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState(ROLES.COLLABORATEUR);
  const [status, setStatus] = useState(STATUS.ACTIVE);

  // Connexion simulée (aucune authentification réelle)
  const login = (asRole = ROLES.COLLABORATEUR) => {
    setRole(asRole);
    setLoggedIn(true);
  };
  const logout = () => setLoggedIn(false);

  return (
    <SessionContext.Provider
      value={{ loggedIn, role, status, setRole, setStatus, login, logout }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
