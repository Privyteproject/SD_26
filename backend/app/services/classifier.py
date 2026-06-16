"""Classification de la requête : périmètre + type de demande RH.

Stratégie hybride :
  1. Garde-fous déterministes (mots-clés) : rapides, gratuits, prioritaires pour
     la sécurité (dangereux) et le bruit (salutations / trop court).
  2. Classifieur LLM (catégorie + confiance) si activé et disponible
     (cf. ai_service.classify_scope) — c'est lui qui distingue finement
     « general » (culture générale) de « out_of_scope ».
  3. Repli mots-clés déterministe si le LLM est indisponible ou peu confiant.

Le score de confiance reste INTERNE (jamais renvoyé à l'utilisateur final).
"""

from app.core.config import settings
from app.services import ai as ai_service
from app.services.text_utils import normalize

PERIMETRE_RH = "RH"
PERIMETRE_CULTURE = "CULTURE"
PERIMETRE_HORS_SUJET = "HORS_SUJET"
PERIMETRE_DANGEREUX = "DANGEREUX"

# Catégories renvoyées par le classifieur LLM -> périmètres internes.
_CATEGORY_TO_PERIMETRE = {
    "rh": PERIMETRE_RH,
    "general": PERIMETRE_CULTURE,
    "out_of_scope": PERIMETRE_HORS_SUJET,
    "dangerous": PERIMETRE_DANGEREUX,
}

_DANGEREUX = ["arme", "explosif", "bombe", "drogue", "fabriquer une", "tuer",
              "pirater", "hacker un", "voler", "carte bancaire", "attentat", "poison"]

_RH = ["conge", "absence", "teletravail", "rtt", "salaire", "paie", "bulletin",
       "attestation", "contrat", "onboarding", "offboarding", "integration", "depart",
       "prime", "demission", "arret maladie", "rh", "entretien", "anciennete",
       "solde de tout compte", "mutuelle", "formation",
       # déclencheurs des moteurs spécialisés (génération E2 / prédictif E4)
       "document", "generer", "certificat", "dossier",
       "turnover", "risque", "burnout", "desengagement", "absenteisme",
       "tendance", "prevision"]

_SALUTATIONS = {"bonjour", "salut", "merci", "ok", "hello", "coucou"}

_TYPES = {
    "generation": ["attestation", "document", "bulletin", "certificat", "contrat", "generer"],
    "parcours": ["onboarding", "offboarding", "integration", "depart", "arrivee"],
    "sensible": ["salaire", "paie", "prime", "dossier", "cin", "medical", "sante", "handicap", "remuneration"],
    "predictive": ["turnover", "risque", "burnout", "desengagement", "prevision", "tendance", "absenteisme"],
}


def _has(t: str, words) -> bool:
    return any(w in t for w in words)


def _type_rh(t: str) -> str:
    """Détermine le sous-type d'une demande RH (pour le RBAC/ABAC en aval)."""
    for label, words in _TYPES.items():
        if _has(t, words):
            return label
    return "simple"


def classify(text: str) -> dict:
    """Renvoie {"perimetre", "type_rh", "confidence"} (confidence = interne)."""
    t = normalize(text)

    # 1) Garde-fous déterministes (sécurité + bruit), prioritaires.
    if _has(t, _DANGEREUX):
        return {"perimetre": PERIMETRE_DANGEREUX, "type_rh": None, "confidence": 0.99}
    if len(t) < 4 or t in _SALUTATIONS:
        return {"perimetre": PERIMETRE_HORS_SUJET, "type_rh": None, "confidence": 0.9}

    # 2) Classifieur LLM (catégorie + confiance) si activé.
    if settings.CLS_LLM_ENABLED:
        llm = ai_service.classify_scope(text)
        if llm and llm["confidence"] >= settings.CLS_MIN_CONFIDENCE:
            perimetre = _CATEGORY_TO_PERIMETRE[llm["category"]]
            type_rh = _type_rh(t) if perimetre == PERIMETRE_RH else None
            return {"perimetre": perimetre, "type_rh": type_rh, "confidence": llm["confidence"]}

    # 3) Repli mots-clés déterministe.
    if _has(t, _RH):
        return {"perimetre": PERIMETRE_RH, "type_rh": _type_rh(t), "confidence": 0.6}
    # Par défaut : culture générale (et non « hors sujet »).
    return {"perimetre": PERIMETRE_CULTURE, "type_rh": None, "confidence": 0.5}
