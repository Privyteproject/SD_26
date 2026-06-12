from app.ai.normalizer import normalize_for_matching


PROMPT_INJECTION_KEYWORDS = {
    "ignore les instructions",
    "ignore previous instructions",
    "revele ton prompt",
    "reveal your prompt",
    "system prompt",
    "developer message",
    "jailbreak",
    "bypass",
    "affiche les logs",
}

SENSITIVE_EXTRACTION_KEYWORDS = {
    "cle api",
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
    "contourner securite",
}


def _contains_keyword(message: str, keywords: set[str]) -> bool:
    lowered = normalize_for_matching(message)
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
            "risk_type": "prompt_injection",
            "severity": "high",
        }
    if detect_dangerous_request(message):
        return {
            "is_blocked": True,
            "reason": "Dangerous request detected.",
            "risk_type": "dangerous_request",
            "severity": "high",
        }
    if detect_sensitive_data_extraction(message):
        return {
            "is_blocked": False,
            "reason": "Sensitive data extraction detected.",
            "risk_type": "sensitive_data_extraction",
            "severity": "medium",
        }
    return {"is_blocked": False, "reason": None, "risk_type": None, "severity": None}
