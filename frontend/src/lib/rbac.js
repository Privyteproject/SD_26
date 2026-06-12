import { ROLES, RH_SPACE_ROLES } from "./constants";

// Route d'accueil par défaut selon le rôle
export function homeForRole(role) {
  if (role === ROLES.ADMIN) return "/admin";
  if (RH_SPACE_ROLES.includes(role)) return "/rh";
  return "/app";
}

// L'utilisateur a-t-il accès à un espace ?
export function canAccessSpace(role, space) {
  if (space === "app") return true; // tout le monde a un espace personnel
  if (space === "rh") return RH_SPACE_ROLES.includes(role);
  if (space === "admin") return role === ROLES.ADMIN;
  return false;
}

// Permission générique (UX uniquement — la vraie sécurité est côté back)
export function can(role, action) {
  const matrix = {
    "users.manage": [ROLES.ADMIN],
    "supervision.view": [ROLES.ADMIN],
    "payroll.view": [ROLES.RH, ROLES.DIRECTION],
    "team.act": [ROLES.MANAGER, ROLES.RH],
    "wellbeing.view": [ROLES.MEDECINE, ROLES.RH, ROLES.DIRECTION],
  };
  return (matrix[action] || []).includes(role);
}
