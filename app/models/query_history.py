import uuid
from datetime import datetime
from typing import Any, Optional
from sqlalchemy import Text, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base

class QueryHistory(Base):
    __tablename__ = "query_history"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("database_connections.id", ondelete="CASCADE"), 
        nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    
    natural_language: Mapped[str] = mapped_column(Text, nullable=False)
    generated_sql: Mapped[str] = mapped_column(Text, nullable=False)
    optimized_sql: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Store performance breakdown and optimizations as JSON
    optimization_report: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    
    execution_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="query_history")
    database_connection: Mapped["DatabaseConnection"] = relationship(
        "DatabaseConnection", 
        back_populates="query_history"
    )
