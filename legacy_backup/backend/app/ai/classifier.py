from app.ai.normalizer import normalize_for_matching


DANGEROUS_KEYWORDS = {
    "pirater",
    "malware",
    "phishing",
    "bombe",
    "arme",
    "voler un mot de passe",
    "contourner securite",
}

RH_KEYWORDS = {
    "conge",
    "conges",
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
    "mobilite",
    "demission",
    "turnover",
    "absenteisme",
    "document rh",
    "politique rh",
    "procedure",
    "avantage social",
    "teletravail",
}

GENERAL_KEYWORDS = {
    "histoire",
    "geographie",
    "science",
    "definition",
    "expliquer",
    "c'est quoi",
    "qui est",
    "quand",
    "pourquoi",
    "comment fonctionne",
    "culture generale",
    "informatique generale",
    "ia",
    "machine learning",
}

OFF_TOPIC_KEYWORDS = {
    "blague",
    "jeu",
    "chanson",
    "poeme",
    "recette",
    "cinema",
    "foot",
    "voyage",
}

DOCUMENT_GENERATION_KEYWORDS = {"genere", "attestation", "document", "certificat"}
ONBOARDING_KEYWORDS = {"onboarding", "integration", "arrivee"}
OFFBOARDING_KEYWORDS = {"offboarding", "depart", "sortie"}
SENSITIVE_KEYWORDS = {"salaire", "dossier personnel", "sanction", "confidentiel", "confidentielle"}
PREDICTIVE_KEYWORDS = {"prevision", "predictif", "turnover", "kpi"}


def _contains_any(message: str, keywords: set[str]) -> bool:
    lowered = normalize_for_matching(message)
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
