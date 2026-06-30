"""Agent IA de génération de parcours (onboarding / offboarding).

Génère un planning de tâches sur ~30 jours adapté au rôle de l'employé, via le LLM
(ai_service). Repli sur un plan par défaut si le LLM est indisponible/non parsable —
l'application reste fonctionnelle.
"""

from app.services import ai as ai_service

_SYSTEM = (
    "Tu es un assistant RH qui conçoit des parcours d'intégration/de départ. "
    "Tu réponds UNIQUEMENT par un tableau JSON valide, sans texte autour, de la forme : "
    '[{"libelle": "<intitulé court de la tâche>", "delai_jours": <entier 0-30>}]. '
    "Entre 6 et 10 tâches, ordonnées par délai croissant, concrètes et professionnelles."
)

_DEFAULT = {
    "ONBOARDING": [
        {"libelle": "Signer le contrat et les documents administratifs", "delai_jours": 1},
        {"libelle": "Configurer le poste de travail et les accès", "delai_jours": 2},
        {"libelle": "Rencontrer l'équipe et le manager", "delai_jours": 3},
        {"libelle": "Suivre la formation d'accueil", "delai_jours": 7},
        {"libelle": "Prendre connaissance des process et outils", "delai_jours": 10},
        {"libelle": "Définir les objectifs des 30 jours avec le manager", "delai_jours": 15},
        {"libelle": "Premier point de suivi d'intégration", "delai_jours": 30},
    ],
    "OFFBOARDING": [
        {"libelle": "Entretien de départ avec les RH", "delai_jours": 1},
        {"libelle": "Transfert des dossiers et passation", "delai_jours": 5},
        {"libelle": "Restituer le matériel et les badges", "delai_jours": 10},
        {"libelle": "Révoquer les accès informatiques", "delai_jours": 12},
        {"libelle": "Remettre le solde de tout compte et documents de fin", "delai_jours": 15},
    ],
}


def generate_plan(role: str | None, type_parcours: str = "ONBOARDING") -> list[dict]:
    """Renvoie une liste [{libelle, delai_jours}] adaptée au rôle. Repli si LLM KO."""
    type_parcours = type_parcours if type_parcours in _DEFAULT else "ONBOARDING"
    prompt = (
        f"Conçois un parcours de type {type_parcours.lower()} pour un employé occupant "
        f"le poste « {role or 'collaborateur'} ». Donne le planning sur 30 jours."
    )
    try:
        out = ai_service.complete(_SYSTEM, prompt, [])
        data = ai_service._extract_json(out.get("reply") or "")
        if isinstance(data, dict):  # tolère {"taches": [...]}
            data = data.get("taches") or data.get("tasks") or []
        plan = []
        for item in data:
            lib = str(item.get("libelle") or item.get("label") or "").strip()
            if not lib:
                continue
            try:
                delai = int(item.get("delai_jours", item.get("delai", 0)))
            except (TypeError, ValueError):
                delai = 0
            plan.append({"libelle": lib[:120], "delai_jours": max(0, min(delai, 30))})
        if plan:
            return sorted(plan, key=lambda x: x["delai_jours"])
    except Exception:
        pass
    return _DEFAULT[type_parcours]
