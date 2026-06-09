import { useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ROLES } from "./auth/AuthContext";
import { GlobalLoaderProvider, useLoader } from "./components/GlobalLoader";

import Authentification      from "./pages/Authentification";
import ForgotPassword        from "./pages/ForgotPassword";
import ResetPassword         from "./pages/ResetPassword";
import DashboardCollaborateur from "./pages/DashboardCollaborateur";
import DashboardRH           from "./pages/DashboardRH";
import DashboardAdmin        from "./pages/DashboardAdmin";
import AssistantIA           from "./pages/AssistantIA";
import GenerationDocuments   from "./pages/GenerationDocuments";
import Onboarding            from "./pages/Onboarding";
import Offboarding           from "./pages/Offboarding";
import ProfilUtilisateur     from "./pages/ProfilUtilisateur";
import ErrorPages            from "./pages/ErrorPages";

// Composant interne pour déclencher le loader sur chaque navigation
function NavigationLoader() {
  const location = useLocation();
  const { show, hide } = useLoader();

  useEffect(() => {
    show();
    const t = setTimeout(hide, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}

export default function App() {
  const [dark, setDark] = useState(false);
  const shared = { dark, setDark };

  return (
    <GlobalLoaderProvider>
      <AuthProvider>
        <BrowserRouter>
          <NavigationLoader />
          <Routes>
            {/* ── Public ─────────────────────────────────────────────────── */}
            <Route path="/"                element={<Authentification {...shared} />} />
            <Route path="/login"           element={<Authentification {...shared} />} />
            <Route path="/forgot-password" element={<ForgotPassword   {...shared} />} />
            <Route path="/reset-password"  element={<ResetPassword    {...shared} />} />

            {/* ── Collaborateur ───────────────────────────────────────────── */}
            <Route path="/dashboard" element={
              <ProtectedRoute requiredRole={ROLES.COLLABORATEUR}>
                <DashboardCollaborateur {...shared} />
              </ProtectedRoute>
            } />
            <Route path="/assistant" element={
              <ProtectedRoute requiredRole={ROLES.COLLABORATEUR}>
                <AssistantIA {...shared} />
              </ProtectedRoute>
            } />
            <Route path="/documents" element={
              <ProtectedRoute requiredRole={ROLES.COLLABORATEUR}>
                <GenerationDocuments {...shared} />
              </ProtectedRoute>
            } />
            <Route path="/onboarding" element={
              <ProtectedRoute requiredRole={ROLES.COLLABORATEUR}>
                <Onboarding {...shared} />
              </ProtectedRoute>
            } />
            <Route path="/profil" element={
              <ProtectedRoute requiredRole={ROLES.COLLABORATEUR}>
                <ProfilUtilisateur {...shared} />
              </ProtectedRoute>
            } />

            {/* ── RH / Manager ────────────────────────────────────────────── */}
            <Route path="/rh/dashboard" element={
              <ProtectedRoute requiredRole={ROLES.MANAGER}>
                <DashboardRH {...shared} />
              </ProtectedRoute>
            } />
            <Route path="/offboarding" element={
              <ProtectedRoute requiredRole={ROLES.MANAGER}>
                <Offboarding {...shared} />
              </ProtectedRoute>
            } />
            <Route path="/offboarding/:id" element={
              <ProtectedRoute requiredRole={ROLES.MANAGER}>
                <Offboarding {...shared} />
              </ProtectedRoute>
            } />

            {/* ── Admin ───────────────────────────────────────────────────── */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole={ROLES.ADMIN}>
                <DashboardAdmin {...shared} />
              </ProtectedRoute>
            } />

            {/* ── Erreurs ─────────────────────────────────────────────────── */}
            <Route path="/403" element={<ErrorPages type="403" />} />
            <Route path="*"    element={<ErrorPages type="404" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GlobalLoaderProvider>
  );
}
