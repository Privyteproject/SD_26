"""API endpoints for analytics and dashboard KPIs.

[STUB] Returns placeholder data matching the frontend's expected shapes.
Real implementations will aggregate from Employee, Absence, and Payroll tables.

Access control:
- Headcount / Absence trends: RH, Manager, Direction.
- Payroll: RH, Direction only.
- Turnover predictions: RH, Direction only.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import StandardResponse

router = APIRouter()


# ---------------------------------------------------------------------------
# Headcount by department
# ---------------------------------------------------------------------------

@router.get(
    "/headcount",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Headcount breakdown by department",
)
def get_headcount(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    from sqlalchemy import func
    from app.models.hr import Department, Employee

    query = (
        db.query(Department.name.label("d"), func.count(Employee.id).label("v"))
        .outerjoin(Employee, Department.id == Employee.department_id)
        .group_by(Department.name)
        .all()
    )
    data = [{"d": row.d, "v": row.v} for row in query]
    return StandardResponse(data=data)


# ---------------------------------------------------------------------------
# Absence trend
# ---------------------------------------------------------------------------

@router.get(
    "/absences",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Monthly absence rate trend",
)
def get_absence_trend(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """Return monthly absence count trend."""
    if current_user.role not in ["rh", "admin", "manager", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    from app.models.hr import Absence
    import datetime
    
    months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"]
    today = datetime.date.today()
    data = []
    
    month = today.month
    year = today.year
    for _ in range(6):
        target_date = datetime.date(year, month, 1)
        next_month = month + 1 if month < 12 else 1
        next_year = year if month < 12 else year + 1
        end_of_month = datetime.date(next_year, next_month, 1) - datetime.timedelta(days=1)

        count = db.query(Absence).filter(
            Absence.start_date <= end_of_month,
            Absence.end_date >= target_date
        ).count()
        data.insert(0, {"m": months[month - 1], "v": count})
        
        month -= 1
        if month == 0:
            month = 12
            year -= 1

    return StandardResponse(data=data)


# ---------------------------------------------------------------------------
# Turnover trend (with AI predictions)
# ---------------------------------------------------------------------------

@router.get(
    "/turnover",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Turnover trend with predictions",
)
def get_turnover_trend(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return turnover rate trend with AI-predicted values."""
    if current_user.role not in ["rh", "admin", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    data = [
        {"m": "Jan", "real": 9.1, "pred": None}, {"m": "Fév", "real": 8.8, "pred": None},
        {"m": "Mar", "real": 8.5, "pred": None}, {"m": "Avr", "real": 8.3, "pred": None},
        {"m": "Mai", "real": 8.2, "pred": 8.2}, {"m": "Juin", "real": None, "pred": 7.9},
        {"m": "Juil", "real": None, "pred": 7.6}, {"m": "Aoû", "real": None, "pred": 7.4},
    ]
    return StandardResponse(data=data)


# ---------------------------------------------------------------------------
# Payroll trend
# ---------------------------------------------------------------------------

@router.get(
    "/payroll",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Monthly payroll mass trend (millions MAD)",
)
def get_payroll_trend(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return monthly payroll mass trend."""
    if current_user.role not in ["rh", "admin", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    data = [
        {"m": "Jan", "v": 1.82}, {"m": "Fév", "v": 1.85}, {"m": "Mar", "v": 1.88},
        {"m": "Avr", "v": 1.90}, {"m": "Mai", "v": 1.93}, {"m": "Juin", "v": 1.97},
    ]
    return StandardResponse(data=data)


# ---------------------------------------------------------------------------
# Team absence for current week
# ---------------------------------------------------------------------------

@router.get(
    "/team-absences",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Team absences for the current week",
)
def get_team_absence_week(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """Return daily absence count for the current week."""
    if current_user.role not in ["rh", "admin", "manager", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    from app.models.hr import Absence
    import datetime

    today = datetime.date.today()
    start_of_week = today - datetime.timedelta(days=today.weekday())
    
    days_fr = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    data = []

    # Monday to Friday
    for i in range(5):
        target_day = start_of_week + datetime.timedelta(days=i)
        count = db.query(Absence).filter(
            Absence.start_date <= target_day,
            Absence.end_date >= target_day
        ).count()
        data.append({"d": days_fr[i], "v": count})

    return StandardResponse(data=data)


# ---------------------------------------------------------------------------
# Engagement trend (personal dashboard)
# ---------------------------------------------------------------------------

@router.get(
    "/engagement",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Monthly engagement score trend",
)
def get_engagement_trend(
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return monthly engagement score trend."""
    data = [
        {"m": "Jan", "v": 72}, {"m": "Fév", "v": 70}, {"m": "Mar", "v": 74},
        {"m": "Avr", "v": 78}, {"m": "Mai", "v": 80}, {"m": "Juin", "v": 84},
    ]
    return StandardResponse(data=data)
