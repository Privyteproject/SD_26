import re


MAX_MESSAGE_LENGTH = 4000


def normalize_user_message(message: str) -> str:
    if message is None:
        return ""
    normalized = re.sub(r"\s+", " ", message).strip()
    return normalized[:MAX_MESSAGE_LENGTH]
