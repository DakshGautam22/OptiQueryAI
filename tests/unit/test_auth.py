import pytest
from fastapi import Depends
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.core.database import get_async_session
from app.core.security import verify_token
from app.models.user import RoleEnum
from app.core.dependencies import require_role, get_current_user

# Create standard mock router dependencies to test role check
@app.get("/test-admin-only")
async def admin_only_route(current_user = Depends(require_role(RoleEnum.admin))):
    return {"status": "success", "email": current_user.email}

@app.get("/test-analyst-only")
async def analyst_only_route(current_user = Depends(require_role(RoleEnum.analyst))):
    return {"status": "success", "email": current_user.email}


@pytest.mark.asyncio
async def test_auth_full_flow(db_session: AsyncSession):
    # Override database session dependency to use our transaction-rolled-back test session
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_async_session] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Register a new user
        reg_payload = {
            "email": "testuser@optiquery.ai",
            "password": "strongpassword123",
            "org_name": "Test Organization Inc",
            "role": "admin"
        }
        reg_response = await ac.post("/auth/register", json=reg_payload)
        assert reg_response.status_code == 201
        
        reg_json = reg_response.json()
        assert "access_token" in reg_json
        assert "refresh_token" in reg_json
        assert reg_json["token_type"] == "bearer"
        
        # Verify HttpOnly cookies are set
        assert "access_token" in reg_response.cookies
        assert "refresh_token" in reg_response.cookies
        
        access_token = reg_json["access_token"]
        refresh_token = reg_json["refresh_token"]

        # Decode token to verify contents
        decoded = verify_token(access_token)
        assert decoded["role"] == "admin"
        assert decoded["type"] == "access"

        # 2. Login with correct credentials
        login_payload = {
            "email": "testuser@optiquery.ai",
            "password": "strongpassword123"
        }
        login_response = await ac.post("/auth/login", json=login_payload)
        assert login_response.status_code == 200
        assert "access_token" in login_response.json()

        # 3. Login with invalid password
        bad_login_payload = {
            "email": "testuser@optiquery.ai",
            "password": "wrongpassword"
        }
        bad_response = await ac.post("/auth/login", json=bad_login_payload)
        assert bad_response.status_code == 401
        assert bad_response.json()["detail"] == "Incorrect email or password"

        # 4. Refresh token flow
        # Set refresh token cookie manually on the client
        ac.cookies.set("refresh_token", refresh_token)
        refresh_response = await ac.post("/auth/refresh")
        assert refresh_response.status_code == 200
        assert "access_token" in refresh_response.json()
        assert "access_token" in refresh_response.cookies

        # 5. Access route requiring admin role
        ac.cookies.set("access_token", access_token)
        admin_response = await ac.get("/test-admin-only")
        assert admin_response.status_code == 200
        assert admin_response.json()["email"] == "testuser@optiquery.ai"

        # 6. Access route requiring analyst role (should be forbidden since role is admin)
        analyst_response = await ac.get("/test-analyst-only")
        assert analyst_response.status_code == 403
        assert analyst_response.json()["detail"] == "Insufficient permissions"

        # 7. Logout flow
        logout_response = await ac.delete("/auth/logout")
        assert logout_response.status_code == 200
        # Check that cookies are deleted (expiring past dates)
        assert logout_response.cookies.get("access_token") is None

    # Clean up overrides
    app.dependency_overrides.clear()
