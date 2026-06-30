import { Navigate } from "react-router-dom";
import { useSession } from "../providers/SessionProvider";

export default function ProtectedRoute({ children }) {
  const { loggedIn } = useSession();
  if (!loggedIn) return <Navigate to="/login" replace />;
  return children;
}
