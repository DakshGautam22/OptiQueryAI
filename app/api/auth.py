from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_async_session
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, verify_token
from app.core.dependencies import get_current_user
from app.models.organization import Organization, PlanEnum
from app.models.user import User, RoleEnum
import uuid

router = APIRouter()

# --- Pydantic Schemas ---

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    org_name: str | None = None
    role: RoleEnum = RoleEnum.admin


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Cookie Helper Utilities ---

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Sets secure HTTPOnly cookies for authentication."""
    # Access token cookie valid for 1 hour
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=3600,
        secure=False,  # Set to True in production environment
        samesite="lax"
    )
    # Refresh token cookie valid for 7 days
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=604800,
        secure=False,  # Set to True in production environment
        samesite="lax"
    )


# --- Endpoints ---

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserRegister,
    response: Response,
    db: AsyncSession = Depends(get_async_session)
):
    """Register a new user and generate their organization."""
    # Check if email is already taken
    existing_user_query = await db.execute(select(User).where(User.email == payload.email))
    if existing_user_query.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )

    # 1. Create Organization
    org_name = payload.org_name or f"{payload.email.split('@')[0]}'s Organization"
    org = Organization(
        name=org_name,
        plan=PlanEnum.free
    )
    db.add(org)
    await db.flush()  # Extract org.id

    # 2. Create User
    hashed_pwd = hash_password(payload.password)
    user = User(
        email=payload.email,
        password_hash=hashed_pwd,
        role=payload.role,
        org_id=org.id
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 3. Generate tokens
    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id)

    # 4. Set HttpOnly cookies
    _set_auth_cookies(response, access_token, refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_async_session)
):
    """Authenticate credentials and return session tokens."""
    # Find user by email
    user_query = await db.execute(select(User).where(User.email == payload.email))
    user = user_query.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your administrator."
        )

    # Generate tokens
    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id)

    # Set HttpOnly cookies
    _set_auth_cookies(response, access_token, refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_async_session)
):
    """Re-issue access tokens using the refresh token cookie."""
    # Retrieve refresh token from cookies
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing"
        )

    # Verify refresh token
    payload = verify_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject claim"
        )

    user_id = uuid.UUID(sub)
    user_query = await db.execute(select(User).where(User.id == user_id))
    user = user_query.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Issue new access token
    new_access_token = create_access_token(user.id, user.role.value)

    # Update cookies
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        max_age=3600,
        secure=False,
        samesite="lax"
    )

    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }


@router.delete("/logout")
async def logout(response: Response):
    """Clear authentication cookies."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Retrieve details of the authenticated user and their organization."""
    from sqlalchemy.orm import selectinload
    stmt = select(User).options(selectinload(User.organization)).where(User.id == current_user.id)
    result = await db.execute(stmt)
    user = result.scalar_one()
    
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "org_name": user.organization.name,
        "org_plan": user.organization.plan.value,
        "created_at": user.created_at
    }


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Validate current password and modify user password credentials."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password."
        )
        
    current_user.password_hash = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Password changed successfully."}
