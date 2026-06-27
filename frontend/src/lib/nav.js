import { ROLES, RH_SPACE_ROLES, STATUS } from "./constants";

// Renvoie les sections de navigation de la sidebar selon le rôle et le statut.
// Chaque item : { key (clé i18n), to, icon (nom lucide) }
export function navForRole(role, status) {
  if (role === ROLES.ADMIN) {
    return [
      { key: "nav.supervision", to: "/admin", icon: "ShieldCheck" },
      { key: "nav.users", to: "/admin/utilisateurs", icon: "Users" },
      { key: "nav.supervisionIa", to: "/admin/supervision-ia", icon: "Bot" },
      { key: "nav.alerts", to: "/admin/alertes", icon: "Bell" },
      { key: "nav.audit", to: "/admin/audit", icon: "ScrollText" },
      { key: "nav.config", to: "/admin/configuration", icon: "Settings" },
      { key: "nav.newsPublish", to: "/rh/actualites", icon: "Megaphone" },
      { key: "nav.news", to: "/app/actualites", icon: "Newspaper" },
      { key: "nav.profile", to: "/app/profil", icon: "User" },
    ];
  }
  if (RH_SPACE_ROLES.includes(role)) {
    const items = [
      { key: "nav.dashboard", to: "/rh", icon: "LayoutDashboard" },
      { key: "nav.assistantRh", to: "/rh/assistant", icon: "Bot" },
      { key: "nav.team", to: "/rh/equipe", icon: "Users" },
      { key: "nav.alerts", to: "/rh/alertes", icon: "Bell" },
      { key: "nav.tickets", to: "/rh/tickets", icon: "Ticket" },
      { key: "nav.analytics", to: "/rh/analytique/predictif", icon: "TrendingUp" },
      { key: "nav.disengagement", to: "/rh/desengagement", icon: "Activity" },
      { key: "nav.climate", to: "/rh/climat", icon: "Smile" },
      { key: "nav.skills", to: "/rh/competences", icon: "Award" },
      { key: "nav.objectives", to: "/rh/objectifs", icon: "Target" },
      { key: "nav.onboarding", to: "/rh/onboarding", icon: "UserPlus" },
      { key: "nav.offboarding", to: "/rh/offboarding", icon: "UserMinus" },
      { key: "nav.reports", to: "/rh/rapports", icon: "FileBarChart" },
      { key: "nav.reqReview", to: "/rh/demandes", icon: "Inbox" },
      { key: "nav.news", to: "/app/actualites", icon: "Newspaper" },
      { key: "nav.myRequests", to: "/app/demandes", icon: "CalendarPlus" },
      { key: "nav.profile", to: "/app/profil", icon: "User" },
    ];
    if (role !== ROLES.MANAGER) {
      items.splice(7, 0, { key: "nav.employees", to: "/rh/collaborateurs", icon: "IdCard" });
    }
    // Validation des documents + publication d'annonces : RH et Direction uniquement.
    if (role === ROLES.RH || role === ROLES.DIRECTION) {
      items.push({ key: "nav.docsReview", to: "/rh/documents", icon: "FileCheck" });
      items.push({ key: "nav.newsPublish", to: "/rh/actualites", icon: "Megaphone" });
    }
    // Médecine du travail : vue restreinte (bien-être / signaux uniquement)
    if (role === ROLES.MEDECINE) {
      return [
        { key: "nav.dashboard", to: "/rh", icon: "LayoutDashboard" },
        { key: "nav.disengagement", to: "/rh/desengagement", icon: "Activity" },
        { key: "nav.climate", to: "/rh/climat", icon: "Smile" },
        { key: "nav.news", to: "/app/actualites", icon: "Newspaper" },
        { key: "nav.myRequests", to: "/app/demandes", icon: "CalendarPlus" },
        { key: "nav.profile", to: "/app/profil", icon: "User" },
      ];
    }
    return items;
  }
  // Espace collaborateur
  const items = [
    { key: "nav.home", to: "/app", icon: "Home" },
    { key: "nav.assistant", to: "/app/assistant", icon: "MessageSquare" },
    { key: "nav.documents", to: "/app/documents", icon: "FileText" },
  ];
  if (status === STATUS.NEW) {
    items.push({ key: "nav.onboarding", to: "/app/onboarding", icon: "Rocket" });
  }
  if (status === STATUS.LEAVING) {
    items.push({ key: "nav.offboarding", to: "/app/offboarding", icon: "LogOut" });
  }
  items.push({ key: "nav.myTickets", to: "/app/tickets", icon: "Ticket" });
  items.push({ key: "nav.myMood", to: "/app/humeur", icon: "Smile" });
  items.push({ key: "nav.myObjectives", to: "/app/objectifs", icon: "Target" });
  items.push({ key: "nav.mySkills", to: "/app/competences", icon: "Award" });
  items.push({ key: "nav.requests", to: "/app/demandes", icon: "Inbox" });
  items.push({ key: "nav.news", to: "/app/actualites", icon: "Newspaper" });
  items.push({ key: "nav.profile", to: "/app/profil", icon: "User" });
  return items;
}
