from app.ai.normalizer import normalize_user_message


DANGEROUS_KEYWORDS = {
    "pirater",
    "malware",
    "phishing",
    "bombe",
    "arme",
    "voler un mot de passe",
    "contourner sécurité",
    "contourner securite",
}

RH_KEYWORDS = {
    "congé",
    "conges",
    "congés",
    "absence",
    "paie",
    "salaire",
    "rh",
    "ressources humaines",
    "attestation",
    "contrat",
    "onboarding",
    "offboarding",
    "manager",
    "collaborateur",
    "formation",
    "mobilité",
    "mobilite",
    "démission",
    "demission",
    "turnover",
    "absentéisme",
    "absenteisme",
    "document rh",
    "politique rh",
    "procédure",
    "procedure",
    "avantage social",
    "télétravail",
    "teletravail",
}

GENERAL_KEYWORDS = {
    "histoire",
    "géographie",
    "geographie",
    "science",
    "définition",
    "definition",
    "expliquer",
    "c'est quoi",
    "qui est",
    "quand",
    "pourquoi",
    "comment fonctionne",
    "culture générale",
    "culture generale",
    "informatique générale",
    "informatique generale",
    "ia",
    "machine learning",
}

OFF_TOPIC_KEYWORDS = {
    "blague",
    "jeu",
    "chanson",
    "poème",
    "poeme",
    "recette",
    "cinéma",
    "cinema",
    "foot",
    "voyage",
}

DOCUMENT_GENERATION_KEYWORDS = {"génère", "genere", "attestation", "document", "certificat"}
ONBOARDING_KEYWORDS = {"onboarding", "intégration", "integration", "arrivée", "arrivee"}
OFFBOARDING_KEYWORDS = {"offboarding", "départ", "depart", "sortie"}
SENSITIVE_KEYWORDS = {"salaire", "dossier personnel", "sanction", "confidentiel", "confidentielle"}
PREDICTIVE_KEYWORDS = {"prévision", "prevision", "prédictif", "predictif", "turnover", "kpi"}


def _contains_any(message: str, keywords: set[str]) -> bool:
    lowered = normalize_user_message(message).lower()
    return any(keyword in lowered for keyword in keywords)


def classify_scope(message: str) -> str:
    if _contains_any(message, DANGEROUS_KEYWORDS):
        return "dangerous"
    if _contains_any(message, RH_KEYWORDS):
        return "rh"
    if _contains_any(message, GENERAL_KEYWORDS):
        return "general_knowledge"
    if _contains_any(message, OFF_TOPIC_KEYWORDS):
        return "off_topic"
    return "off_topic"


def classify_rh_request_type(message: str) -> str:
    if _contains_any(message, PREDICTIVE_KEYWORDS):
        return "predictive"
    if _contains_any(message, SENSITIVE_KEYWORDS):
        return "sensitive"
    if _contains_any(message, ONBOARDING_KEYWORDS):
        return "onboarding"
    if _contains_any(message, OFFBOARDING_KEYWORDS):
        return "offboarding"
    if _contains_any(message, DOCUMENT_GENERATION_KEYWORDS):
        return "document_generation"
    return "simple_rh_question"


def is_general_knowledge_allowed(message: str) -> bool:
    return classify_scope(message) == "general_knowledge"
