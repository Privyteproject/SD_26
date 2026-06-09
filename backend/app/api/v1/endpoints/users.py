"""API endpoints for user management."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import StandardResponse

router = APIRouter()


@router.get(
    "/me",
    response_model=StandardResponse[dict[str, Any]],
    summary="Get current user profile",
)
def read_user_me(
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """Return the authenticated user's profile information."""
    return StandardResponse(
        data={
            "id": str(current_user.id),
            "email": current_user.email,
            "role": current_user.role,
            "is_active": current_user.is_active,
        },
    )


@router.get(
    "",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="List all users",
)
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] List all users synced in the system. Requires admin or RH role."""
    if current_user.role not in ["admin", "rh"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    return StandardResponse(data=[])
