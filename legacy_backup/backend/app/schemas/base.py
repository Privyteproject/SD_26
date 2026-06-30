from typing import Generic, TypeVar, Any
from pydantic import BaseModel, Field

DataT = TypeVar('DataT')

class Meta(BaseModel):
    page: int = 1
    total: int = 0
    # Additional metadata fields like per_page, total_pages can be added here

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None

class StandardResponse(BaseModel, Generic[DataT]):
    data: DataT | None = None
    meta: Meta | None = Field(default_factory=Meta)
    errors: list[ErrorDetail] | None = None

# Example Usage:
# @router.get("/employees", response_model=StandardResponse[list[EmployeeSchema]])
# def get_employees(): ...
