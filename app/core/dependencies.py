import uuid
from typing import Sequence
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_async_session
from app.core.security import verify_token
from app.models.user import User, RoleEnum

# Swagger OAuth2 password flow target path (auto_error=False to support cookies fallback)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_async_session)
) -> User:
    """Dependency validating the JWT access token from headers or cookies, returning the User."""
    actual_token = token
    
    # Fallback to check HTTPOnly cookies if header not present
    if not actual_token:
        actual_token = request.cookies.get("access_token")
        
    if not actual_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decodes and verifies RS256 signature
    payload = verify_token(actual_token)
    
    # Confirm it is an access token, not a refresh token
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(sub)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Subject claim format is invalid",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    # Retrieve user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_role(allowed_roles: RoleEnum | Sequence[RoleEnum]):
    """Dependency factory restricting route access to specific User roles."""
    roles_list = [allowed_roles] if isinstance(allowed_roles, RoleEnum) else list(allowed_roles)

    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles_list:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user

    return dependency
