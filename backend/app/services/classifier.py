"""Classification de la requête : périmètre + type de demande RH.

>>> PROVISOIRE : classifieur par mots-clés (rapide, gratuit, local). À remplacer
par un petit modèle de routage ou des embeddings si besoin de finesse."""

from app.services.text_utils import normalize

PERIMETRE_RH = "RH"
PERIMETRE_CULTURE = "CULTURE"
PERIMETRE_HORS_SUJET = "HORS_SUJET"
PERIMETRE_DANGEREUX = "DANGEREUX"

_DANGEREUX = ["arme", "explosif", "bombe", "drogue", "fabriquer une", "tuer",
              "pirater", "hacker un", "voler", "carte bancaire", "attentat", "poison"]

_RH = ["conge", "absence", "teletravail", "rtt", "salaire", "paie", "bulletin",
       "attestation", "contrat", "onboarding", "offboarding", "integration", "depart",
       "prime", "demission", "arret maladie", "rh", "entretien", "anciennete",
       "solde de tout compte", "mutuelle", "formation"]

_TYPES = {
    "generation": ["attestation", "document", "bulletin", "certificat", "contrat", "generer"],
    "parcours": ["onboarding", "offboarding", "integration", "depart", "arrivee"],
    "sensible": ["salaire", "paie", "prime", "dossier", "cin", "medical", "sante", "handicap", "remuneration"],
    "predictive": ["turnover", "risque", "burnout", "desengagement", "prevision", "tendance", "absenteisme"],
}


def _has(t: str, words) -> bool:
    return any(w in t for w in words)


def classify(text: str) -> dict:
    t = normalize(text)
    if _has(t, _DANGEREUX):
        return {"perimetre": PERIMETRE_DANGEREUX, "type_rh": None}
    if _has(t, _RH):
        type_rh = "simple"
        for label, words in _TYPES.items():
            if _has(t, words):
                type_rh = label
                break
        return {"perimetre": PERIMETRE_RH, "type_rh": type_rh}
    # Salutation / bruit / trop court -> hors sujet
    if len(t) < 4 or t in {"bonjour", "salut", "merci", "ok", "hello", "coucou"}:
        return {"perimetre": PERIMETRE_HORS_SUJET, "type_rh": None}
    # Sinon question de culture générale
    return {"perimetre": PERIMETRE_CULTURE, "type_rh": None}
