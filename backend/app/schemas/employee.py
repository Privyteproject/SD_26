"""Pydantic v2 schemas for the Employee entity."""

import uuid
from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.department import DepartmentResponse


class EmployeeStatus(str, Enum):
    """Allowed status values for an employee record."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    ONBOARDING = "onboarding"
    OFFBOARDING = "offboarding"


class EmployeeBase(BaseModel):
    """Shared fields for Employee input and output."""

    first_name: str = Field(..., min_length=1, max_length=255, description="Employee first name")
    last_name: str = Field(..., min_length=1, max_length=255, description="Employee last name")
    position: str = Field(..., min_length=1, max_length=255, description="Job title or position")
    hire_date: date = Field(..., description="Date the employee was hired")
    status: EmployeeStatus = Field(
        default=EmployeeStatus.ACTIVE,
        description="Current employment status",
    )
    salary: float | None = Field(None, ge=0, description="Monthly salary (MAD)")
    address: str | None = Field(None, max_length=500, description="Residential address")
    cin: str | None = Field(
        None,
        min_length=1,
        max_length=20,
        description="Carte d'Identité Nationale (unique identifier)",
    )


class EmployeeCreate(EmployeeBase):
    """Schema for creating a new employee."""

    department_id: uuid.UUID | None = Field(None, description="FK to the department")
    manager_id: uuid.UUID | None = Field(None, description="FK to the manager (self-reference)")
    user_id: uuid.UUID | None = Field(None, description="FK to the linked user account")


class EmployeeUpdate(BaseModel):
    """Schema for updating an existing employee. All fields are optional."""

    first_name: str | None = Field(None, min_length=1, max_length=255)
    last_name: str | None = Field(None, min_length=1, max_length=255)
    position: str | None = Field(None, min_length=1, max_length=255)
    hire_date: date | None = None
    status: EmployeeStatus | None = None
    salary: float | None = Field(None, ge=0)
    address: str | None = Field(None, max_length=500)
    cin: str | None = Field(None, min_length=1, max_length=20)
    department_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


class EmployeeResponse(EmployeeBase):
    """Schema for serializing an employee in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None


class EmployeeDetailResponse(EmployeeResponse):
    """Extended response that includes nested department data."""

    department: DepartmentResponse | None = None
