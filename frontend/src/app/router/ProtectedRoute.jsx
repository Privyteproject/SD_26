import { Navigate } from "react-router-dom";
import { useSession } from "../providers/SessionProvider";

export default function ProtectedRoute({ children }) {
  const { loggedIn, booting } = useSession();
  if (booting) return null; // évite une redirection avant la restauration de session
  if (!loggedIn) return <Navigate to="/login" replace />;
  return children;
}
