import Assistant from "./Assistant";

// Assistant dédié aux managers / RH : même composant, profil « copilote RH »
// (capacités E3/E4 déjà réservées aux rôles élevés par le RBAC backend).
export default function AssistantRh() {
  return <Assistant audience="rh" />;
}
