"""Pydantic v2 schemas for the Document entity."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class DocumentType(str, Enum):
    """Allowed document type values."""

    CONTRAT = "contrat"
    ATTESTATION = "attestation"
    FICHE_PAIE = "fiche_paie"
    CV = "cv"
    PIECE_IDENTITE = "piece_identite"
    FORMULAIRE = "formulaire"
    COURRIER = "courrier"
    AUTRE = "autre"


class DocumentBase(BaseModel):
    """Shared fields for Document input and output."""

    type: DocumentType = Field(..., description="Category of the document")
    file_name: str = Field(..., min_length=1, max_length=500, description="Original file name")


class DocumentCreate(DocumentBase):
    """Schema for registering a new document after upload to MinIO."""

    employee_id: uuid.UUID = Field(..., description="FK to the owning employee")
    minio_object_key: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Object key referencing the file in MinIO storage",
    )


class DocumentResponse(DocumentBase):
    """Schema for serializing a document in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    minio_object_key: str
    created_at: datetime
