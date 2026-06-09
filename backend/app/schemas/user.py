"""Pydantic v2 schemas for the User entity."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRole(str, Enum):
    """Allowed user roles matching the RBAC matrix."""

    COLLABORATEUR = "collaborateur"
    MANAGER = "manager"
    RH = "rh"
    DIRECTION = "direction"
    ADMIN = "admin"


class UserBase(BaseModel):
    """Shared fields for User input and output."""

    email: EmailStr = Field(..., description="Unique email address")
    role: UserRole = Field(..., description="RBAC role assigned to the user")
    is_active: bool = Field(default=True, description="Whether the account is active")


class UserCreate(UserBase):
    """Schema for creating a new user (typically after Keycloak registration)."""

    keycloak_sub: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Keycloak subject identifier (unique)",
    )


class UserUpdate(BaseModel):
    """Schema for updating an existing user. All fields are optional."""

    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserResponse(UserBase):
    """Schema for serializing a user in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    keycloak_sub: str
    created_at: datetime
