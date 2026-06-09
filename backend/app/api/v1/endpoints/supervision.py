"""API endpoints for AI supervision and monitoring.

[STUB] Returns placeholder data matching the frontend's expected shapes.
Real implementation will integrate with the AI pipeline audit trail.

Access control:
- Read: Admin only.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import Meta, StandardResponse

router = APIRouter()


# ---------------------------------------------------------------------------
# AI usage trend
# ---------------------------------------------------------------------------

@router.get(
    "/usage",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="AI assistant usage trend (daily queries)",
)
def get_ai_usage_trend(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("admin")),
) -> StandardResponse:
    """[STUB] Return daily AI query volume for the past week."""
    data = [
        {"m": "Lun", "v": 320}, {"m": "Mar", "v": 410}, {"m": "Mer", "v": 380},
        {"m": "Jeu", "v": 460}, {"m": "Ven", "v": 520}, {"m": "Sam", "v": 120},
        {"m": "Dim", "v": 90},
    ]
    return StandardResponse(data=data)


# ---------------------------------------------------------------------------
# Critical events
# ---------------------------------------------------------------------------

@router.get(
    "/events",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Recent critical AI events",
)
def get_critical_events(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("admin")),
) -> StandardResponse:
    """[STUB] Return recent critical events from the AI pipeline."""
    data = [
        {"id": 1, "time": "09:12", "type": "Unauthorized request", "role": "MANAGER", "severity": "high"},
        {"id": 2, "time": "08:47", "type": "Repeated attempt", "role": "COLLABORATEUR", "severity": "med"},
        {"id": 3, "time": "08:05", "type": "Access denied", "role": "COLLABORATEUR", "severity": "low"},
    ]
    return StandardResponse(data=data)


# ---------------------------------------------------------------------------
# IA interaction logs
# ---------------------------------------------------------------------------

@router.get(
    "/logs",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="AI interaction audit logs",
)
def get_ia_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("admin")),
) -> StandardResponse:
    """[STUB] Return paginated AI interaction audit logs."""
    data = [
        {"id": 1, "time": "2026-06-03 09:12", "role": "MANAGER", "type": "Other team data", "verdict": "refused"},
        {"id": 2, "time": "2026-06-03 09:03", "role": "RH", "type": "Leave policy", "verdict": "allowed"},
        {"id": 3, "time": "2026-06-03 08:47", "role": "COLLABORATEUR", "type": "Repeated · payroll", "verdict": "flagged"},
        {"id": 4, "time": "2026-06-03 08:30", "role": "COLLABORATEUR", "type": "Leave balance", "verdict": "allowed"},
    ]
    return StandardResponse(data=data, meta=Meta(page=page, total=len(data)))
