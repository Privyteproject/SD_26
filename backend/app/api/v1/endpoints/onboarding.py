"""API endpoints for onboarding workflow management.

[STUB] Returns placeholder data matching the frontend's expected shapes.
Real implementation will track onboarding task completion per new employee.

Access control:
- Read own: any authenticated user (own onboarding).
- Read all / manage: RH, Manager, Admin.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import StandardResponse

router = APIRouter()


@router.get(
    "/tasks",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Get onboarding tasks grouped by week",
)
def get_onboarding_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return onboarding checklist grouped by week."""
    data = [
        {"week": 1, "tasks": [
            {"id": 1, "done": True, "label": "Sign contract"},
            {"id": 2, "done": True, "label": "Set up access and equipment"},
            {"id": 3, "done": True, "label": "Office tour"},
        ]},
        {"week": 2, "tasks": [
            {"id": 4, "done": True, "label": "Read company policy"},
            {"id": 5, "done": False, "label": "Internal tools training"},
        ]},
        {"week": 3, "tasks": [
            {"id": 6, "done": False, "label": "Meet your buddy"},
            {"id": 7, "done": False, "label": "First check-in with manager"},
        ]},
        {"week": 4, "tasks": [
            {"id": 8, "done": False, "label": "Onboarding review"},
        ]},
    ]
    return StandardResponse(data=data)


@router.get(
    "/contacts",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Get onboarding key contacts",
)
def get_onboarding_contacts(
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return key contacts for the onboarding employee."""
    data = [
        {"id": 1, "role": "Manager", "name": "Sofia Alami"},
        {"id": 2, "role": "HR contact", "name": "Karim Benali"},
        {"id": 3, "role": "Buddy", "name": "Lina Cherkaoui"},
    ]
    return StandardResponse(data=data)

@router.get(
    "/new-hires",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="Get recent new hires progress",
)
def get_new_hires(
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Return recent new hires with onboarding progress."""
    data = [
        {"id": 1, "name": "Lina Cherkaoui", "dept": "Ventes", "progress": 70},
        {"id": 2, "name": "Yannick Keke", "dept": "IT", "progress": 50},
        {"id": 3, "name": "Maya Sefrioui", "dept": "Ops", "progress": 20},
    ]
    return StandardResponse(data=data)
