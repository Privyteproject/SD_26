"""CRUD endpoints for Department management.

Access control:
- Read: any authenticated active user.
- Create / Update / Delete: RH or Admin only.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_role
from app.db.session import get_db
from app.models.hr import Department
from app.models.user import User
from app.schemas.base import Meta, StandardResponse
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=StandardResponse[list[DepartmentResponse]],
    summary="List all departments",
)
def list_departments(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StandardResponse[list[DepartmentResponse]]:
    """Return a paginated list of departments."""
    total = db.query(Department).count()
    offset = (page - 1) * per_page
    departments = (
        db.query(Department)
        .order_by(Department.name)
        .offset(offset)
        .limit(per_page)
        .all()
    )
    return StandardResponse(
        data=[DepartmentResponse.model_validate(d) for d in departments],
        meta=Meta(page=page, total=total),
    )


# ---------------------------------------------------------------------------
# GET BY ID
# ---------------------------------------------------------------------------

@router.get(
    "/{department_id}",
    response_model=StandardResponse[DepartmentResponse],
    summary="Get a department by ID",
)
def get_department(
    department_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StandardResponse[DepartmentResponse]:
    """Return a single department by its UUID."""
    department = db.query(Department).filter(Department.id == department_id).first()
    if department is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department {department_id} not found",
        )
    return StandardResponse(data=DepartmentResponse.model_validate(department))


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=StandardResponse[DepartmentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new department",
)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> StandardResponse[DepartmentResponse]:
    """Create a department. Requires RH or Admin role."""
    existing = db.query(Department).filter(Department.name == payload.name).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department with name '{payload.name}' already exists",
        )
    department = Department(**payload.model_dump())
    db.add(department)
    db.commit()
    db.refresh(department)
    return StandardResponse(data=DepartmentResponse.model_validate(department))


# ---------------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------------

@router.patch(
    "/{department_id}",
    response_model=StandardResponse[DepartmentResponse],
    summary="Update a department",
)
def update_department(
    department_id: uuid.UUID,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> StandardResponse[DepartmentResponse]:
    """Partially update a department. Requires RH or Admin role."""
    department = db.query(Department).filter(Department.id == department_id).first()
    if department is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department {department_id} not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Check name uniqueness if name is being changed
    if "name" in update_data:
        conflict = (
            db.query(Department)
            .filter(Department.name == update_data["name"], Department.id != department_id)
            .first()
        )
        if conflict is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Department with name '{update_data['name']}' already exists",
            )

    for field, value in update_data.items():
        setattr(department, field, value)

    db.commit()
    db.refresh(department)
    return StandardResponse(data=DepartmentResponse.model_validate(department))


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

@router.delete(
    "/{department_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a department",
)
def delete_department(
    department_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> None:
    """Delete a department. Requires RH or Admin role."""
    department = db.query(Department).filter(Department.id == department_id).first()
    if department is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department {department_id} not found",
        )
    db.delete(department)
    db.commit()
