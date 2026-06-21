import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User, RoleEnum
from app.models.audit_log import AuditLog
from app.models.database_connection import DatabaseConnection

router = APIRouter()

# --- Pydantic Schemas ---

class UserUpdatePayload(BaseModel):
    role: RoleEnum
    is_active: bool

# --- Dependency to Enforce Admin Role ---

async def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Administrator privileges required."
        )
    return current_user

# --- Endpoints ---

@router.get("/users", dependencies=[Depends(require_admin)])
async def list_org_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List all users in the administrator's organization."""
    stmt = select(User).where(User.org_id == current_user.org_id).order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role.value,
            "is_active": u.is_active,
            "created_at": u.created_at
        }
        for u in users
    ]


@router.put("/users/{user_id}", dependencies=[Depends(require_admin)])
async def update_user_status(
    user_id: uuid.UUID,
    payload: UserUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Modify user role or active status in the organization. Prevents self-modification."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot modify your own administrator role or active status."
        )

    # Find user in the same org
    stmt = select(User).where(and_(User.id == user_id, User.org_id == current_user.org_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in organization."
        )

    # Apply changes
    user.role = payload.role
    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active
    }


@router.get("/audit-logs", dependencies=[Depends(require_admin)])
async def list_org_audit_logs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Retrieve organization-wide audit logs showing executed queries and metadata connections."""
    stmt = (
        select(AuditLog)
        .join(AuditLog.database_connection)
        .options(joinedload(AuditLog.user))
        .options(joinedload(AuditLog.database_connection))
        .where(DatabaseConnection.org_id == current_user.org_id)
        .order_by(AuditLog.created_at.desc())
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "user_email": log.user.email if log.user else "Deleted User",
            "connection_name": log.database_connection.name if log.database_connection else "Deleted Connection",
            "sql_preview": log.sql_preview,
            "execution_time_ms": log.execution_time_ms,
            "row_count": log.row_count,
            "success": log.success,
            "ip_address": log.ip_address,
            "created_at": log.created_at
        }
        for log in logs
    ]
