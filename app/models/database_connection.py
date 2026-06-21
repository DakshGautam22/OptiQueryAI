import enum
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, LargeBinary, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.schema_metadata import SchemaMetadata
    from app.models.query_history import QueryHistory
    from app.models.audit_log import AuditLog

class DBTypeEnum(str, enum.Enum):
    postgresql = "postgresql"
    mysql = "mysql"
    sqlite = "sqlite"

class DatabaseConnection(Base):
    __tablename__ = "database_connections"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), 
        nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    db_type: Mapped[DBTypeEnum] = mapped_column(
        SQLEnum(DBTypeEnum, name="db_type_enum"), 
        nullable=False
    )
    
    # Encrypted fields stored as bytes
    host_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    database_name: Mapped[str] = mapped_column(String(255), nullable=False)
    username_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    password_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    iv: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_tested_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), 
        nullable=True
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="database_connections")
    schema_metadata: Mapped[list["SchemaMetadata"]] = relationship(
        "SchemaMetadata", 
        back_populates="database_connection", 
        cascade="all, delete-orphan"
    )
    query_history: Mapped[list["QueryHistory"]] = relationship(
        "QueryHistory", 
        back_populates="database_connection", 
        cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog", 
        back_populates="database_connection"
    )
