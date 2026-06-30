import { ROLES, RH_SPACE_ROLES, STATUS } from "./constants";

// Navigation EN SECTIONS pour la sidebar (simplicité + lisibilité).
// Chaque section : { id, label (clé i18n, absente si featured), icon, collapsible, featured, items[] }
// Chaque item    : { key (clé i18n), to, icon (nom lucide) }
const F = (items) => items.filter(Boolean);

export function navForRole(role, status) {
  // ───────────── ADMIN ─────────────
  if (role === ROLES.ADMIN) {
    return [
      { id: "assistant", featured: true, items: [{ key: "nav.assistantRh", to: "/rh/assistant", icon: "Bot" }] },
      { id: "admin", label: "nav.cat.admin", icon: "ShieldCheck", collapsible: true, items: [
        { key: "nav.supervision", to: "/admin", icon: "LayoutDashboard" },
        { key: "nav.users", to: "/admin/utilisateurs", icon: "Users" },
        { key: "nav.supervisionIa", to: "/admin/supervision-ia", icon: "Bot" },
        { key: "nav.alerts", to: "/admin/alertes", icon: "Bell" },
        { key: "nav.audit", to: "/admin/audit", icon: "ScrollText" },
        { key: "nav.config", to: "/admin/configuration", icon: "Settings" },
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
        { id: "assistant", featured: true, items: [{ key: "nav.assistantRh", to: "/rh/assistant", icon: "Bot" }] },
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
    const isManager = role === ROLES.MANAGER;
    const isExec = role === ROLES.RH || role === ROLES.DIRECTION;   // décisionnel / pilotage
    const isRH = role === ROLES.RH;                                  // opérationnel RH complet
    const isOps = isManager || isRH;                                 // agit sur des individus (PAS la Direction)
    return [
      // 2 blocs fédérateurs mis en avant
      { id: "cockpit", featured: true, items: [{ key: "nav.dashboard", to: "/rh", icon: "LayoutDashboard" }] },
      { id: "vision", featured: true, items: [{ key: "nav.vision360", to: "/rh/vision", icon: "ScanFace" }] },

      // Processus RH : pilotage (lifecycle/carrières/happiness = tous) ; gestion = opérationnel (manager/RH).
      { id: "processusRh", label: "nav.cat.processusRh", icon: "Workflow", collapsible: true, items: F([
        { key: "nav.lifecycle", to: "/rh/processus/lifecycle", icon: "Route" },
        isOps && { key: "nav.onboarding", to: "/rh/onboarding", icon: "Rocket" },
        isOps && { key: "nav.offboarding", to: "/rh/offboarding", icon: "LogOut" },
        { key: "nav.careers", to: "/rh/processus/carrieres", icon: "Award" },
        isOps && { key: "nav.skills", to: "/rh/competences", icon: "BadgeCheck" },
        isOps && { key: "nav.objectives", to: "/rh/objectifs", icon: "Target" },
        { key: "nav.happiness", to: "/rh/processus/happiness", icon: "HeartPulse" },
        isOps && { key: "nav.reqReview", to: "/rh/demandes", icon: "Inbox" },
      ]) },

      { id: "analytique", label: "nav.cat.analytique", icon: "TrendingUp", collapsible: true, items: F([
        // Pilotage & gouvernance (comparatif inter-départements + équité ML) = décisionnel RH/Direction.
        isExec && { key: "nav.pilotage", to: "/rh/pilotage", icon: "Scale" },
        { key: "nav.analytics", to: "/rh/analytique/predictif", icon: "TrendingUp" },
        // Désengagement = accompagnement individuel -> manager/RH ; la Direction a l'analytique agrégée.
        isOps && { key: "nav.disengagement", to: "/rh/desengagement", icon: "TrendingDown" },
        // Climat dédié = RH/Direction ; le manager consulte le climat de son équipe via Happiness.
        isExec && { key: "nav.climate", to: "/rh/climat", icon: "Smile" },
        isExec && { key: "nav.payroll", to: "/rh/analytique/masse-salariale", icon: "Wallet" },
        // Reporting org consolidé = décisionnel RH/Direction (hors périmètre manager).
        isExec && { key: "nav.reports", to: "/rh/rapports", icon: "FileBarChart" },
      ]) },

      { id: "organisation", label: "nav.cat.organisation", icon: "Users", collapsible: true, items: F([
        // « Mon équipe » = vue scopée du MANAGER ; RH/Direction utilisent l'annuaire « Collaborateurs ».
        isManager && { key: "nav.team", to: "/rh/equipe", icon: "Users" },
        isExec && { key: "nav.employees", to: "/rh/collaborateurs", icon: "IdCard" },
        // Validation documentaire = opérationnel RH (pas la Direction).
        isRH && { key: "nav.docsReview", to: "/rh/documents", icon: "FileCheck" },
      ]) },

      { id: "communication", label: "nav.cat.communication", icon: "Megaphone", collapsible: true, items: F([
        { key: "nav.assistantRh", to: "/rh/assistant", icon: "Bot" },
        { key: "nav.alerts", to: "/rh/alertes", icon: "Bell" },
        isOps && { key: "nav.tickets", to: "/rh/tickets", icon: "Ticket" },
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
      { key: "nav.payslip", to: "/app/paie", icon: "Wallet" },
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
