import { ROLES, RH_SPACE_ROLES, STATUS } from "./constants";

// Navigation EN SECTIONS pour la sidebar (simplicité + lisibilité).
// Chaque section : { id, label (clé i18n, absente si featured), icon, collapsible, featured, items[] }
// Chaque item    : { key (clé i18n), to, icon (nom lucide) }
const F = (items) => items.filter(Boolean);

export function navForRole(role, status) {
  // ───────────── ADMIN ─────────────
  if (role === ROLES.ADMIN) {
    return [
      { id: "admin", label: "nav.cat.admin", icon: "ShieldCheck", collapsible: true, items: [
        { key: "nav.supervision", to: "/admin", icon: "LayoutDashboard" },
        { key: "nav.users", to: "/admin/utilisateurs", icon: "Users" },
        { key: "nav.supervisionIa", to: "/admin/supervision-ia", icon: "Bot" },
        { key: "nav.alerts", to: "/admin/alertes", icon: "Bell" },
        { key: "nav.audit", to: "/admin/audit", icon: "ScrollText" },
        { key: "nav.config", to: "/admin/configuration", icon: "Settings" },
      ] },
      { id: "communication", label: "nav.cat.communication", icon: "Megaphone", collapsible: true, items: [
        { key: "nav.newsPublish", to: "/rh/actualites", icon: "Megaphone" },
      ] },
      { id: "monEspace", label: "nav.cat.monEspace", icon: "User", collapsible: true, items: [
        { key: "nav.news", to: "/app/actualites", icon: "Newspaper" },
        { key: "nav.help", to: "/app/aide", icon: "LifeBuoy" },
        { key: "nav.privacy", to: "/app/confidentialite", icon: "ShieldCheck" },
        { key: "nav.profile", to: "/app/profil", icon: "User" },
      ] },
    ];
  }

  // ───────────── ESPACE RH / MANAGER / DIRECTION / MÉDECINE ─────────────
  if (RH_SPACE_ROLES.includes(role)) {
    // Médecine du travail : périmètre bien-être uniquement (pas de Vision 360, ni finances).
    if (role === ROLES.MEDECINE) {
      return [
        { id: "cockpit", featured: true, items: [{ key: "nav.dashboard", to: "/rh", icon: "LayoutDashboard" }] },
        { id: "processusRh", label: "nav.cat.processusRh", icon: "Workflow", collapsible: true, items: [
          { key: "nav.happiness", to: "/rh/processus/happiness", icon: "HeartPulse" },
        ] },
        { id: "monEspace", label: "nav.cat.monEspace", icon: "User", collapsible: true, items: [
          { key: "nav.news", to: "/app/actualites", icon: "Newspaper" },
          { key: "nav.myRequests", to: "/app/demandes", icon: "CalendarPlus" },
          { key: "nav.help", to: "/app/aide", icon: "LifeBuoy" },
          { key: "nav.privacy", to: "/app/confidentialite", icon: "ShieldCheck" },
          { key: "nav.profile", to: "/app/profil", icon: "User" },
        ] },
      ];
    }
    const isExec = role === ROLES.RH || role === ROLES.DIRECTION;
    return [
      // 2 blocs fédérateurs mis en avant
      { id: "cockpit", featured: true, items: [{ key: "nav.dashboard", to: "/rh", icon: "LayoutDashboard" }] },
      { id: "vision", featured: true, items: [{ key: "nav.vision360", to: "/rh/vision", icon: "ScanFace" }] },

      // Processus RH : écrans consolidés à onglets
      { id: "processusRh", label: "nav.cat.processusRh", icon: "Workflow", collapsible: true, items: [
        { key: "nav.lifecycle", to: "/rh/processus/lifecycle", icon: "Route" },
        { key: "nav.careers", to: "/rh/processus/carrieres", icon: "Award" },
        { key: "nav.happiness", to: "/rh/processus/happiness", icon: "HeartPulse" },
        { key: "nav.reqReview", to: "/rh/demandes", icon: "Inbox" },
      ] },

      { id: "analytique", label: "nav.cat.analytique", icon: "TrendingUp", collapsible: true, items: [
        { key: "nav.analytics", to: "/rh/analytique/predictif", icon: "TrendingUp" },
        { key: "nav.reports", to: "/rh/rapports", icon: "FileBarChart" },
      ] },

      { id: "organisation", label: "nav.cat.organisation", icon: "Users", collapsible: true, items: F([
        { key: "nav.team", to: "/rh/equipe", icon: "Users" },
        isExec && { key: "nav.employees", to: "/rh/collaborateurs", icon: "IdCard" },
        isExec && { key: "nav.docsReview", to: "/rh/documents", icon: "FileCheck" },
      ]) },

      { id: "communication", label: "nav.cat.communication", icon: "Megaphone", collapsible: true, items: F([
        { key: "nav.assistantRh", to: "/rh/assistant", icon: "Bot" },
        { key: "nav.alerts", to: "/rh/alertes", icon: "Bell" },
        { key: "nav.tickets", to: "/rh/tickets", icon: "Ticket" },
        isExec && { key: "nav.newsPublish", to: "/rh/actualites", icon: "Megaphone" },
      ]) },

      { id: "monEspace", label: "nav.cat.monEspace", icon: "User", collapsible: true, items: [
        { key: "nav.news", to: "/app/actualites", icon: "Newspaper" },
        { key: "nav.myRequests", to: "/app/demandes", icon: "CalendarPlus" },
        { key: "nav.help", to: "/app/aide", icon: "LifeBuoy" },
        { key: "nav.privacy", to: "/app/confidentialite", icon: "ShieldCheck" },
        { key: "nav.profile", to: "/app/profil", icon: "User" },
      ] },
    ];
  }

  // ───────────── ESPACE COLLABORATEUR ─────────────
  return [
    { id: "home", featured: true, items: [{ key: "nav.home", to: "/app", icon: "Home" }] },
    { id: "monActivite", label: "nav.cat.monActivite", icon: "LayoutGrid", collapsible: true, items: F([
      { key: "nav.assistant", to: "/app/assistant", icon: "MessageSquare" },
      { key: "nav.documents", to: "/app/documents", icon: "FileText" },
      status === STATUS.NEW && { key: "nav.onboarding", to: "/app/onboarding", icon: "Rocket" },
      status === STATUS.LEAVING && { key: "nav.offboarding", to: "/app/offboarding", icon: "LogOut" },
      { key: "nav.myObjectives", to: "/app/objectifs", icon: "Target" },
      { key: "nav.mySkills", to: "/app/competences", icon: "Award" },
      { key: "nav.myMood", to: "/app/humeur", icon: "Smile" },
      { key: "nav.myTickets", to: "/app/tickets", icon: "Ticket" },
      { key: "nav.requests", to: "/app/demandes", icon: "Inbox" },
    ]) },
    { id: "monEspace", label: "nav.cat.monEspace", icon: "User", collapsible: true, items: [
      { key: "nav.news", to: "/app/actualites", icon: "Newspaper" },
      { key: "nav.help", to: "/app/aide", icon: "LifeBuoy" },
      { key: "nav.privacy", to: "/app/confidentialite", icon: "ShieldCheck" },
      { key: "nav.profile", to: "/app/profil", icon: "User" },
    ] },
  ];
}
