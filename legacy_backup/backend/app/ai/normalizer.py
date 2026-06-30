import re
import unicodedata


MAX_MESSAGE_LENGTH = 4000


def normalize_user_message(message: str) -> str:
    if message is None:
        return ""
    normalized = re.sub(r"\s+", " ", message).strip()
    return normalized[:MAX_MESSAGE_LENGTH]


def normalize_for_matching(message: str) -> str:
    normalized = normalize_user_message(message).lower()
    ascii_safe = unicodedata.normalize("NFKD", normalized).encode("ascii", "ignore").decode("ascii")
    return ascii_safe
