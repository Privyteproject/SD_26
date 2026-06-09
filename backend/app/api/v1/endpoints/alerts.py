"""API endpoints for security alerts monitoring.

[STUB] Returns placeholder data matching the frontend's expected shape.
Real implementation will integrate with the security monitoring pipeline.

Access control:
- Read: Admin only.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import Meta, StandardResponse

router = APIRouter()


@router.get(
    "",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="List security alerts",
)
def list_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("admin")),
) -> StandardResponse:
    """[STUB] Return paginated security alerts."""
    data = [
        {"id": 1, "title": "Attempt to access unauthorized HR data", "severity": "crit", "status": "open"},
        {"id": 2, "title": "Repeated sensitive requests (payroll)", "severity": "high", "status": "progress"},
        {"id": 3, "title": "Unusual assistant usage spike", "severity": "med", "status": "resolved"},
    ]
    return StandardResponse(data=data, meta=Meta(page=page, total=len(data)))


@router.patch(
    "/{alert_id}/acknowledge",
    response_model=StandardResponse[dict[str, Any]],
    summary="Acknowledge a security alert",
)
def acknowledge_alert(
    alert_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("admin")),
) -> StandardResponse:
    """[STUB] Mark a security alert as acknowledged."""
    return StandardResponse(data={"id": str(alert_id), "status": "acknowledged"})
