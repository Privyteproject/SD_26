import re


BLOCKED_RESPONSE_PATTERNS = ("clé api", "cle api", "api key", "system prompt", "developer message")


def post_filter_answer(answer: str, scope: str, request_type: str) -> dict[str, object]:
    warnings: list[str] = []
    cleaned = re.sub(r"\s+", " ", (answer or "")).strip()

    if not cleaned:
        warnings.append("Empty answer generated.")

    lowered = cleaned.lower()
    if any(pattern in lowered for pattern in BLOCKED_RESPONSE_PATTERNS):
        return {
            "is_valid": False,
            "answer": "Je ne peux pas fournir cette réponse pour des raisons de sécurité.",
            "warnings": warnings + ["Sensitive output blocked."],
        }

    if scope == "rh" and request_type and "[Source:" not in cleaned:
        warnings.append("RH answer returned without explicit inline source citation.")

    return {"is_valid": True, "answer": cleaned, "warnings": warnings}
