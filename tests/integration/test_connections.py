import uuid
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.main import app
from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User, RoleEnum
from app.models.organization import Organization, PlanEnum
from app.models.database_connection import DatabaseConnection, DBTypeEnum
from app.models.schema_metadata import SchemaMetadata
from app.services.encryption import decrypt_credential

@pytest.mark.asyncio
async def test_connections_full_crud_and_introspection(db_session: AsyncSession):
    # 1. Setup Test Database Context (Tenant Organisation and User)
    org_1 = Organization(name="Org One", plan=PlanEnum.pro)
    org_2 = Organization(name="Org Two", plan=PlanEnum.free)
    db_session.add_all([org_1, org_2])
    await db_session.commit()

    user_1 = User(
        email="user1@org1.com",
        password_hash="hashed_pw",
        role=RoleEnum.admin,
        org_id=org_1.id
    )
    user_2 = User(
        email="user2@org2.com",
        password_hash="hashed_pw",
        role=RoleEnum.admin,
        org_id=org_2.id
    )
    db_session.add_all([user_1, user_2])
    await db_session.commit()
    await db_session.refresh(user_1)
    await db_session.refresh(user_2)

    # Dependency Overrides
    async def override_get_db():
        yield db_session

    async def override_get_current_user():
        return user_1

    app.dependency_overrides[get_async_session] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        
        # 2. Test POST /connections (Create connection)
        conn_payload = {
            "name": "Production Postgres",
            "db_type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database_name": "prod_db",
            "username": "postgres_user",
            "password": "supersecretpassword"
        }

        # Mock both connection testing and background introspection functions
        with patch("app.api.connections.test_connection", new_callable=AsyncMock) as mock_test_conn, \
             patch("app.api.connections.introspect_schema", new_callable=AsyncMock) as mock_intro:
            
            mock_test_conn.return_value = (True, "")
            
            mock_intro.return_value = [
                SchemaMetadata(
                    table_name="orders",
                    column_name="id",
                    data_type="INTEGER",
                    is_pk=True,
                    is_fk=False
                ),
                SchemaMetadata(
                    table_name="orders",
                    column_name="user_id",
                    data_type="INTEGER",
                    is_pk=False,
                    is_fk=True,
                    ref_table="users",
                    ref_column="id"
                )
            ]

            response = await ac.post("/connections", json=conn_payload)
            assert response.status_code == 201
            res_json = response.json()
            
            assert res_json["name"] == "Production Postgres"
            assert res_json["database_name"] == "prod_db"
            assert res_json["is_active"] is True
            
            conn_id = uuid.UUID(res_json["id"])

            # 3. Verify connection was created and credentials are encrypted on disk
            conn_db_query = await db_session.execute(
                select(DatabaseConnection).where(DatabaseConnection.id == conn_id)
            )
            conn_db = conn_db_query.scalar_one()
            
            decrypted_host = decrypt_credential(conn_db.host_encrypted, conn_db.iv)
            decrypted_pass = decrypt_credential(conn_db.password_encrypted, conn_db.iv)
            assert decrypted_host == "localhost"
            assert decrypted_pass == "supersecretpassword"

            # Execute background tasks manually in this block to simulate schema insertion
            # Ordinarily FastAPI handles BackgroundTasks after return, here we mock sync execution
            await run_introspection_test_sync(conn_db, mock_intro.return_value, db_session)

            # 4. Test GET /connections (List connections)
            list_resp = await ac.get("/connections")
            assert list_resp.status_code == 200
            assert len(list_resp.json()) == 1
            assert list_resp.json()[0]["id"] == str(conn_id)

            # 5. Test GET /connections/{id} (Get connection by ID)
            get_resp = await ac.get(f"/connections/{conn_id}")
            assert get_resp.status_code == 200
            assert get_resp.json()["name"] == "Production Postgres"
            # Double check credentials are NOT returned in response
            assert "password" not in get_resp.json()
            assert "password_encrypted" not in get_resp.json()

            # 6. Test GET /connections/{id}/schema (Get metadata)
            schema_resp = await ac.get(f"/connections/{conn_id}/schema")
            assert schema_resp.status_code == 200
            schema_json = schema_resp.json()
            assert len(schema_json) == 2
            assert schema_json[0]["table_name"] == "orders"
            assert schema_json[0]["column_name"] == "id"
            assert schema_json[0]["is_pk"] is True
            assert schema_json[1]["column_name"] == "user_id"
            assert schema_json[1]["ref_table"] == "users"

            # 7. Test POST /connections/{id}/test (Re-test connection)
            mock_test_conn.reset_mock()
            mock_test_conn.return_value = (True, "")
            
            test_resp = await ac.post(f"/connections/{conn_id}/test")
            assert test_resp.status_code == 200
            assert test_resp.json()["is_active"] is True

            # 8. Test tenant isolation (user2 should get 404 trying to access connection of user1)
            app.dependency_overrides[get_current_user] = lambda: user_2
            iso_resp = await ac.get(f"/connections/{conn_id}")
            assert iso_resp.status_code == 404

            # Reset back to user1
            app.dependency_overrides[get_current_user] = override_get_current_user

            # 9. Test DELETE /connections/{id} (Delete connection)
            del_resp = await ac.delete(f"/connections/{conn_id}")
            assert del_resp.status_code == 204

            # Confirm deletion from database
            conn_db_query_post = await db_session.execute(
                select(DatabaseConnection).where(DatabaseConnection.id == conn_id)
            )
            assert conn_db_query_post.scalar_one_or_none() is None

    app.dependency_overrides.clear()


async def run_introspection_test_sync(
    connection: DatabaseConnection, 
    metadata: list[SchemaMetadata], 
    db: AsyncSession
) -> None:
    """Helper to simulate background introspection task synchronously in test thread."""
    # Add metadata to DB
    for m in metadata:
        m.connection_id = connection.id
        db.add(m)
    await db.commit()
