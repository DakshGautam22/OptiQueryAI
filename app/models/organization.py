import enum
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base

class PlanEnum(str, enum.Enum):
    free = "free"
    pro = "pro"
    enterprise = "enterprise"

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[PlanEnum] = mapped_column(
        SQLEnum(PlanEnum, name="plan_enum"), 
        nullable=False, 
        default=PlanEnum.free
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User", 
        back_populates="organization", 
        cascade="all, delete-orphan"
    )
    database_connections: Mapped[list["DatabaseConnection"]] = relationship(
        "DatabaseConnection", 
        back_populates="organization", 
        cascade="all, delete-orphan"
    )
