import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import BACKEND_DIR, settings


AUDIT_LOG_PATH = BACKEND_DIR / "logs" / "audit.jsonl"


def write_audit_log(event: dict[str, Any]) -> None:
    if not settings.ENABLE_AUDIT_LOGS:
        return

    AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "event_type": event.get("event_type"),
        "user_id": event.get("user_id"),
        "role": event.get("role"),
        "decision": event.get("decision"),
        "request_type": event.get("request_type"),
        "scope": event.get("scope"),
        "model": event.get("model"),
        "sources": event.get("sources", []),
        "reason": event.get("reason"),
        "message": (event.get("message") or "")[:500],
    }
    with AUDIT_LOG_PATH.open("a", encoding="utf-8") as file_handle:
        file_handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
