"""API endpoints for user notifications."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import StandardResponse

router = APIRouter()


@router.get(
    "",
    response_model=StandardResponse[list[dict[str, Any]]],
    summary="List notifications for current user",
)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] List notifications for the current user."""
    return StandardResponse(data=[])


@router.patch(
    "/{notification_id}/read",
    response_model=StandardResponse[dict[str, Any]],
    summary="Mark a notification as read",
)
def mark_notification_read(
    notification_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """[STUB] Mark a specific notification as read."""
    return StandardResponse(
        data={"id": str(notification_id), "is_read": True},
    )
