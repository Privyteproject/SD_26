"""CRUD endpoints for Employee management.

Access control:
- List / Read: any authenticated active user.
- Create / Update / Delete: RH or Admin only.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_role
from app.db.session import get_db
from app.models.hr import Department, Employee
from app.models.user import User
from app.schemas.base import Meta, StandardResponse
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeDetailResponse,
    EmployeeResponse,
    EmployeeStatus,
    EmployeeUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=StandardResponse[list[EmployeeResponse]],
    summary="List employees with optional filters",
)
def list_employees(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    department_id: uuid.UUID | None = Query(None, description="Filter by department"),
    status_filter: EmployeeStatus | None = Query(
        None, alias="status", description="Filter by employment status"
    ),
    search: str | None = Query(
        None, min_length=1, max_length=100, description="Search by name or CIN"
    ),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StandardResponse[list[EmployeeResponse]]:
    """Return a paginated, filterable list of employees."""
    query = db.query(Employee)

    if department_id is not None:
        query = query.filter(Employee.department_id == department_id)
    if status_filter is not None:
        query = query.filter(Employee.status == status_filter.value)
    if search is not None:
        pattern = f"%{search}%"
        query = query.filter(
            (Employee.first_name.ilike(pattern))
            | (Employee.last_name.ilike(pattern))
            | (Employee.cin.ilike(pattern))
        )

    total = query.count()
    offset = (page - 1) * per_page
    employees = (
        query
        .order_by(Employee.last_name, Employee.first_name)
        .offset(offset)
        .limit(per_page)
        .all()
    )
    return StandardResponse(
        data=[EmployeeResponse.model_validate(e) for e in employees],
        meta=Meta(page=page, total=total),
    )


# ---------------------------------------------------------------------------
# GET BY ID (detailed, with nested department)
# ---------------------------------------------------------------------------

@router.get(
    "/{employee_id}",
    response_model=StandardResponse[EmployeeDetailResponse],
    summary="Get an employee by ID",
)
def get_employee(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StandardResponse[EmployeeDetailResponse]:
    """Return a single employee with their department details."""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {employee_id} not found",
        )
    return StandardResponse(data=EmployeeDetailResponse.model_validate(employee))


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=StandardResponse[EmployeeResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new employee",
)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> StandardResponse[EmployeeResponse]:
    """Create an employee record. Requires RH or Admin role."""
    # Validate CIN uniqueness
    if payload.cin is not None:
        existing = db.query(Employee).filter(Employee.cin == payload.cin).first()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Employee with CIN '{payload.cin}' already exists",
            )

    # Validate FK references
    if payload.department_id is not None:
        dept = db.query(Department).filter(Department.id == payload.department_id).first()
        if dept is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Department {payload.department_id} does not exist",
            )

    if payload.manager_id is not None:
        manager = db.query(Employee).filter(Employee.id == payload.manager_id).first()
        if manager is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Manager {payload.manager_id} does not exist",
            )

    employee = Employee(**payload.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return StandardResponse(data=EmployeeResponse.model_validate(employee))


# ---------------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------------

@router.patch(
    "/{employee_id}",
    response_model=StandardResponse[EmployeeResponse],
    summary="Update an employee",
)
def update_employee(
    employee_id: uuid.UUID,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> StandardResponse[EmployeeResponse]:
    """Partially update an employee. Requires RH or Admin role."""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {employee_id} not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Validate CIN uniqueness if being changed
    if "cin" in update_data and update_data["cin"] is not None:
        conflict = (
            db.query(Employee)
            .filter(Employee.cin == update_data["cin"], Employee.id != employee_id)
            .first()
        )
        if conflict is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Employee with CIN '{update_data['cin']}' already exists",
            )

    # Validate FK references if being changed
    if "department_id" in update_data and update_data["department_id"] is not None:
        dept = db.query(Department).filter(Department.id == update_data["department_id"]).first()
        if dept is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Department {update_data['department_id']} does not exist",
            )

    if "manager_id" in update_data and update_data["manager_id"] is not None:
        if update_data["manager_id"] == employee_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="An employee cannot be their own manager",
            )
        manager = db.query(Employee).filter(Employee.id == update_data["manager_id"]).first()
        if manager is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Manager {update_data['manager_id']} does not exist",
            )

    for field, value in update_data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return StandardResponse(data=EmployeeResponse.model_validate(employee))


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

@router.delete(
    "/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an employee",
)
def delete_employee(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> None:
    """Delete an employee record. Requires RH or Admin role."""
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {employee_id} not found",
        )
    db.delete(employee)
    db.commit()
