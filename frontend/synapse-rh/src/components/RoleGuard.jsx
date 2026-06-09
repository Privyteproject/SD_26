/**
 * RoleGuard — Synapse Digital
 * Affichage conditionnel d'un bloc JSX selon le rôle de l'utilisateur.
 *
 * Usage :
 *   <RoleGuard roles={["rh","admin"]}>
 *     <button>Accès RH seulement</button>
 *   </RoleGuard>
 *
 *   <RoleGuard roles={["admin"]} fallback={<span>Non autorisé</span>}>
 *     <DangerZone />
 *   </RoleGuard>
 */

import { useAuth, hasRole } from "../auth/AuthContext";

export default function RoleGuard({ roles = [], children, fallback = null }) {
  const { role } = useAuth();
  const allowed = roles.some(r => hasRole(role, r));
  return allowed ? children : fallback;
}
