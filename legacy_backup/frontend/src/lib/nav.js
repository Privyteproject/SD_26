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
      { key: "nav.data", to: "/admin/donnees", icon: "Database" },
      { key: "nav.config", to: "/admin/configuration", icon: "Settings" },
    ];
  }
  if (RH_SPACE_ROLES.includes(role)) {
    const items = [
      { key: "nav.dashboard", to: "/rh", icon: "LayoutDashboard" },
      { key: "nav.team", to: "/rh/equipe", icon: "Users" },
      { key: "nav.analytics", to: "/rh/analytique/turnover", icon: "TrendingUp" },
      { key: "nav.disengagement", to: "/rh/desengagement", icon: "Activity" },
      { key: "nav.onboarding", to: "/rh/onboarding", icon: "UserPlus" },
      { key: "nav.offboarding", to: "/rh/offboarding", icon: "UserMinus" },
      { key: "nav.employees", to: "/rh/collaborateurs", icon: "IdCard" },
      { key: "nav.reports", to: "/rh/rapports", icon: "FileBarChart" },
    ];
    // Médecine du travail : vue restreinte (bien-être / signaux uniquement)
    if (role === ROLES.MEDECINE) {
      return [
        { key: "nav.dashboard", to: "/rh", icon: "LayoutDashboard" },
        { key: "nav.disengagement", to: "/rh/desengagement", icon: "Activity" },
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
  items.push({ key: "nav.requests", to: "/app/demandes", icon: "Inbox" });
  items.push({ key: "nav.profile", to: "/app/profil", icon: "User" });
  return items;
}
