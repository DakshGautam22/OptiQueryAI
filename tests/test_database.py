import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.organization import Organization, PlanEnum
from app.models.user import User, RoleEnum
from app.models.database_connection import DatabaseConnection, DBTypeEnum
from app.models.schema_metadata import SchemaMetadata
from app.models.query_history import QueryHistory
from app.models.conversation_history import ConversationHistory, ChatRoleEnum
from app.models.audit_log import AuditLog

@pytest.mark.asyncio
async def test_create_organization_and_user(db_session: AsyncSession):
    # 1. Create Organization
    org = Organization(
        name="Acme Corporation",
        plan=PlanEnum.pro
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    
    assert org.id is not None
    assert org.name == "Acme Corporation"
    assert org.plan == PlanEnum.pro
    
    # 2. Create User belonging to Organization
    user = User(
        email="analyst@acme.com",
        password_hash="hashed_password_string_here",
        role=RoleEnum.analyst,
        org_id=org.id
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    assert user.id is not None
    assert user.email == "analyst@acme.com"
    assert user.org_id == org.id
    assert user.role == RoleEnum.analyst

@pytest.mark.asyncio
async def test_database_connection_and_schema_metadata(db_session: AsyncSession):
    # Create Organization
    org = Organization(name="Test Org", plan=PlanEnum.free)
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    # Create DatabaseConnection
    connection = DatabaseConnection(
        org_id=org.id,
        name="Production Analytics DB",
        db_type=DBTypeEnum.postgresql,
        host_encrypted=b"encrypted_host_bytes",
        port=5432,
        database_name="analytics_prod",
        username_encrypted=b"encrypted_user_bytes",
        password_encrypted=b"encrypted_pass_bytes",
        iv=b"encryption_iv_bytes_here_16_len",
        is_active=True
    )
    db_session.add(connection)
    await db_session.commit()
    await db_session.refresh(connection)

    assert connection.id is not None
    assert connection.port == 5432
    assert connection.db_type == DBTypeEnum.postgresql

    # Create SchemaMetadata
    metadata = SchemaMetadata(
        connection_id=connection.id,
        table_name="orders",
        column_name="id",
        data_type="INTEGER",
        is_pk=True,
        is_fk=False
    )
    db_session.add(metadata)
    await db_session.commit()
    await db_session.refresh(metadata)

    assert metadata.id is not None
    assert metadata.table_name == "orders"
    assert metadata.is_pk is True
    assert metadata.is_fk is False

@pytest.mark.asyncio
async def test_query_and_conversation_histories(db_session: AsyncSession):
    # Setup parent objects
    org = Organization(name="Core Org", plan=PlanEnum.enterprise)
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    user = User(
        email="admin@core.com",
        password_hash="pbkdf2:sha256:password_hash",
        role=RoleEnum.admin,
        org_id=org.id
    )
    db_session.add(user)
    
    connection = DatabaseConnection(
        org_id=org.id,
        name="Warehouse DB",
        db_type=DBTypeEnum.postgresql,
        host_encrypted=b"host",
        port=5432,
        database_name="dw",
        username_encrypted=b"user",
        password_encrypted=b"pwd",
        iv=b"iv_bytes",
        is_active=True
    )
    db_session.add(connection)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(connection)

    # Create QueryHistory
    session_uuid = uuid.uuid4()
    query = QueryHistory(
        user_id=user.id,
        connection_id=connection.id,
        session_id=session_uuid,
        natural_language="What are the total sales for this month?",
        generated_sql="SELECT SUM(total) FROM sales WHERE month = 'current';",
        optimized_sql="SELECT SUM(total) FROM sales WHERE sales_date >= date_trunc('month', CURRENT_DATE);",
        optimization_report={"rewrites": ["replaced string month comparison with partition filter"], "time_saved_ms": 150},
        execution_time_ms=45,
        row_count=1,
        success=True
    )
    db_session.add(query)

    # Create ConversationHistory
    chat = ConversationHistory(
        session_id=session_uuid,
        user_id=user.id,
        role=ChatRoleEnum.user,
        content="What are the total sales for this month?"
    )
    db_session.add(chat)
    await db_session.commit()

    await db_session.refresh(query)
    await db_session.refresh(chat)

    assert query.id is not None
    assert query.success is True
    assert query.optimization_report["time_saved_ms"] == 150
    assert chat.id is not None
    assert chat.role == ChatRoleEnum.user

@pytest.mark.asyncio
async def test_audit_logs(db_session: AsyncSession):
    # Setup parents
    org = Organization(name="Audit Org", plan=PlanEnum.pro)
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    user = User(
        email="viewer@audit.com",
        password_hash="pwd",
        role=RoleEnum.viewer,
        org_id=org.id
    )
    db_session.add(user)

    connection = DatabaseConnection(
        org_id=org.id,
        name="Audit Target DB",
        db_type=DBTypeEnum.postgresql,
        host_encrypted=b"host",
        port=5432,
        database_name="audit_target",
        username_encrypted=b"user",
        password_encrypted=b"pwd",
        iv=b"iv",
        is_active=True
    )
    db_session.add(connection)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(connection)

    # Create AuditLog
    audit = AuditLog(
        user_id=user.id,
        connection_id=connection.id,
        sql_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        sql_preview="SELECT * FROM customers LIMIT 10;",
        execution_time_ms=12,
        row_count=10,
        success=True,
        ip_address="192.168.1.100"
    )
    db_session.add(audit)
    await db_session.commit()
    await db_session.refresh(audit)

    assert audit.id is not None
    assert audit.ip_address == "192.168.1.100"
    assert audit.sql_hash == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
