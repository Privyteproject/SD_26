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
    """[STUB] Return employee count grouped by department."""
    if current_user.role not in ["rh", "admin", "manager", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    # Stub data matching frontend HEADCOUNT_BY_DEPT shape
    data = [
        {"d": "IT", "v": 64},
        {"d": "Ventes", "v": 52},
        {"d": "RH", "v": 18},
        {"d": "Finance", "v": 31},
        {"d": "Ops", "v": 83},
    ]
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
    """[STUB] Return monthly absence rate percentage."""
    if current_user.role not in ["rh", "admin", "manager", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    data = [
        {"m": "Jan", "v": 3.4}, {"m": "Fév", "v": 3.1}, {"m": "Mar", "v": 3.8},
        {"m": "Avr", "v": 2.9}, {"m": "Mai", "v": 3.2}, {"m": "Juin", "v": 2.7},
    ]
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
    """[STUB] Return daily absence count for the current week."""
    if current_user.role not in ["rh", "admin", "manager", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    data = [
        {"d": "Lun", "v": 1}, {"d": "Mar", "v": 2}, {"d": "Mer", "v": 0},
        {"d": "Jeu", "v": 1}, {"d": "Ven", "v": 3},
    ]
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
