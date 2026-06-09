"""API endpoints for offboarding workflow management.

[STUB] Returns placeholder data matching the frontend's expected shapes.
Real implementation will track departing employee checklists and handover status.

Access control:
- Read / manage: RH, Manager, Admin.
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
    "/departures",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="List upcoming employee departures",
)
def list_departures(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return employees with upcoming departure dates and handover progress."""
    if current_user.role not in ["rh", "admin", "manager", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    data = [
        {"id": 1, "name": "Sami Lahlou", "date": "30 juin 2026", "progress": 60},
        {"id": 2, "name": "Clara Petit", "date": "15 juil. 2026", "progress": 25},
    ]
    return StandardResponse(data=data, meta=Meta(total=len(data)))


@router.get(
    "/steps",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="List offboarding checklist steps",
)
def list_offboarding_steps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return the standard offboarding checklist with completion status."""
    if current_user.role not in ["rh", "admin", "manager", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    data = [
        {"id": 1, "done": True, "label": "Equipment return"},
        {"id": 2, "done": True, "label": "Access revocation"},
        {"id": 3, "done": False, "label": "Handover of duties"},
        {"id": 4, "done": False, "label": "Exit interview & admin closure"},
    ]
    return StandardResponse(data=data)


@router.get(
    "/reports",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="List available HR reports",
)
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return available report templates."""
    if current_user.role not in ["rh", "admin", "direction"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    data = [
        {"id": 1, "name": "Annual social report"},
        {"id": 2, "name": "Quarterly turnover report"},
        {"id": 3, "name": "Payroll summary"},
    ]
    return StandardResponse(data=data)
