// Rôles utilisateurs (cibles du projet)
export const ROLES = {
  COLLABORATEUR: "COLLABORATEUR",
  MANAGER: "MANAGER",
  RH: "RH",
  DIRECTION: "DIRECTION",
  ADMIN: "ADMIN",
  MEDECINE: "MEDECINE",
};

export const ROLE_LABELS = {
  COLLABORATEUR: { fr: "Collaborateur", en: "Employee" },
  MANAGER: { fr: "Manager", en: "Manager" },
  RH: { fr: "Ressources Humaines", en: "Human Resources" },
  DIRECTION: { fr: "Direction", en: "Executive" },
  ADMIN: { fr: "Administrateur", en: "Administrator" },
  MEDECINE: { fr: "Médecine du travail", en: "Occupational Health" },
};

// Statut de cycle de vie du collaborateur
export const STATUS = {
  NEW: "NEW",       // nouvel arrivant -> onboarding visible
  ACTIVE: "ACTIVE", // actif
  LEAVING: "LEAVING", // en départ (communiqué) -> offboarding visible
};

export const STATUS_LABELS = {
  NEW: { fr: "Nouvel arrivant", en: "New hire" },
  ACTIVE: { fr: "Actif", en: "Active" },
  LEAVING: { fr: "En départ", en: "Leaving" },
};

// Rôles qui accèdent à l'espace RH / Manager / Direction
export const RH_SPACE_ROLES = [ROLES.MANAGER, ROLES.RH, ROLES.DIRECTION, ROLES.MEDECINE];
