from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.declarative import declared_attr
import uuid

class Base(DeclarativeBase):
    id: uuid.UUID
    __name__: str

    # Generate __tablename__ automatically
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s"
