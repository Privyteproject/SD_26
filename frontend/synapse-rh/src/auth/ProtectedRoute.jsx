/**
 * ProtectedRoute — Synapse Digital
 * Vérifie :
 *  1. Token JWT présent et non expiré
 *  2. Rôle utilisateur suffisant (RBAC)
 * Redirige vers /login ou /403 sinon.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth, hasRole, TokenStore } from "./AuthContext";

function isTokenExpired(token) {
  if (!token) return true;
  const payload = TokenStore.decodePayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
}

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  // 1. Pas connecté ou token expiré → /login
  if (!isAuthenticated || isTokenExpired(TokenStore.access)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Rôle insuffisant → /403
  if (requiredRole && !hasRole(role, requiredRole)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
