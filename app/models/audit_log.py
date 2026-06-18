import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=True
    )
    connection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("database_connections.id", ondelete="SET NULL"), 
        nullable=True
    )
    
    # Store cryptographic SHA-256 hash of executed SQL
    sql_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    # Store a preview (first 200 characters) of the SQL query for display
    sql_preview: Mapped[str] = mapped_column(String(200), nullable=False)
    
    execution_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)  # Fits IPv6 addresses
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")
    database_connection: Mapped[Optional["DatabaseConnection"]] = relationship(
        "DatabaseConnection", 
        back_populates="audit_logs"
    )
