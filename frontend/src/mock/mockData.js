// Référentiels d'AFFICHAGE (catalogue de rapports, matrice de permissions de référence).
// NB : ce ne sont pas des « données métier » simulées — les écrans branchés consomment les
// vraies API. La matrice ci-dessous documente la politique RBAC effective (cf. routes.jsx +
// require_roles côté backend) et sert de référence visuelle dans la console d'administration.

// Catalogue des rapports proposés (la génération PDF réelle passe par /rapports/generate).
export const REPORTS = [
  { id: 1, name: { fr: "Bilan social annuel", en: "Annual social report" } },
  { id: 2, name: { fr: "Rapport turnover trimestriel", en: "Quarterly turnover report" } },
  { id: 3, name: { fr: "Synthèse masse salariale", en: "Payroll summary" } },
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
// R = lecture, RW = lecture/écriture, "-" = aucun accès. Reflète la politique effective :
// la médecine du travail est limitée au bien-être (loi 09-08) — exclue de l'analytique,
// du désengagement et de la masse salariale.
export const PERM_GRID = {
  assistant:     { COLLABORATEUR: "RW", MANAGER: "RW", RH: "RW", DIRECTION: "RW", ADMIN: "RW", MEDECINE: "RW" },
  documents:     { COLLABORATEUR: "RW", MANAGER: "RW", RH: "RW", DIRECTION: "R",  ADMIN: "-",  MEDECINE: "-" },
  analytics:     { COLLABORATEUR: "-",  MANAGER: "R",  RH: "RW", DIRECTION: "R",  ADMIN: "-",  MEDECINE: "-" },
  payroll:       { COLLABORATEUR: "-",  MANAGER: "-",  RH: "RW", DIRECTION: "R",  ADMIN: "-",  MEDECINE: "-" },
  disengagement: { COLLABORATEUR: "-",  MANAGER: "R",  RH: "RW", DIRECTION: "R",  ADMIN: "-",  MEDECINE: "-" },
  supervision:   { COLLABORATEUR: "-",  MANAGER: "-",  RH: "-",  DIRECTION: "-",  ADMIN: "RW", MEDECINE: "-" },
  users:         { COLLABORATEUR: "-",  MANAGER: "-",  RH: "-",  DIRECTION: "-",  ADMIN: "RW", MEDECINE: "-" },
};
