"""Pydantic v2 schemas for the Department entity."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepartmentBase(BaseModel):
    """Shared fields for Department input and output."""

    name: str = Field(..., min_length=1, max_length=255, description="Unique department name")
    description: str | None = Field(None, max_length=1000, description="Optional department description")


class DepartmentCreate(DepartmentBase):
    """Schema for creating a new department."""

    pass


class DepartmentUpdate(BaseModel):
    """Schema for updating an existing department. All fields are optional."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)


class DepartmentResponse(DepartmentBase):
    """Schema for serializing a department in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
