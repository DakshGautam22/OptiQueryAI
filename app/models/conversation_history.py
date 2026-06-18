import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base

class ChatRoleEnum(str, enum.Enum):
    user = "user"
    assistant = "assistant"

class ConversationHistory(Base):
    __tablename__ = "conversation_history"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )
    role: Mapped[ChatRoleEnum] = mapped_column(
        SQLEnum(ChatRoleEnum, name="chat_role_enum"), 
        nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sql_generated: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="conversation_history")
