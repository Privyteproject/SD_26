"""API endpoints for bulk data imports."""

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import StandardResponse

router = APIRouter()


@router.post(
    "/employees",
    response_model=StandardResponse[dict[str, Any]],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Bulk import employees from CSV/Excel",
)
async def import_employees(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse:
    """
    [STUB] Bulk import employees from a CSV or Excel file.

    Currently acts as a placeholder. Full parsing logic will be implemented later.
    """
    if current_user.role not in ["rh", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    return StandardResponse(
        data={"filename": file.filename, "status": "stub_received"},
    )
