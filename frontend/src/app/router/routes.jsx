import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import RoleGuard from "./RoleGuard";
import AuthLayout from "../../layouts/AuthLayout";
import AppLayout from "../../layouts/AppLayout";
import { RH_SPACE_ROLES, RH_MGMT_ROLES, RH_OPS_ROLES, ROLES } from "../../lib/constants";

import Login from "../../features/auth/pages/Login";

// Espace collaborateur
import DashboardPerso from "../../features/dashboard/pages/DashboardPerso";
import Assistant from "../../features/assistant/pages/Assistant";
import Documents from "../../features/documents/pages/Documents";
import MyPayroll from "../../features/payroll/pages/MyPayroll";
import Onboarding from "../../features/onboarding/pages/Onboarding";
import OffboardingPerso from "../../features/offboarding/pages/OffboardingPerso";
import Requests from "../../features/misc/pages/Requests";
import Profile from "../../features/misc/pages/Profile";
import MySkills from "../../features/skills/pages/MySkills";
import SkillsRh from "../../features/skills/pages/SkillsRh";
import MyObjectives from "../../features/okr/pages/MyObjectives";
import ObjectivesRh from "../../features/okr/pages/ObjectivesRh";
import MyMood from "../../features/mood/pages/MyMood";
import Climate from "../../features/mood/pages/Climate";
import Tickets from "../../features/tickets/pages/Tickets";
import News from "../../features/news/pages/News";
import NewsRh from "../../features/news/pages/NewsRh";
import Privacy from "../../features/privacy/pages/Privacy";
import Help from "../../features/help/pages/Help";

// Espace RH / Manager / Direction
import DashboardRh from "../../features/dashboard/pages/DashboardRh";
import Vision360 from "../../features/vision/pages/Vision360";
import ProcessScreen from "../../features/processus/pages/ProcessScreen";
import AssistantRh from "../../features/assistant/pages/AssistantRh";
import Team from "../../features/misc/pages/Team";
import PredictiveAnalytics from "../../features/analytics/pages/PredictiveAnalytics";
import Payroll from "../../features/analytics/pages/Payroll";
import Pilotage from "../../features/pilotage/pages/Pilotage";
import Disengagement from "../../features/disengagement/pages/Disengagement";
import OnboardingRh from "../../features/onboarding/pages/OnboardingRh";
import Offboarding from "../../features/offboarding/pages/Offboarding";
import Employees from "../../features/misc/pages/Employees";
import Reports from "../../features/misc/pages/Reports";
import RequestsReview from "../../features/requests/pages/RequestsReview";
import DocumentsRh from "../../features/documents/pages/DocumentsRh";

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
        <Route path="/app/paie" element={<MyPayroll />} />
        <Route path="/app/onboarding" element={<Onboarding />} />
        <Route path="/app/offboarding" element={<OffboardingPerso />} />
        <Route path="/app/demandes" element={<Requests />} />
        <Route path="/app/competences" element={<MySkills />} />
        <Route path="/app/objectifs" element={<MyObjectives />} />
        <Route path="/app/humeur" element={<MyMood />} />
        <Route path="/app/tickets" element={<Tickets />} />
        <Route path="/app/actualites" element={<News />} />
        <Route path="/app/confidentialite" element={<Privacy />} />
        <Route path="/app/aide" element={<Help />} />
        <Route path="/app/profil" element={<Profile />} />

        {/* Espace RH / Manager / Direction / Médecine */}
        <Route path="/rh" element={<RoleGuard roles={RH_SPACE_ROLES}><DashboardRh /></RoleGuard>} />
        <Route path="/rh/vision" element={<RoleGuard roles={[ROLES.MANAGER, ROLES.RH, ROLES.DIRECTION]}><Vision360 /></RoleGuard>} />
        <Route path="/rh/processus/lifecycle" element={<RoleGuard roles={RH_MGMT_ROLES}><ProcessScreen pkey="lifecycle" titleKey="nav.lifecycle" icon="Route" /></RoleGuard>} />
        <Route path="/rh/processus/carrieres" element={<RoleGuard roles={RH_MGMT_ROLES}><ProcessScreen pkey="carrieres" titleKey="nav.careers" icon="Award" /></RoleGuard>} />
        {/* Happiness : seul écran Processus RH accessible à la médecine du travail (bien-être) */}
        <Route path="/rh/processus/happiness" element={<RoleGuard roles={RH_SPACE_ROLES}><ProcessScreen pkey="happiness" titleKey="nav.happiness" icon="HeartPulse" /></RoleGuard>} />
        {/* « Mon équipe » = vue scopée manager ; RH/Direction passent par /rh/collaborateurs */}
        <Route path="/rh/equipe" element={<RoleGuard roles={[ROLES.MANAGER]}><Team /></RoleGuard>} />
        <Route path="/rh/assistant" element={<RoleGuard roles={[...RH_SPACE_ROLES, ROLES.ADMIN]}><AssistantRh /></RoleGuard>} />
        <Route path="/rh/alertes" element={<RoleGuard roles={RH_MGMT_ROLES}><Alerts /></RoleGuard>} />
        <Route path="/rh/analytique/predictif" element={<RoleGuard roles={RH_MGMT_ROLES}><PredictiveAnalytics /></RoleGuard>} />
        <Route path="/rh/analytique/masse-salariale" element={<RoleGuard roles={[ROLES.RH, ROLES.DIRECTION]}><Payroll /></RoleGuard>} />
        {/* Pilotage & gouvernance (décisionnel) : comparatif inter-départements + équité ML (§4.1) */}
        <Route path="/rh/pilotage" element={<RoleGuard roles={[ROLES.RH, ROLES.DIRECTION]}><Pilotage /></RoleGuard>} />
        {/* Désengagement = accompagnement individuel (worklist + plans) -> opérationnel manager/RH.
            La Direction a la vue ANALYTIQUE agrégée via /rh/analytique/predictif. */}
        <Route path="/rh/desengagement" element={<RoleGuard roles={RH_OPS_ROLES}><Disengagement /></RoleGuard>} />
        <Route path="/rh/competences" element={<RoleGuard roles={RH_OPS_ROLES}><SkillsRh /></RoleGuard>} />
        <Route path="/rh/objectifs" element={<RoleGuard roles={RH_OPS_ROLES}><ObjectivesRh /></RoleGuard>} />
        <Route path="/rh/climat" element={<RoleGuard roles={[ROLES.RH, ROLES.DIRECTION]}><Climate /></RoleGuard>} />
        <Route path="/rh/tickets" element={<RoleGuard roles={RH_OPS_ROLES}><Tickets /></RoleGuard>} />
        {/* Publication d'actualités = communication RH (RH/Direction). L'admin = technique/sécurité. */}
        <Route path="/rh/actualites" element={<RoleGuard roles={[ROLES.RH, ROLES.DIRECTION]}><NewsRh /></RoleGuard>} />
        <Route path="/rh/onboarding" element={<RoleGuard roles={RH_OPS_ROLES}><OnboardingRh /></RoleGuard>} />
        <Route path="/rh/offboarding" element={<RoleGuard roles={RH_OPS_ROLES}><Offboarding /></RoleGuard>} />
        {/* Annuaire org : Direction en LECTURE (pilotage) ; CRUD réservé RH côté backend */}
        <Route path="/rh/collaborateurs" element={<RoleGuard roles={[ROLES.RH, ROLES.DIRECTION]}><Employees /></RoleGuard>} />
        {/* Reporting org consolidé : RH/Direction (décisionnel) — hors périmètre manager */}
        <Route path="/rh/rapports" element={<RoleGuard roles={[ROLES.RH, ROLES.DIRECTION]}><Reports /></RoleGuard>} />
        <Route path="/rh/demandes" element={<RoleGuard roles={RH_OPS_ROLES}><RequestsReview /></RoleGuard>} />
        {/* Validation documentaire = acte opérationnel RH (hors périmètre décisionnel Direction) */}
        <Route path="/rh/documents" element={<RoleGuard roles={[ROLES.RH]}><DocumentsRh /></RoleGuard>} />

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
