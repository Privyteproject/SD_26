"""API endpoints for audit log access.

[STUB] Returns placeholder data matching the frontend's expected shape.
Real implementation will query the AuditLog model from app.models.system.

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


@router.get(
    "",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="List audit log entries",
)
def list_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("admin", "rh")),
) -> StandardResponse:
    """[STUB] Return paginated audit log entries."""
    data = [
        {"id": 1, "time": "2026-06-03 09:20", "actor": "admin@synapse", "action": "Role changed: K. Benali → HR"},
        {"id": 2, "time": "2026-06-03 08:58", "actor": "system", "action": "Critical alert generated"},
        {"id": 3, "time": "2026-06-02 17:40", "actor": "admin@synapse", "action": "Account disabled: S. Lahlou"},
    ]
    return StandardResponse(data=data, meta=Meta(page=page, total=len(data)))
