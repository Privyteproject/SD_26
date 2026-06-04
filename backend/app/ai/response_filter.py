import re


BLOCKED_RESPONSE_PATTERNS = ("cle api", "api key", "system prompt", "developer message")
SOURCE_CITATION_PATTERNS = ("[source:", "(source:", "\nsources:")


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

    lowered_cleaned = cleaned.lower()
    has_source_citation = any(pattern in lowered_cleaned for pattern in SOURCE_CITATION_PATTERNS)

    if scope == "rh" and request_type and not has_source_citation:
        warnings.append("RH answer returned without explicit inline source citation.")
    if scope == "rh" and not cleaned:
        warnings.append("RH answer returned without any usable source-backed content.")

    return {"is_valid": True, "answer": cleaned, "warnings": warnings}
