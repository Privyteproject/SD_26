"""API endpoints for disengagement risk analysis.

[STUB] Returns placeholder data matching the frontend's expected shape.
Real implementation will use AI-driven analysis of absence patterns,
performance metrics, and engagement signals.

Access control:
- Read: RH, Manager, Direction, Medecine du travail.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import Meta, StandardResponse

router = APIRouter()


@router.get(
    "/risks",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="List employees at risk of disengagement",
)
def list_risk_employees(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return employees flagged by the disengagement detection model."""
    allowed = ["rh", "admin", "manager", "direction"]
    if current_user.role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    data = [
        {"id": 1, "name": "Adam Roux", "dept": "Ops", "level": "high", "factors": "Workload ↑, absences ↑"},
        {"id": 2, "name": "Inès Faured", "dept": "Ventes", "level": "mid", "factors": "Activity drop"},
        {"id": 3, "name": "Omar Tazi", "dept": "IT", "level": "low", "factors": "Lower feedback"},
    ]
    return StandardResponse(data=data, meta=Meta(page=page, total=len(data)))
