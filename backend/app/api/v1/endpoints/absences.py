"""CRUD endpoints for Absence management.

Access control:
- List / Read: any authenticated active user (can filter to own absences).
- Create: any authenticated active user (creates for self or, if RH/Admin, for any employee).
- Update (approve/reject): RH or Admin only.
- Delete: RH or Admin only.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_role
from app.db.session import get_db
from app.models.hr import Absence, Employee
from app.models.user import User
from app.schemas.absence import (
    AbsenceCreate,
    AbsenceResponse,
    AbsenceStatus,
    AbsenceType,
    AbsenceUpdate,
)
from app.schemas.base import Meta, StandardResponse

router = APIRouter()


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=StandardResponse[list[AbsenceResponse]],
    summary="List absences with optional filters",
)
def list_absences(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    employee_id: uuid.UUID | None = Query(None, description="Filter by employee"),
    status_filter: AbsenceStatus | None = Query(
        None, alias="status", description="Filter by absence status"
    ),
    type_filter: AbsenceType | None = Query(
        None, alias="type", description="Filter by absence type"
    ),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StandardResponse[list[AbsenceResponse]]:
    """Return a paginated, filterable list of absences."""
    query = db.query(Absence)

    if employee_id is not None:
        query = query.filter(Absence.employee_id == employee_id)
    if status_filter is not None:
        query = query.filter(Absence.status == status_filter.value)
    if type_filter is not None:
        query = query.filter(Absence.type == type_filter.value)

    total = query.count()
    offset = (page - 1) * per_page
    absences = (
        query
        .order_by(Absence.start_date.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )
    return StandardResponse(
        data=[AbsenceResponse.model_validate(a) for a in absences],
        meta=Meta(page=page, total=total),
    )


# ---------------------------------------------------------------------------
# GET BY ID
# ---------------------------------------------------------------------------

@router.get(
    "/{absence_id}",
    response_model=StandardResponse[AbsenceResponse],
    summary="Get an absence by ID",
)
def get_absence(
    absence_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StandardResponse[AbsenceResponse]:
    """Return a single absence record."""
    absence = db.query(Absence).filter(Absence.id == absence_id).first()
    if absence is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Absence {absence_id} not found",
        )
    return StandardResponse(data=AbsenceResponse.model_validate(absence))


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=StandardResponse[AbsenceResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new absence request",
)
def create_absence(
    payload: AbsenceCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StandardResponse[AbsenceResponse]:
    """Create an absence request.

    Any authenticated user can create an absence. The employee_id
    in the payload determines whose record is being created.
    Non-RH/Admin users should only create absences for their own
    linked employee profile.
    """
    # Validate that the referenced employee exists
    employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Employee {payload.employee_id} does not exist",
        )

    # Non-privileged users can only create absences for themselves
    if _current_user.role not in ("rh", "admin"):
        if employee.user_id != _current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create absence requests for your own profile",
            )

    absence = Absence(**payload.model_dump())
    db.add(absence)
    db.commit()
    db.refresh(absence)
    return StandardResponse(data=AbsenceResponse.model_validate(absence))


# ---------------------------------------------------------------------------
# UPDATE (approve / reject / modify)
# ---------------------------------------------------------------------------

@router.patch(
    "/{absence_id}",
    response_model=StandardResponse[AbsenceResponse],
    summary="Update an absence (approve, reject, or modify)",
)
def update_absence(
    absence_id: uuid.UUID,
    payload: AbsenceUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> StandardResponse[AbsenceResponse]:
    """Update an absence record. Requires RH or Admin role.

    Typically used to approve or reject a pending request.
    """
    absence = db.query(Absence).filter(Absence.id == absence_id).first()
    if absence is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Absence {absence_id} not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Re-validate date range if both dates are being changed together
    # (Pydantic model_validator handles the case where both are in payload,
    # but we also need to cross-check against existing values)
    new_start = update_data.get("start_date", absence.start_date)
    new_end = update_data.get("end_date", absence.end_date)
    if new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date",
        )

    for field, value in update_data.items():
        setattr(absence, field, value)

    db.commit()
    db.refresh(absence)
    return StandardResponse(data=AbsenceResponse.model_validate(absence))


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

@router.delete(
    "/{absence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an absence",
)
def delete_absence(
    absence_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> None:
    """Delete an absence record. Requires RH or Admin role."""
    absence = db.query(Absence).filter(Absence.id == absence_id).first()
    if absence is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Absence {absence_id} not found",
        )
    db.delete(absence)
    db.commit()
