import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import RoleGuard from "./RoleGuard";
import AuthLayout from "../../layouts/AuthLayout";
import AppLayout from "../../layouts/AppLayout";
import { RH_SPACE_ROLES, ROLES } from "../../lib/constants";

import Login from "../../features/auth/pages/Login";

// Espace collaborateur
import DashboardPerso from "../../features/dashboard/pages/DashboardPerso";
import Assistant from "../../features/assistant/pages/Assistant";
import Documents from "../../features/documents/pages/Documents";
import Onboarding from "../../features/onboarding/pages/Onboarding";
import Requests from "../../features/misc/pages/Requests";
import Profile from "../../features/misc/pages/Profile";

// Espace RH / Manager / Direction
import DashboardRh from "../../features/dashboard/pages/DashboardRh";
import Team from "../../features/misc/pages/Team";
import Turnover from "../../features/analytics/pages/Turnover";
import Payroll from "../../features/analytics/pages/Payroll";
import Absenteeism from "../../features/analytics/pages/Absenteeism";
import Disengagement from "../../features/disengagement/pages/Disengagement";
import OnboardingRh from "../../features/onboarding/pages/OnboardingRh";
import Offboarding from "../../features/offboarding/pages/Offboarding";
import Employees from "../../features/misc/pages/Employees";
import Reports from "../../features/misc/pages/Reports";
import RequestsReview from "../../features/requests/pages/RequestsReview";

// Espace admin
import Supervision from "../../features/supervision/pages/Supervision";
import Users from "../../features/users/pages/Users";
import SupervisionIA from "../../features/supervision/pages/SupervisionIA";
import Alerts from "../../features/alerts/pages/Alerts";
import Audit from "../../features/misc/pages/Audit";
import Config from "../../features/misc/pages/Config";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Espace collaborateur — tout utilisateur connecté */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/app" element={<DashboardPerso />} />
        <Route path="/app/assistant" element={<Assistant />} />
        <Route path="/app/documents" element={<Documents />} />
        <Route path="/app/onboarding" element={<Onboarding />} />
        <Route path="/app/demandes" element={<Requests />} />
        <Route path="/app/profil" element={<Profile />} />

        {/* Espace RH / Manager / Direction / Médecine */}
        <Route path="/rh" element={<RoleGuard roles={RH_SPACE_ROLES}><DashboardRh /></RoleGuard>} />
        <Route path="/rh/equipe" element={<RoleGuard roles={RH_SPACE_ROLES}><Team /></RoleGuard>} />
        <Route path="/rh/analytique/turnover" element={<RoleGuard roles={RH_SPACE_ROLES}><Turnover /></RoleGuard>} />
        <Route path="/rh/analytique/masse-salariale" element={<RoleGuard roles={RH_SPACE_ROLES}><Payroll /></RoleGuard>} />
        <Route path="/rh/analytique/absenteisme" element={<RoleGuard roles={RH_SPACE_ROLES}><Absenteeism /></RoleGuard>} />
        <Route path="/rh/desengagement" element={<RoleGuard roles={RH_SPACE_ROLES}><Disengagement /></RoleGuard>} />
        <Route path="/rh/onboarding" element={<RoleGuard roles={RH_SPACE_ROLES}><OnboardingRh /></RoleGuard>} />
        <Route path="/rh/offboarding" element={<RoleGuard roles={RH_SPACE_ROLES}><Offboarding /></RoleGuard>} />
        <Route path="/rh/collaborateurs" element={<RoleGuard roles={RH_SPACE_ROLES}><Employees /></RoleGuard>} />
        <Route path="/rh/rapports" element={<RoleGuard roles={RH_SPACE_ROLES}><Reports /></RoleGuard>} />
        <Route path="/rh/demandes" element={<RoleGuard roles={[ROLES.MANAGER, ROLES.RH, ROLES.DIRECTION]}><RequestsReview /></RoleGuard>} />

        {/* Espace admin */}
        <Route path="/admin" element={<RoleGuard roles={[ROLES.ADMIN]}><Supervision /></RoleGuard>} />
        <Route path="/admin/utilisateurs" element={<RoleGuard roles={[ROLES.ADMIN]}><Users /></RoleGuard>} />
        <Route path="/admin/supervision-ia" element={<RoleGuard roles={[ROLES.ADMIN]}><SupervisionIA /></RoleGuard>} />
        <Route path="/admin/alertes" element={<RoleGuard roles={[ROLES.ADMIN]}><Alerts /></RoleGuard>} />
        <Route path="/admin/audit" element={<RoleGuard roles={[ROLES.ADMIN]}><Audit /></RoleGuard>} />
        <Route path="/admin/configuration" element={<RoleGuard roles={[ROLES.ADMIN]}><Config /></RoleGuard>} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
