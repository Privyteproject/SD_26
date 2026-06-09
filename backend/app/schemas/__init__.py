"""Pydantic v2 schemas package.

Re-exports all entity schemas for convenient imports:
    from app.schemas import EmployeeCreate, EmployeeResponse
"""

from app.schemas.absence import (
    AbsenceCreate,
    AbsenceResponse,
    AbsenceStatus,
    AbsenceType,
    AbsenceUpdate,
)
from app.schemas.base import ErrorDetail, Meta, StandardResponse
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.schemas.document import DocumentCreate, DocumentResponse, DocumentType
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeDetailResponse,
    EmployeeResponse,
    EmployeeStatus,
    EmployeeUpdate,
)
from app.schemas.user import UserCreate, UserResponse, UserRole, UserUpdate

__all__ = [
    # Base
    "StandardResponse",
    "Meta",
    "ErrorDetail",
    # Department
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentResponse",
    # Employee
    "EmployeeCreate",
    "EmployeeUpdate",
    "EmployeeResponse",
    "EmployeeDetailResponse",
    "EmployeeStatus",
    # Absence
    "AbsenceCreate",
    "AbsenceUpdate",
    "AbsenceResponse",
    "AbsenceType",
    "AbsenceStatus",
    # Document
    "DocumentCreate",
    "DocumentResponse",
    "DocumentType",
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserRole",
]
