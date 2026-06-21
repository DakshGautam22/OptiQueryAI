import os
import uuid
import pytest
import aiosqlite
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.organization import Organization, PlanEnum
from app.models.user import User, RoleEnum
from app.models.database_connection import DatabaseConnection, DBTypeEnum
from app.models.schema_metadata import SchemaMetadata
from app.models.audit_log import AuditLog
from app.services.pipeline_service import PipelineService
from app.services.execution_service import execute_query
from app.services.encryption import encrypt_credential
from app.rag.vector_store import VectorStoreService

# Temporary SQLite file path used for target database test run
TARGET_DB_PATH = "./test_integration_target.db"

@pytest.fixture(scope="module")
async def setup_target_sqlite():
    """Initializes and seeds a temporary target SQLite database for connection query tests."""
    if os.path.exists(TARGET_DB_PATH):
        os.remove(TARGET_DB_PATH)
        
    async with aiosqlite.connect(TARGET_DB_PATH) as conn:
        # Create users table
        await conn.execute("""
            CREATE TABLE customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER,
                signup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Seed records
        await conn.execute("INSERT INTO customers (name, age) VALUES ('Alice', 25);")
        await conn.execute("INSERT INTO customers (name, age) VALUES ('Bob', 32);")
        await conn.execute("INSERT INTO customers (name, age) VALUES ('Charlie', 19);")
        await conn.commit()
        
    yield TARGET_DB_PATH
    
    if os.path.exists(TARGET_DB_PATH):
        try:
            os.remove(TARGET_DB_PATH)
        except Exception:
            pass

@pytest.mark.asyncio
async def test_full_pipeline_and_execution_flow(db_session: AsyncSession, setup_target_sqlite):
    target_db_file = setup_target_sqlite
    
    # 1. Setup metadata in host test DB
    org = Organization(name="Pipeline Org", plan=PlanEnum.pro)
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    user = User(
        email="dev@pipeline.com",
        password_hash="pwd",
        role=RoleEnum.admin,
        org_id=org.id
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Encrypt the database file path as host parameter for testing
    enc_host, shared_iv = encrypt_credential(target_db_file)
    enc_username, _ = encrypt_credential("unused", shared_iv)
    enc_password, _ = encrypt_credential("unused", shared_iv)

    connection = DatabaseConnection(
        org_id=org.id,
        name="Test SQLite Target",
        db_type=DBTypeEnum.postgresql, # Hack to leverage connection queries in mocks
        host_encrypted=enc_host,
        port=0,
        database_name=target_db_file, # Stores SQLite filepath
        username_encrypted=enc_username,
        password_encrypted=enc_password,
        iv=shared_iv,
        is_active=True
    )
    # Update type to "sqlite" locally inside DB record to run sqlite branch in execution_service
    connection.db_type = "sqlite" # type: ignore
    db_session.add(connection)
    await db_session.commit()
    await db_session.refresh(connection)

    # Add SchemaMetadata
    schema_rows = [
        SchemaMetadata(connection_id=connection.id, table_name="customers", column_name="id", data_type="INTEGER", is_pk=True),
        SchemaMetadata(connection_id=connection.id, table_name="customers", column_name="name", data_type="TEXT", is_pk=False),
        SchemaMetadata(connection_id=connection.id, table_name="customers", column_name="age", data_type="INTEGER", is_pk=False),
        SchemaMetadata(connection_id=connection.id, table_name="customers", column_name="signup_date", data_type="TIMESTAMP", is_pk=False),
    ]
    db_session.add_all(schema_rows)
    await db_session.commit()

    # Index table metadata into VectorStore
    VectorStoreService().index_schema(connection.id, schema_rows)

    # We mock gpt-4o SQL generation to simulate pipeline queries
    with patch("app.core.config.settings.OPENAI_API_KEY", "sk-abcdef123456"), \
         patch("app.agents.sql_generator_agent.SQLGeneratorAgent._call_openai", new_callable=AsyncMock) as mock_gpt:
        
        pipeline = PipelineService()
        mock_gpt.return_value = "SELECT name, age FROM customers WHERE age >= 20"
        
        result = await pipeline.run_pipeline(
            question="List names and ages of customers who are 20 years or older",
            connection_id=connection.id,
            db_type="postgresql",
            conversation_history=[],
            db=db_session
        )
        
        assert result["success"] is True
        assert "SELECT" in result["generated_sql"]
        assert result["validation"]["valid"] is True
        assert len(result["explanation_steps"]) >= 2
        
        generated_query = result["optimized_sql"]

    # 3. Execute the generated query and assert responses + audit logs
    rows, columns, chart_config = await execute_query(
        connection_id=connection.id,
        sql=generated_query,
        user_id=user.id,
        db=db_session,
        ip_address="127.0.0.1"
    )

    # Assert outputs
    assert len(rows) == 2  # Alice (25) and Bob (32) match condition
    assert columns == ["name", "age"]
    assert rows[0]["name"] == "Alice"
    assert rows[1]["name"] == "Bob"
    
    # Assert Auto-detected chart configuration (strings + numbers -> pie chart when rows <= 5)
    assert chart_config["type"] == "pie"
    assert chart_config["x_axis"] == "name"
    assert chart_config["y_axes"] == ["age"]

    # 4. Verify audit log was recorded correctly
    audit_query = await db_session.execute(
        select(AuditLog).where(AuditLog.connection_id == connection.id)
    )
    audit = audit_query.scalar_one()
    assert audit.success is True
    assert audit.row_count == 2
    assert audit.user_id == user.id
    assert audit.ip_address == "127.0.0.1"
