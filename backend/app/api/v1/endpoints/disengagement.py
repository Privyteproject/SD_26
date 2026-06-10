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
    """Return employees flagged by the disengagement rule-based model."""
    from sqlalchemy import func
    from app.models.hr import Employee, Absence, Department

    allowed = ["rh", "admin", "manager", "direction"]
    if current_user.role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    query = (
        db.query(Employee, Department.name.label("dept_name"), func.count(Absence.id).label("absence_count"))
        .outerjoin(Department, Employee.department_id == Department.id)
        .outerjoin(Absence, Employee.id == Absence.employee_id)
        .group_by(Employee.id, Department.name)
    )

    total = query.count()
    offset = (page - 1) * per_page
    results = query.offset(offset).limit(per_page).all()

    data = []
    for emp, dept_name, absence_count in results:
        level = "low"
        factors = []
        if absence_count > 3:
            level = "high"
            factors.append("High absenteeism")
        elif absence_count >= 1:
            level = "mid"
            factors.append("Some absences")
        else:
            factors.append("No recent alerts")

        data.append({
            "id": str(emp.id),
            "name": f"{emp.first_name} {emp.last_name}",
            "dept": dept_name or "Unknown",
            "level": level,
            "factors": ", ".join(factors),
        })

    return StandardResponse(data=data, meta=Meta(page=page, total=total))
