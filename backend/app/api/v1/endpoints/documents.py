"""CRUD endpoints for Document metadata management.

Documents are stored in MinIO. These endpoints manage the metadata
records in PostgreSQL. File upload/download is handled separately
through MinIO pre-signed URLs.

Access control:
- List / Read: any authenticated active user.
- Create / Delete: RH or Admin only.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_role
from app.db.session import get_db
from app.models.hr import Document, Employee
from app.models.user import User
from app.schemas.base import Meta, StandardResponse
from app.schemas.document import DocumentCreate, DocumentResponse, DocumentType

router = APIRouter()


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=StandardResponse[list[DocumentResponse]],
    summary="List documents with optional filters",
)
def list_documents(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    employee_id: uuid.UUID | None = Query(None, description="Filter by employee"),
    type_filter: DocumentType | None = Query(
        None, alias="type", description="Filter by document type"
    ),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StandardResponse[list[DocumentResponse]]:
    """Return a paginated, filterable list of document metadata records."""
    query = db.query(Document)

    if employee_id is not None:
        query = query.filter(Document.employee_id == employee_id)
    if type_filter is not None:
        query = query.filter(Document.type == type_filter.value)

    total = query.count()
    offset = (page - 1) * per_page
    documents = (
        query
        .order_by(Document.created_at.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )
    return StandardResponse(
        data=[DocumentResponse.model_validate(d) for d in documents],
        meta=Meta(page=page, total=total),
    )


# ---------------------------------------------------------------------------
# GET BY ID
# ---------------------------------------------------------------------------

@router.get(
    "/{document_id}",
    response_model=StandardResponse[DocumentResponse],
    summary="Get a document by ID",
)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
) -> StandardResponse[DocumentResponse]:
    """Return a single document metadata record."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )
    return StandardResponse(data=DocumentResponse.model_validate(document))


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=StandardResponse[DocumentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new document (after upload to MinIO)",
)
def create_document(
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> StandardResponse[DocumentResponse]:
    """Register document metadata after the file has been uploaded to MinIO.

    Requires RH or Admin role.
    """
    # Validate that the referenced employee exists
    employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Employee {payload.employee_id} does not exist",
        )

    # Validate MinIO key uniqueness
    existing = (
        db.query(Document)
        .filter(Document.minio_object_key == payload.minio_object_key)
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Document with MinIO key '{payload.minio_object_key}' already registered",
        )

    document = Document(**payload.model_dump())
    db.add(document)
    db.commit()
    db.refresh(document)
    return StandardResponse(data=DocumentResponse.model_validate(document))


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document record",
)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("rh", "admin")),
) -> None:
    """Delete a document metadata record. Requires RH or Admin role.

    Note: This does NOT delete the file from MinIO. Object storage
    cleanup should be handled separately.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found",
        )
    db.delete(document)
    db.commit()
