"""Registre des types de documents RH + contrôle d'accès par rôle.

Chaque type déclare ses champs requis/optionnels, les rôles autorisés et si une
validation RH est nécessaire. Le rendu s'appuie sur un template Jinja2
`app/templates/documents/{key}.html.j2`.
"""

DOCUMENT_TYPES = {
    "attestation_travail": {
        "label": "Attestation de travail",
        "description": "Certifie qu'un employé travaille dans l'entreprise",
        "required_fields": [],
        "optional_fields": ["objet"],
        "roles_allowed": ["collaborateur", "rh", "admin"],
        "requires_rh_validation": False,
    },
    "attestation_salaire": {
        "label": "Attestation de salaire",
        "description": "Certifie le salaire mensuel net de l'employé",
        "required_fields": [],
        "optional_fields": ["objet", "include_primes"],
        "roles_allowed": ["collaborateur", "rh", "admin"],
        "requires_rh_validation": True,
    },
    "demande_conge": {
        "label": "Demande de congé",
        "description": "Formulaire officiel de demande de congés payés ou sans solde",
        "required_fields": ["date_debut", "date_fin", "type_conge", "motif"],
        "optional_fields": ["commentaire"],
        "roles_allowed": ["collaborateur", "manager", "rh", "admin"],
        "requires_rh_validation": True,
    },
    "demande_remboursement": {
        "label": "Note de frais",
        "description": "Demande de remboursement de frais professionnels",
        "required_fields": ["date_depense", "montant", "nature_depense"],
        "optional_fields": ["justificatif_note", "commentaire"],
        "roles_allowed": ["collaborateur", "manager", "rh", "admin"],
        "requires_rh_validation": True,
    },
    "lettre_recommandation": {
        "label": "Lettre de recommandation interne",
        "description": "Recommandation pour mobilité interne ou externe",
        "required_fields": ["destinataire", "objet_recommandation"],
        "optional_fields": ["competences_a_mettre_en_avant"],
        "roles_allowed": ["manager", "rh", "admin"],
        "requires_rh_validation": True,
    },
    "fiche_onboarding": {
        "label": "Fiche d'intégration",
        "description": "Synthèse du parcours d'onboarding du nouveau collaborateur",
        "required_fields": ["date_debut", "manager_nom", "poste"],
        "optional_fields": ["objectifs_30j", "formations_prevues"],
        "roles_allowed": ["rh", "admin"],
        "requires_rh_validation": False,
    },
    "compte_rendu_entretien": {
        "label": "Compte-rendu d'entretien annuel",
        "description": "Synthèse formalisée de l'entretien d'évaluation",
        "required_fields": ["date_entretien", "evaluateur_nom", "periode_evaluee"],
        "optional_fields": ["points_forts", "axes_amelioration", "objectifs_annee_suivante"],
        "roles_allowed": ["manager", "rh", "admin"],
        "requires_rh_validation": True,
    },
    "synthese_transfert": {
        "label": "Synthèse de transfert (offboarding)",
        "description": "Capitalisation des connaissances avant départ (projets, outils, contacts)",
        "required_fields": [],
        "optional_fields": [],
        "roles_allowed": ["manager", "rh", "admin"],
        "requires_rh_validation": False,
    },
    "synthese_onboarding": {
        "label": "Synthèse d'intégration (onboarding)",
        "description": "Feuille de route métier + manuels internes pour un nouvel arrivant",
        "required_fields": [],
        "optional_fields": [],
        "roles_allowed": ["rh", "admin"],
        "requires_rh_validation": False,
    },
    "formulaire_sortie": {
        "label": "Formulaire de sortie (offboarding)",
        "description": "Formulaire de départ personnalisé selon le poste, l'ancienneté et le contexte",
        "required_fields": ["date_depart", "motif_depart"],
        "optional_fields": ["dernier_jour", "remplacant", "commentaire"],
        "roles_allowed": ["manager", "rh", "admin"],
        "requires_rh_validation": True,
    },
}

# Rôle applicatif (UPPER) -> rôle du registre. DIRECTION assimilé à RH ; MEDECINE restreint.
_APP_TO_REG = {
    "ADMIN": "admin", "RH": "rh", "DIRECTION": "rh",
    "MANAGER": "manager", "COLLABORATEUR": "collaborateur", "MEDECINE": "collaborateur",
}


def registry_role(app_role: str) -> str:
    return _APP_TO_REG.get(app_role, "collaborateur")


def list_types_for(app_role: str) -> list[dict]:
    """Types disponibles pour ce rôle (clé + métadonnées des champs)."""
    rr = registry_role(app_role)
    out = []
    for key, t in DOCUMENT_TYPES.items():
        if rr in t["roles_allowed"]:
            out.append({
                "key": key, "label": t["label"], "description": t["description"],
                "required_fields": t["required_fields"], "optional_fields": t["optional_fields"],
                "requires_rh_validation": t["requires_rh_validation"],
            })
    return out


def can_generate(app_role: str, type_key: str) -> bool:
    t = DOCUMENT_TYPES.get(type_key)
    return bool(t) and registry_role(app_role) in t["roles_allowed"]


def label_of(type_key: str) -> str:
    return DOCUMENT_TYPES.get(type_key, {}).get("label", type_key)
