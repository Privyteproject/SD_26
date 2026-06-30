"""Grille salariale : le salaire dépend du MÉTIER et du NIVEAU DE POSTE.

Principe : salaire = base(niveau) × coefficient(métier), arrondi à la centaine.
Le niveau de poste est celui atteint via les compétences VALIDÉES par le manager
(cf. repository.current_career_level). Quand un collaborateur monte de niveau,
son salaire est porté au palier correspondant (cf. repository.validate_evaluation).

Barème indicatif (annuel brut, en MAD) — ajustable ici sans toucher au reste du code.
"""

import unicodedata

from app.db.models import NIVEAUX_CARRIERE  # ["Junior", "Opérationnel", "Confirmé", "Senior"]

# Base par niveau de poste. `None` = aucun niveau encore validé (palier d'entrée).
NIVEAU_BASE: dict = {
    None: 28000,
    "Junior": 32000,
    "Opérationnel": 40000,
    "Confirmé": 52000,
    "Senior": 66000,
}

# Coefficient par métier (fragment de nom normalisé -> coef). Défaut = 1.0.
# Permet de valoriser certaines familles de métiers (tech/data) vs d'autres.
METIER_COEF: dict = {
    "data": 1.30, "devops": 1.28, "securite": 1.28, "cloud": 1.25,
    "developpeur": 1.22, "developpeuse": 1.22, "ingenieur": 1.20, "logiciel": 1.20,
    "product": 1.15, "chef de projet": 1.15, "lead": 1.18,
    "ux": 1.12, "design": 1.10, "qa": 1.08, "test": 1.08,
    "commercial": 1.05, "vente": 1.05, "marketing": 1.05,
    "rh": 1.00, "comptab": 1.00, "finance": 1.05, "juridique": 1.05,
    "support": 0.92, "assistant": 0.90, "stagiaire": 0.70,
}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


def coef_metier(metier_nom: str | None) -> float:
    """Coefficient multiplicateur d'un métier (1.0 par défaut)."""
    if not metier_nom:
        return 1.0
    n = _norm(metier_nom)
    for frag, coef in METIER_COEF.items():
        if frag in n:
            return coef
    return 1.0


def niveau_index(niveau: str | None) -> int:
    """Rang du niveau (Junior=0 … Senior=3) ; -1 si aucun niveau validé."""
    try:
        return NIVEAUX_CARRIERE.index(niveau)
    except (ValueError, TypeError):
        return -1


def salaire_grille(niveau: str | None, metier_nom: str | None = None) -> int:
    """Salaire annuel théorique pour un (niveau, métier), arrondi à la centaine."""
    base = NIVEAU_BASE.get(niveau, NIVEAU_BASE[None])
    montant = base * coef_metier(metier_nom)
    return int(round(montant / 100.0) * 100)
