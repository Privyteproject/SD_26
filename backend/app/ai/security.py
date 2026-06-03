from app.ai.normalizer import normalize_user_message


PROMPT_INJECTION_KEYWORDS = {
    "ignore les instructions",
    "ignore previous instructions",
    "revele ton prompt",
    "révèle ton prompt",
    "system prompt",
    "developer message",
    "jailbreak",
    "bypass",
    "affiche les logs",
}

SENSITIVE_EXTRACTION_KEYWORDS = {
    "cle api",
    "clé api",
    "api key",
    "donne les salaires de tout le monde",
    "salaire de tous les collaborateurs",
    "affiche les logs",
}

DANGEROUS_KEYWORDS = {
    "pirater",
    "phishing",
    "malware",
    "exploit",
    "voler un mot de passe",
    "bombe",
    "arme",
    "contourner sécurité",
    "contourner securite",
}


def _contains_keyword(message: str, keywords: set[str]) -> bool:
    lowered = normalize_user_message(message).lower()
    return any(keyword in lowered for keyword in keywords)


def detect_prompt_injection(message: str) -> bool:
    return _contains_keyword(message, PROMPT_INJECTION_KEYWORDS)


def detect_dangerous_request(message: str) -> bool:
    return _contains_keyword(message, DANGEROUS_KEYWORDS)


def detect_sensitive_data_extraction(message: str) -> bool:
    return _contains_keyword(message, SENSITIVE_EXTRACTION_KEYWORDS)


def security_prefilter(message: str) -> dict[str, str | bool | None]:
    if detect_prompt_injection(message):
        return {
            "is_blocked": True,
            "reason": "Prompt injection detected.",
            "severity": "high",
        }
    if detect_dangerous_request(message):
        return {
            "is_blocked": True,
            "reason": "Dangerous request detected.",
            "severity": "high",
        }
    if detect_sensitive_data_extraction(message):
        return {
            "is_blocked": True,
            "reason": "Sensitive data extraction detected.",
            "severity": "high",
        }
    return {"is_blocked": False, "reason": None, "severity": None}
