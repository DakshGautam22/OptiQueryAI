import uuid
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.database_connection import DatabaseConnection
from app.models.conversation_history import ConversationHistory, ChatRoleEnum
from app.services.pipeline_service import PipelineService

router = APIRouter()
pipeline_service = PipelineService()

# --- Pydantic Schemas ---

class ChatMessageRequest(BaseModel):
    session_id: Optional[uuid.UUID] = None
    connection_id: uuid.UUID
    message: str


class ChatMessageResponse(BaseModel):
    session_id: uuid.UUID
    response: str
    sql_generated: Optional[str] = None
    optimized_sql: Optional[str] = None
    explanation_steps: list[str] = []


class ChatSessionResponse(BaseModel):
    session_id: uuid.UUID
    last_message: str
    created_at: Any


# --- Endpoints ---

@router.post("/message", response_model=ChatMessageResponse)
async def send_chat_message(
    payload: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Interact with the chatbot, keeping track of the last 6 messages in the conversation history."""
    # 1. Ensure connection exists and user has access
    conn_result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == payload.connection_id,
            DatabaseConnection.org_id == current_user.org_id
        )
    )
    connection = conn_result.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )

    session_id = payload.session_id or uuid.uuid4()

    # 2. Retrieve last 6 turns from conversation history
    history_query = (
        select(ConversationHistory)
        .where(
            and_(
                ConversationHistory.session_id == session_id,
                ConversationHistory.user_id == current_user.id
            )
        )
        .order_by(ConversationHistory.created_at.asc())
    )
    history_result = await db.execute(history_query)
    history_rows = history_result.scalars().all()
    
    # Format for agent intent/SQL generator
    formatted_history = [
        {"role": row.role.value, "content": row.content}
        for row in history_rows
    ]
    
    # 3. Save User message to history
    user_msg = ConversationHistory(
        session_id=session_id,
        user_id=current_user.id,
        role=ChatRoleEnum.user,
        content=payload.message
    )
    db.add(user_msg)
    await db.flush()  # Save in transaction block

    # 4. Execute Multi-Agent pipeline
    result = await pipeline_service.run_pipeline(
        question=payload.message,
        connection_id=payload.connection_id,
        db_type=connection.db_type.value,
        conversation_history=formatted_history,
        db=db
    )

    sql_out = None
    opt_sql_out = None
    explanation_steps = []
    response_text = ""

    if result.get("success", False):
        val_valid = result["validation"]["valid"]
        if val_valid:
            sql_out = result["generated_sql"]
            opt_sql_out = result["optimized_sql"]
            explanation_steps = result["explanation_steps"]
            steps_joined = "\n".join(explanation_steps)
            response_text = (
                f"I have generated the SQL query based on your request:\n\n"
                f"**Query Explanation:**\n{steps_joined}"
            )
        else:
            errors_joined = "; ".join(result["validation"]["errors"])
            response_text = f"I formulated a SQL query, but it failed validation checks:\n\n{errors_joined}"
    else:
        response_text = f"I failed to translate your request: {result.get('error_message')}"

    # 5. Save Assistant response to history
    assistant_msg = ConversationHistory(
        session_id=session_id,
        user_id=current_user.id,
        role=ChatRoleEnum.assistant,
        content=response_text,
        sql_generated=opt_sql_out or sql_out
    )
    db.add(assistant_msg)
    await db.commit()

    return {
        "session_id": session_id,
        "response": response_text,
        "sql_generated": sql_out,
        "optimized_sql": opt_sql_out,
        "explanation_steps": explanation_steps
    }


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List all unique chat sessions along with their latest message and timestamp."""
    # Find session_id, maximum created_at, and last message content
    # We query sub-select for latest message per session_id
    subq = (
        select(
            ConversationHistory.session_id,
            func.max(ConversationHistory.created_at).label("max_created")
        )
        .where(ConversationHistory.user_id == current_user.id)
        .group_by(ConversationHistory.session_id)
        .subquery()
    )

    query = (
        select(ConversationHistory)
        .join(
            subq,
            and_(
                ConversationHistory.session_id == subq.c.session_id,
                ConversationHistory.created_at == subq.c.max_created
            )
        )
        .order_by(ConversationHistory.created_at.desc())
    )

    result = await db.execute(query)
    rows = result.scalars().all()

    return [
        {
            "session_id": r.session_id,
            "last_message": r.content[:100],  # Return snippet
            "created_at": r.created_at
        }
        for r in rows
    ]


@router.get("/sessions/{id}")
async def get_session_messages(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Retrieve full chronological conversation log for the given session ID."""
    query = (
        select(ConversationHistory)
        .where(
            and_(
                ConversationHistory.session_id == id,
                ConversationHistory.user_id == current_user.id
            )
        )
        .order_by(ConversationHistory.created_at.asc())
    )
    result = await db.execute(query)
    rows = result.scalars().all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation session not found"
        )

    return [
        {
            "id": r.id,
            "session_id": r.session_id,
            "role": r.role.value,
            "content": r.content,
            "sql_generated": r.sql_generated,
            "created_at": r.created_at
        }
        for r in rows
    ]
