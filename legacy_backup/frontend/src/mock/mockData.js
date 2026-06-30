// Données 100% fictives pour la maquette (aucune donnée réelle).
export const ENGAGEMENT_TREND = [
  { m: "Jan", v: 72 }, { m: "Fév", v: 70 }, { m: "Mar", v: 74 },
  { m: "Avr", v: 78 }, { m: "Mai", v: 80 }, { m: "Juin", v: 84 },
];

export const LEAVE = { remaining: 14, total: 25 };

export const PENDING_REQUESTS = [
  { id: 1, label: { fr: "Congé · 12–16 mai", en: "Leave · May 12–16" }, status: "pending" },
  { id: 2, label: { fr: "Attestation de travail", en: "Work certificate" }, status: "validated" },
];

export const ONBOARDING_TASKS = [
  { id: 1, done: true,  label: { fr: "Signer le contrat", en: "Sign contract" } },
  { id: 2, done: true,  label: { fr: "Configurer les accès", en: "Set up access" } },
  { id: 3, done: false, label: { fr: "Lire le règlement intérieur", en: "Read company policy" } },
  { id: 4, done: false, label: { fr: "Rencontrer son parrain", en: "Meet your buddy" } },
];

export const OFFBOARDING_TASKS = [
  { id: 1, done: true,  label: { fr: "Restituer le matériel", en: "Return equipment" } },
  { id: 2, done: false, label: { fr: "Synthèse de transfert", en: "Handover summary" } },
  { id: 3, done: false, label: { fr: "Entretien de départ", en: "Exit interview" } },
];

// --- Lot 2 : espace collaborateur ---
export const DOCUMENT_TYPES = [
  { id: "work", icon: "FileBadge", name: { fr: "Attestation de travail", en: "Work certificate" } },
  { id: "leave", icon: "CalendarDays", name: { fr: "Demande de congé", en: "Leave request" } },
  { id: "salary", icon: "Receipt", name: { fr: "Attestation de salaire", en: "Salary certificate" } },
  { id: "mission", icon: "Plane", name: { fr: "Ordre de mission", en: "Mission order" } },
];

export const DOCUMENT_HISTORY = [
  { id: 1, name: { fr: "Attestation de travail", en: "Work certificate" }, date: "2026-05-20", status: "validated" },
  { id: 2, name: { fr: "Demande de congé · mai", en: "Leave request · May" }, date: "2026-05-18", status: "pending" },
  { id: 3, name: { fr: "Attestation de salaire", en: "Salary certificate" }, date: "2026-04-30", status: "validated" },
];

export const ONBOARDING_WEEKS = [
  { week: 1, tasks: [
    { id: 1, done: true, label: { fr: "Signer le contrat", en: "Sign contract" } },
    { id: 2, done: true, label: { fr: "Configurer les accès et le matériel", en: "Set up access and equipment" } },
    { id: 3, done: true, label: { fr: "Visite des locaux", en: "Office tour" } },
  ]},
  { week: 2, tasks: [
    { id: 4, done: true, label: { fr: "Lire le règlement intérieur", en: "Read company policy" } },
    { id: 5, done: false, label: { fr: "Formation outils internes", en: "Internal tools training" } },
  ]},
  { week: 3, tasks: [
    { id: 6, done: false, label: { fr: "Rencontrer son parrain", en: "Meet your buddy" } },
    { id: 7, done: false, label: { fr: "Premier point avec le manager", en: "First check-in with manager" } },
  ]},
  { week: 4, tasks: [
    { id: 8, done: false, label: { fr: "Bilan d'intégration", en: "Onboarding review" } },
  ]},
];

export const ONBOARDING_CONTACTS = [
  { id: 1, role: { fr: "Manager", en: "Manager" }, name: "Sofia Alami" },
  { id: 2, role: { fr: "Référent RH", en: "HR contact" }, name: "Karim Benali" },
  { id: 3, role: { fr: "Parrain / Marraine", en: "Buddy" }, name: "Lina Cherkaoui" },
];

export const REQUESTS = [
  { id: 1, type: { fr: "Congé payé", en: "Paid leave" }, date: "12–16 mai 2026", status: "pending" },
  { id: 2, type: { fr: "Attestation de travail", en: "Work certificate" }, date: "20 mai 2026", status: "validated" },
  { id: 3, type: { fr: "Télétravail exceptionnel", en: "Exceptional remote work" }, date: "8 mai 2026", status: "refused" },
];

export const PROFILE = {
  name: "Yannick Keke",
  role: { fr: "Architecte solution", en: "Solution Architect" },
  dept: { fr: "Systèmes d'information", en: "IT" },
  manager: "Sofia Alami",
  email: "yannick.keke@entreprise.com",
  phone: "+212 6 00 00 00 00",
  location: "Rabat",
  seniority: { fr: "2 ans", en: "2 years" },
  contract: "CDI",
};

// --- Lot 3 : espace RH / Manager / Direction ---
export const TURNOVER_TREND = [
  { m: "Jan", real: 9.1, pred: null }, { m: "Fév", real: 8.8, pred: null },
  { m: "Mar", real: 8.5, pred: null }, { m: "Avr", real: 8.3, pred: null },
  { m: "Mai", real: 8.2, pred: 8.2 }, { m: "Juin", real: null, pred: 7.9 },
  { m: "Juil", real: null, pred: 7.6 }, { m: "Aoû", real: null, pred: 7.4 },
];
export const PAYROLL_TREND = [
  { m: "Jan", v: 1.82 }, { m: "Fév", v: 1.85 }, { m: "Mar", v: 1.88 },
  { m: "Avr", v: 1.90 }, { m: "Mai", v: 1.93 }, { m: "Juin", v: 1.97 },
];
export const ABSENCE_TREND = [
  { m: "Jan", v: 3.4 }, { m: "Fév", v: 3.1 }, { m: "Mar", v: 3.8 },
  { m: "Avr", v: 2.9 }, { m: "Mai", v: 3.2 }, { m: "Juin", v: 2.7 },
];
export const HEADCOUNT_BY_DEPT = [
  { d: "IT", v: 64 }, { d: "Ventes", v: 52 }, { d: "RH", v: 18 },
  { d: "Finance", v: 31 }, { d: "Ops", v: 83 },
];
export const TEAM_ABSENCE_WEEK = [
  { d: "Lun", v: 1 }, { d: "Mar", v: 2 }, { d: "Mer", v: 0 },
  { d: "Jeu", v: 1 }, { d: "Ven", v: 3 },
];
export const RISK_LIST = [
  { id: 1, name: "Adam Roux", dept: "Ops", level: "high", factors: { fr: "Charge ↑, absences ↑", en: "Workload ↑, absences ↑" } },
  { id: 2, name: "Inès Faured", dept: "Ventes", level: "mid", factors: { fr: "Baisse d'activité", en: "Activity drop" } },
  { id: 3, name: "Omar Tazi", dept: "IT", level: "low", factors: { fr: "Feedback en baisse", en: "Lower feedback" } },
];
export const DEPARTURES = [
  { id: 1, name: "Sami Lahlou", date: "30 juin 2026", progress: 60 },
  { id: 2, name: "Clara Petit", date: "15 juil. 2026", progress: 25 },
];
export const OFFBOARDING_STEPS = [
  { id: 1, done: true, label: { fr: "Restitution du matériel", en: "Equipment return" } },
  { id: 2, done: true, label: { fr: "Révocation des accès", en: "Access revocation" } },
  { id: 3, done: false, label: { fr: "Transfert des responsabilités", en: "Handover of duties" } },
  { id: 4, done: false, label: { fr: "Entretien & clôture administrative", en: "Exit interview & admin closure" } },
];
export const EMPLOYEES = [
  { id: 1, name: "Sofia Alami", dept: "IT", role: { fr: "Manager", en: "Manager" }, status: "ACTIVE" },
  { id: 2, name: "Karim Benali", dept: "RH", role: { fr: "Chargé RH", en: "HR officer" }, status: "ACTIVE" },
  { id: 3, name: "Lina Cherkaoui", dept: "Ventes", role: { fr: "Commerciale", en: "Sales" }, status: "NEW" },
  { id: 4, name: "Sami Lahlou", dept: "Ops", role: { fr: "Technicien", en: "Technician" }, status: "LEAVING" },
  { id: 5, name: "Inès Faured", dept: "Ventes", role: { fr: "Commerciale", en: "Sales" }, status: "ACTIVE" },
];
export const REPORTS = [
  { id: 1, name: { fr: "Bilan social annuel", en: "Annual social report" } },
  { id: 2, name: { fr: "Rapport turnover trimestriel", en: "Quarterly turnover report" } },
  { id: 3, name: { fr: "Synthèse masse salariale", en: "Payroll summary" } },
];

// --- Lot 4 : espace Admin / Supervision ---
export const AI_USAGE_TREND = [
  { m: "Lun", v: 320 }, { m: "Mar", v: 410 }, { m: "Mer", v: 380 },
  { m: "Jeu", v: 460 }, { m: "Ven", v: 520 }, { m: "Sam", v: 120 }, { m: "Dim", v: 90 },
];
export const CRITICAL_EVENTS = [
  { id: 1, time: "09:12", type: { fr: "Requête non autorisée", en: "Unauthorized request" }, role: "MANAGER", severity: "high" },
  { id: 2, time: "08:47", type: { fr: "Tentative répétée", en: "Repeated attempt" }, role: "COLLABORATEUR", severity: "med" },
  { id: 3, time: "08:05", type: { fr: "Accès refusé", en: "Access denied" }, role: "COLLABORATEUR", severity: "low" },
];
export const IA_LOGS = [
  { id: 1, time: "2026-06-03 09:12", role: "MANAGER", type: { fr: "Données d'un autre service", en: "Other team data" }, verdict: "refused" },
  { id: 2, time: "2026-06-03 09:03", role: "RH", type: { fr: "Politique de congés", en: "Leave policy" }, verdict: "allowed" },
  { id: 3, time: "2026-06-03 08:47", role: "COLLABORATEUR", type: { fr: "Demande répétée · paie", en: "Repeated · payroll" }, verdict: "flagged" },
  { id: 4, time: "2026-06-03 08:30", role: "COLLABORATEUR", type: { fr: "Solde de congés", en: "Leave balance" }, verdict: "allowed" },
];
export const SEC_ALERTS = [
  { id: 1, title: { fr: "Tentative d'accès à des données RH non autorisées", en: "Attempt to access unauthorized HR data" }, severity: "crit", status: "open" },
  { id: 2, title: { fr: "Requêtes sensibles répétées (paie)", en: "Repeated sensitive requests (payroll)" }, severity: "high", status: "progress" },
  { id: 3, title: { fr: "Pic d'usage inhabituel de l'assistant", en: "Unusual assistant usage spike" }, severity: "med", status: "resolved" },
];
export const AUDIT_LOG = [
  { id: 1, time: "2026-06-03 09:20", actor: "admin@synapse", action: { fr: "Rôle modifié : K. Benali → RH", en: "Role changed: K. Benali → HR" } },
  { id: 2, time: "2026-06-03 08:58", actor: "system", action: { fr: "Alerte critique générée", en: "Critical alert generated" } },
  { id: 3, time: "2026-06-02 17:40", actor: "admin@synapse", action: { fr: "Compte désactivé : S. Lahlou", en: "Account disabled: S. Lahlou" } },
];
export const ADMIN_USERS = [
  { id: 1, name: "Sofia Alami", role: "MANAGER", last: "2026-06-03 08:40" },
  { id: 2, name: "Karim Benali", role: "RH", last: "2026-06-03 09:01" },
  { id: 3, name: "Yannick Keke", role: "COLLABORATEUR", last: "2026-06-03 07:55" },
  { id: 4, name: "Dr. N. Saidi", role: "MEDECINE", last: "2026-06-02 14:20" },
];
export const ROLE_SHORT = {
  COLLABORATEUR: "Collab", MANAGER: "Mgr", RH: "RH", DIRECTION: "Dir", ADMIN: "Admin", MEDECINE: "Méd",
};
export const PERM_MODULES = [
  { key: "assistant", label: { fr: "Assistant IA", en: "AI Assistant" } },
  { key: "documents", label: { fr: "Documents", en: "Documents" } },
  { key: "analytics", label: { fr: "Analytique", en: "Analytics" } },
  { key: "payroll", label: { fr: "Masse salariale", en: "Payroll" } },
  { key: "disengagement", label: { fr: "Désengagement", en: "Disengagement" } },
  { key: "supervision", label: { fr: "Supervision IA", en: "AI Supervision" } },
  { key: "users", label: { fr: "Utilisateurs", en: "Users" } },
];
// R = lecture, RW = lecture/écriture, "-" = aucun accès
export const PERM_GRID = {
  assistant:     { COLLABORATEUR: "RW", MANAGER: "RW", RH: "RW", DIRECTION: "RW", ADMIN: "-",  MEDECINE: "RW" },
  documents:     { COLLABORATEUR: "RW", MANAGER: "RW", RH: "RW", DIRECTION: "R",  ADMIN: "-",  MEDECINE: "-" },
  analytics:     { COLLABORATEUR: "-",  MANAGER: "R",  RH: "RW", DIRECTION: "R",  ADMIN: "-",  MEDECINE: "-" },
  payroll:       { COLLABORATEUR: "-",  MANAGER: "-",  RH: "RW", DIRECTION: "R",  ADMIN: "-",  MEDECINE: "-" },
  disengagement: { COLLABORATEUR: "-",  MANAGER: "R",  RH: "RW", DIRECTION: "R",  ADMIN: "-",  MEDECINE: "R" },
  supervision:   { COLLABORATEUR: "-",  MANAGER: "-",  RH: "-",  DIRECTION: "-",  ADMIN: "RW", MEDECINE: "-" },
  users:         { COLLABORATEUR: "-",  MANAGER: "-",  RH: "-",  DIRECTION: "-",  ADMIN: "RW", MEDECINE: "-" },
};
