import uuid
from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.database_connection import DatabaseConnection
from app.models.query_history import QueryHistory
from app.services.pipeline_service import PipelineService
from app.services.execution_service import execute_query

router = APIRouter()
pipeline_service = PipelineService()

# --- Pydantic Schemas ---

class QueryGenerateRequest(BaseModel):
    connection_id: uuid.UUID
    question: str
    session_id: Optional[uuid.UUID] = None
    conversation_history: list[dict[str, Any]] = Field(default_factory=list)


class QueryGenerateResponse(BaseModel):
    success: bool
    generated_sql: str
    optimized_sql: str
    optimization_report: list[str]
    explanation_steps: list[str]
    validation: dict[str, Any]
    fallback_used: bool
    session_id: uuid.UUID


class QueryExecuteRequest(BaseModel):
    connection_id: uuid.UUID
    sql: str


class QueryExecuteResponse(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    chart_config: dict[str, Any]


# --- Endpoints ---

@router.post("/generate", response_model=QueryGenerateResponse)
async def generate_sql(
    payload: QueryGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Executes the multi-agent SQL pipeline to translate user prompts into database statements."""
    # 1. Fetch connection, ensuring it belongs to organization
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

    # 2. Run multi-agent pipeline
    result = await pipeline_service.run_pipeline(
        question=payload.question,
        connection_id=payload.connection_id,
        db_type=connection.db_type.value,
        conversation_history=payload.conversation_history,
        db=db
    )

    if not result.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent pipeline failed at {result.get('error_stage')}: {result.get('error_message')}"
        )

    session_uuid = payload.session_id or uuid.uuid4()

    # 3. Save to query_history table
    val_valid = result["validation"]["valid"]
    query_history = QueryHistory(
        user_id=current_user.id,
        connection_id=payload.connection_id,
        session_id=session_uuid,
        natural_language=payload.question,
        generated_sql=result["generated_sql"],
        optimized_sql=result["optimized_sql"],
        optimization_report={"report": result["optimization_report"]},
        execution_time_ms=0,
        row_count=0,
        success=val_valid,
        error_message=None if val_valid else "; ".join(result["validation"]["errors"])
    )
    db.add(query_history)
    await db.commit()
    await db.refresh(query_history)

    # 4. If RAG is enabled, index the successfully generated query for future prompt context matches
    if val_valid:
        try:
            from app.rag.vector_store import VectorStoreService
            VectorStoreService().index_query(
                connection_id=payload.connection_id,
                query_history_id=query_history.id,
                natural_language=payload.question,
                generated_sql=result["optimized_sql"],
                success=True
            )
        except Exception:
            pass

    return {
        "success": True,
        "generated_sql": result["generated_sql"],
        "optimized_sql": result["optimized_sql"],
        "optimization_report": result["optimization_report"],
        "explanation_steps": result["explanation_steps"],
        "validation": result["validation"],
        "fallback_used": result["fallback_used"],
        "session_id": session_uuid
    }


@router.post("/execute", response_model=QueryExecuteResponse)
async def execute_sql(
    payload: QueryExecuteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Safely executes read-only SQL queries on the designated connection, auditing operations."""
    # Ensure connection exists and belongs to organization
    conn_result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == payload.connection_id,
            DatabaseConnection.org_id == current_user.org_id
        )
    )
    if not conn_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )

    client_ip = request.client.host if request.client else "127.0.0.1"

    try:
        rows, columns, chart_config = await execute_query(
            connection_id=payload.connection_id,
            sql=payload.sql,
            user_id=current_user.id,
            db=db,
            ip_address=client_ip
        )
        return {
            "columns": columns,
            "rows": rows,
            "chart_config": chart_config
        }
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as exec_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query execution failed: {str(exec_err)}"
        )


@router.get("/history")
async def get_history(
    connection_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Retrieve paginated, filterable query history for the user's organization."""
    # Build base filter querying connections in user's org
    filters = []
    
    conn_select = select(DatabaseConnection.id).where(DatabaseConnection.org_id == current_user.org_id)
    conn_result = await db.execute(conn_select)
    org_connection_ids = [row[0] for row in conn_result.all()]
    
    filters.append(QueryHistory.connection_id.in_(org_connection_ids))
    
    if connection_id:
        if connection_id not in org_connection_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to database connection history"
            )
        filters.append(QueryHistory.connection_id == connection_id)

    if start_date:
        filters.append(QueryHistory.created_at >= start_date)
    if end_date:
        filters.append(QueryHistory.created_at <= end_date)

    query = (
        select(QueryHistory)
        .where(and_(*filters))
        .order_by(QueryHistory.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    
    history_result = await db.execute(query)
    rows = history_result.scalars().all()
    
    return [
        {
            "id": r.id,
            "connection_id": r.connection_id,
            "user_id": r.user_id,
            "session_id": r.session_id,
            "natural_language": r.natural_language,
            "generated_sql": r.generated_sql,
            "optimized_sql": r.optimized_sql,
            "optimization_report": r.optimization_report,
            "success": r.success,
            "error_message": r.error_message,
            "created_at": r.created_at
        }
        for r in rows
    ]
