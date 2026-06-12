import { Navigate } from "react-router-dom";
import { useSession } from "../providers/SessionProvider";
import { homeForRole } from "../../lib/rbac";

// roles: tableau de rôles autorisés. Sinon, redirige vers l'accueil du rôle courant.
export default function RoleGuard({ roles, children }) {
  const { role } = useSession();
  if (!roles.includes(role)) return <Navigate to={homeForRole(role)} replace />;
  return children;
}
