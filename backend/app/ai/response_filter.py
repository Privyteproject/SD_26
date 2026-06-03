import re


BLOCKED_RESPONSE_PATTERNS = ("cle api", "api key", "system prompt", "developer message")


def post_filter_answer(answer: str, scope: str, request_type: str) -> dict[str, object]:
    warnings: list[str] = []
    cleaned = re.sub(r"\s+", " ", (answer or "")).strip()

    if not cleaned:
        warnings.append("Empty answer generated.")

    lowered = cleaned.lower()
    if any(pattern in lowered for pattern in BLOCKED_RESPONSE_PATTERNS):
        return {
            "is_valid": False,
            "answer": "Je ne peux pas fournir cette reponse pour des raisons de securite.",
            "warnings": warnings + ["Sensitive output blocked."],
        }

    if scope == "rh" and request_type and "[Source:" not in cleaned:
        warnings.append("RH answer returned without explicit inline source citation.")
    if scope == "rh" and not cleaned:
        warnings.append("RH answer returned without any usable source-backed content.")

    return {"is_valid": True, "answer": cleaned, "warnings": warnings}
