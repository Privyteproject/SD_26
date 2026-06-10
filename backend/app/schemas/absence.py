"""Pydantic v2 schemas for the Absence entity."""

import uuid
from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AbsenceType(str, Enum):
    """Allowed absence type values."""

    CONGE_ANNUEL = "conge_annuel"
    CONGE_MALADIE = "conge_maladie"
    CONGE_MATERNITE = "conge_maternite"
    CONGE_PATERNITE = "conge_paternite"
    CONGE_SANS_SOLDE = "conge_sans_solde"
    RTT = "rtt"
    ABSENCE_INJUSTIFIEE = "absence_injustifiee"
    AUTRE = "autre"


class AbsenceStatus(str, Enum):
    """Allowed absence status values."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AbsenceBase(BaseModel):
    """Shared fields for Absence input and output."""

    type: AbsenceType = Field(..., description="Type of absence")
    start_date: date = Field(..., description="First day of absence")
    end_date: date = Field(..., description="Last day of absence (inclusive)")

    @model_validator(mode="after")
    def validate_date_range(self) -> "AbsenceBase":
        """Ensure end_date is not before start_date."""
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class AbsenceCreate(AbsenceBase):
    """Schema for creating a new absence request."""

    employee_id: uuid.UUID = Field(..., description="FK to the employee")
    status: AbsenceStatus = Field(
        default=AbsenceStatus.PENDING,
        description="Initial status (defaults to pending)",
    )


class AbsenceUpdate(BaseModel):
    """Schema for updating an existing absence. All fields are optional."""

    type: AbsenceType | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: AbsenceStatus | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "AbsenceUpdate":
        """Ensure end_date is not before start_date when both are provided."""
        if self.start_date is not None and self.end_date is not None:
            if self.end_date < self.start_date:
                raise ValueError("end_date must be on or after start_date")
        return self


class AbsenceResponse(AbsenceBase):
    """Schema for serializing an absence in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    status: AbsenceStatus
