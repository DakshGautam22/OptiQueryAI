import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base

class SchemaMetadata(Base):
    __tablename__ = "schema_metadata"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("database_connections.id", ondelete="CASCADE"), 
        nullable=False
    )
    table_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    column_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data_type: Mapped[str] = mapped_column(String(100), nullable=False)
    
    is_pk: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_fk: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    ref_table: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ref_column: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    database_connection: Mapped["DatabaseConnection"] = relationship(
        "DatabaseConnection", 
        back_populates="schema_metadata"
    )
