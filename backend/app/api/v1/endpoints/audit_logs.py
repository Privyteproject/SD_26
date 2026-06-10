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
    """Return paginated audit log entries."""
    from app.models.system import AuditLog

    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    total = query.count()
    offset = (page - 1) * per_page
    logs = query.offset(offset).limit(per_page).all()

    data = []
    for log in logs:
        data.append({
            "id": str(log.id),
            "time": log.created_at.strftime("%Y-%m-%d %H:%M"),
            "actor": str(log.user_id) if log.user_id else "system",
            "action": log.action
        })

    return StandardResponse(data=data, meta=Meta(page=page, total=total))
