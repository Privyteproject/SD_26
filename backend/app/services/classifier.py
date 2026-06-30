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
       "solde de tout compte", "mutuelle", "formation", "waminey", "synapse", "entreprise", "startup", "histoire",
       # déclencheurs des moteurs spécialisés (génération E2 / prédictif E4)
       "document", "generer", "certificat", "dossier",
       "turnover", "risque", "burnout", "desengagement", "absenteisme",
       "tendance", "prevision"]

_SALUTATIONS = {"bonjour", "salut", "merci", "ok", "hello", "coucou"}

# Ordre = priorité : « sensible » (données personnelles : contrat, dossier, paie…) est
# évalué AVANT « generation » pour qu'une demande de consultation parte vers E5 (ABAC).
_TYPES = {
    "sensible": ["salaire", "paie", "prime", "dossier", "cin", "medical", "sante", "handicap",
                 "remuneration", "contrat", "clause", "fiche", "personnel",
                 "masse salariale", "salariale"],
    "predictive": ["turnover", "risque", "burnout", "desengagement", "engagement", "prevision",
                   "tendance", "absenteisme", "climat social", "climat", "retention", "demissions",
                   "indicateur", "kpi", "tableau de bord"],
    "parcours": ["onboarding", "offboarding", "integration", "depart", "arrivee"],
    "generation": ["attestation", "document", "certificat", "generer", "bulletin"],
    # supervision opérationnelle (réservée aux encadrants) : files d'attente RH + sécurité IA.
    "supervision": [
        "absences en attente", "demandes en attente", "conges en attente",
        "en attente dans", "a valider", "a approuver", "a traiter",
        "interactions ia", "interaction ia", "tentatives d'acces", "tentative d'acces",
        "acces refuses", "acces refuse", "refus d'acces", "alertes securite",
        "alertes de securite", "supervision",
    ],
}


def _has(t: str, words) -> bool:
    return any(w in t for w in words)


def has_sensitive_kw(text: str) -> bool:
    """Vrai si le texte contient un mot-clé de donnée SENSIBLE (paie, contrat, dossier…).
    Sert au pipeline à rattraper une demande nominative (« salaire de X ») vers le moteur E5."""
    t = normalize(text)
    return _has(t, _TYPES["sensible"]) or (bool(_EXTRA_SENSIBLE) and _has(t, _EXTRA_SENSIBLE))


# Mots-clés sensibles SUPPLÉMENTAIRES configurés par l'admin (additif au socle ci-dessus,
# jamais en retrait — chargés au démarrage, mis à jour via /config/rules).
_EXTRA_SENSIBLE: list[str] = []


def set_extra_sensible(words) -> None:
    global _EXTRA_SENSIBLE
    from app.services.text_utils import normalize as _n
    _EXTRA_SENSIBLE = [_n(w) for w in (words or []) if w and w.strip()]


def get_extra_sensible() -> list[str]:
    return list(_EXTRA_SENSIBLE)


# Marqueurs « données PERSONNELLES » : on ne route vers le moteur confidentiel (E5/ABAC)
# que si la demande vise des données propres à une personne. Une question GÉNÉRALE
# (« les clauses d'un CDI », « la politique de congés ») part au RAG documentaire.
_PERSONAL = [
    "mon ", "ma ", "mes ", "j'", "je ", "moi", "mien", "mienne", "notre",
    "my ", "me ", "mine",
]


def _is_personal(t: str) -> bool:
    return _has(t, _PERSONAL)


# Marqueurs d'une vraie demande ANALYTIQUE de données (réservée aux rôles habilités) :
# « qui risque de partir », « liste des employés à risque », « score/taux/prédiction »…
# Une question d'INFORMATION générale (« comment prévenir le burnout ») n'en a pas -> RAG.
_ANALYTICS = [
    "qui ", "liste", "score", "prediction", "predire", "predis", "taux", "combien",
    "classement", "prevision", "statistiqu", "probabilit", "analyse les", "quels employes",
    "quel employe", "qui va", "qui risque",
    # marqueurs d'une demande de DONNÉES agrégées / reporting (≠ question d'info générale)
    "par departement", "par service", "par equipe", "par site", "par pole",
    "agrege", "agregee", "agreges", "agregees", "global", "globale", "ensemble",
    "masse salariale", "climat social", "projection", "evolution", "repartition",
    "moyenne", "indicateur", "tableau de bord", "kpi",
]


def _type_rh(t: str) -> str:
    """Détermine le sous-type d'une demande RH (pour le RBAC/ABAC en aval)."""
    label = "simple"
    if _EXTRA_SENSIBLE and _has(t, _EXTRA_SENSIBLE):
        label = "sensible"
    else:
        for lab, words in _TYPES.items():
            if _has(t, words):
                label = lab
                break
    # « sensible » (données perso/paie) : réservé aux demandes PERSONNELLES ou aux
    # agrégats RH (masse salariale…) ; une question générale (clauses d'un CDI) -> RAG.
    if label == "sensible" and not (_is_personal(t) or _has(t, _ANALYTICS)):
        return "simple"
    # « predictive » (analytics restreint) : réservé aux demandes de DONNÉES/analyse ou
    # personnelles ; une question d'info générale (prévention, définition) -> RAG.
    if label == "predictive" and not (_is_personal(t) or _has(t, _ANALYTICS)):
        return "simple"
    # « parcours » (on/offboarding) : le moteur lit les tâches PERSO. Une question GÉNÉRALE
    # (« comment se passe l'onboarding ») -> RAG (guide) ; « mon onboarding / mes tâches » -> moteur.
    if label == "parcours" and not (_is_personal(t) or _has(t, _ANALYTICS)):
        return "simple"
    return label


def classify(text: str) -> dict:
    """Renvoie {"perimetre", "type_rh", "is_personal", "confidence"} (confidence = interne).

    `is_personal` = la question porte sur SA propre situation (« ma paie », « mon contrat »).
    Le pipeline s'en sert pour le self-service collaborateur : une question PERSONNELLE sur un
    sujet RH sensible reste légitime (§3.1) et part au RAG documentaire plutôt qu'au refus.
    """
    t = normalize(text)
    personal = _is_personal(t)

    # 1) Garde-fous déterministes (sécurité + bruit), prioritaires.
    if _has(t, _DANGEREUX):
        return {"perimetre": PERIMETRE_DANGEREUX, "type_rh": None, "is_personal": personal, "confidence": 0.99}
    if len(t) < 4 or t in _SALUTATIONS:
        return {"perimetre": PERIMETRE_HORS_SUJET, "type_rh": None, "is_personal": personal, "confidence": 0.9}

    # 2) Classifieur LLM (catégorie + confiance) si activé.
    if settings.CLS_LLM_ENABLED:
        llm = ai_service.classify_scope(text)
        if llm and llm["confidence"] >= settings.CLS_MIN_CONFIDENCE:
            perimetre = _CATEGORY_TO_PERIMETRE[llm["category"]]
            type_rh = _type_rh(t) if perimetre == PERIMETRE_RH else None
            return {"perimetre": perimetre, "type_rh": type_rh, "is_personal": personal, "confidence": llm["confidence"]}

    # 3) Repli mots-clés déterministe.
    if _has(t, _RH):
        return {"perimetre": PERIMETRE_RH, "type_rh": _type_rh(t), "is_personal": personal, "confidence": 0.6}
    # Par défaut : culture générale (et non « hors sujet »).
    return {"perimetre": PERIMETRE_CULTURE, "type_rh": None, "is_personal": personal, "confidence": 0.5}
