import uuid
from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_async_session, async_session_maker
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.database_connection import DatabaseConnection, DBTypeEnum
from app.models.schema_metadata import SchemaMetadata
from app.services.encryption import encrypt_credential, decrypt_credential
from app.services.connection_service import test_connection, introspect_schema

router = APIRouter()

# --- Pydantic Schemas ---

class ConnectionCreate(BaseModel):
    name: str
    db_type: DBTypeEnum
    host: str
    port: int
    database_name: str
    username: str
    password: str


class ConnectionResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    db_type: DBTypeEnum
    port: int
    database_name: str
    is_active: bool
    last_tested_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SchemaMetadataResponse(BaseModel):
    id: uuid.UUID
    connection_id: uuid.UUID
    table_name: str
    column_name: str
    data_type: str
    is_pk: bool
    is_fk: bool
    ref_table: Optional[str] = None
    ref_column: Optional[str] = None

    class Config:
        from_attributes = True


# --- Background Tasks ---

async def run_introspection_task(
    connection_id: uuid.UUID,
    db_type: str,
    host_encrypted: bytes,
    port: int,
    database_name: str,
    username_encrypted: bytes,
    password_encrypted: bytes,
    iv: bytes
) -> None:
    """Background worker task to decrypt credentials, harvest schema metadata, and upsert records."""
    try:
        host = decrypt_credential(host_encrypted, iv)
        username = decrypt_credential(username_encrypted, iv)
        password = decrypt_credential(password_encrypted, iv)

        schema_metadata_list = await introspect_schema(
            connection_id=connection_id,
            db_type=db_type,
            host=host,
            port=port,
            database_name=database_name,
            username=username,
            password=password
        )

        async with async_session_maker() as db:
            # Drop existing metadata for this connection
            await db.execute(delete(SchemaMetadata).where(SchemaMetadata.connection_id == connection_id))
            
            if schema_metadata_list:
                db.add_all(schema_metadata_list)
            
            await db.commit()
    except Exception as e:
        # Silently fail background task to prevent crash (in real app, we log this to a file or monitor)
        pass


# --- Endpoints ---

@router.get("", response_model=list[ConnectionResponse])
async def list_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Retrieve all database connections belonging to the user's organization."""
    result = await db.execute(
        select(DatabaseConnection).where(DatabaseConnection.org_id == current_user.org_id)
    )
    return result.scalars().all()


@router.post("", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(
    payload: ConnectionCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Test connection, encrypt credentials, save database connection, and trigger background introspection."""
    # 1. Test target connectivity prior to saving
    success, err_msg = await test_connection(
        db_type=payload.db_type.value,
        host=payload.host,
        port=payload.port,
        database_name=payload.database_name,
        username=payload.username,
        password=payload.password
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection test failed: {err_msg}"
        )

    # 2. Encrypt credentials with shared IV
    shared_iv = None
    enc_host, shared_iv = encrypt_credential(payload.host, shared_iv)
    enc_username, _ = encrypt_credential(payload.username, shared_iv)
    enc_password, _ = encrypt_credential(payload.password, shared_iv)

    # 3. Create Connection record
    connection = DatabaseConnection(
        org_id=current_user.org_id,
        name=payload.name,
        db_type=payload.db_type,
        host_encrypted=enc_host,
        port=payload.port,
        database_name=payload.database_name,
        username_encrypted=enc_username,
        password_encrypted=enc_password,
        iv=shared_iv,
        is_active=True,
        last_tested_at=datetime.utcnow()
    )
    db.add(connection)
    await db.commit()
    await db.refresh(connection)

    # 4. Trigger background metadata introspection
    background_tasks.add_task(
        run_introspection_task,
        connection_id=connection.id,
        db_type=connection.db_type.value,
        host_encrypted=connection.host_encrypted,
        port=connection.port,
        database_name=connection.database_name,
        username_encrypted=connection.username_encrypted,
        password_encrypted=connection.password_encrypted,
        iv=connection.iv
    )

    return connection


@router.get("/{id}", response_model=ConnectionResponse)
async def get_connection(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Retrieve connection details by ID (never exposes decrypted credentials)."""
    result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == id,
            DatabaseConnection.org_id == current_user.org_id
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    return connection


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete database connection."""
    result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == id,
            DatabaseConnection.org_id == current_user.org_id
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )
    await db.delete(connection)
    await db.commit()


@router.post("/{id}/test", response_model=ConnectionResponse)
async def retest_connection(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Re-test database connectivity, updates last_tested_at status."""
    result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == id,
            DatabaseConnection.org_id == current_user.org_id
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )

    # Decrypt credentials for test connection run
    host = decrypt_credential(connection.host_encrypted, connection.iv)
    username = decrypt_credential(connection.username_encrypted, connection.iv)
    password = decrypt_credential(connection.password_encrypted, connection.iv)

    success, err_msg = await test_connection(
        db_type=connection.db_type.value,
        host=host,
        port=connection.port,
        database_name=connection.database_name,
        username=username,
        password=password
    )

    connection.is_active = success
    connection.last_tested_at = datetime.utcnow()
    await db.commit()
    await db.refresh(connection)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Re-test failed: {err_msg}"
        )

    return connection


@router.get("/{id}/schema", response_model=list[SchemaMetadataResponse])
async def get_connection_schema(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Retrieve all harvested schema metadata for the given database connection."""
    # Ensure connection exists and belongs to organization
    conn_result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == id,
            DatabaseConnection.org_id == current_user.org_id
        )
    )
    if not conn_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )

    result = await db.execute(
        select(SchemaMetadata).where(SchemaMetadata.connection_id == id)
    )
    return result.scalars().all()


@router.post("/{id}/refresh-schema", response_model=list[SchemaMetadataResponse])
async def refresh_connection_schema(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Synchronously trigger introspection and refresh database schema metadata."""
    result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.id == id,
            DatabaseConnection.org_id == current_user.org_id
        )
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database connection not found"
        )

    # Decrypt credentials for introspection run
    host = decrypt_credential(connection.host_encrypted, connection.iv)
    username = decrypt_credential(connection.username_encrypted, connection.iv)
    password = decrypt_credential(connection.password_encrypted, connection.iv)

    try:
        # Run introspection synchronously
        metadata_list = await introspect_schema(
            connection_id=connection.id,
            db_type=connection.db_type.value,
            host=host,
            port=connection.port,
            database_name=connection.database_name,
            username=username,
            password=password
        )

        # Truncate old metadata and insert new list
        await db.execute(delete(SchemaMetadata).where(SchemaMetadata.connection_id == connection.id))
        
        if metadata_list:
            db.add_all(metadata_list)
        
        await db.commit()
        
        # Query and return fresh records
        schema_result = await db.execute(
            select(SchemaMetadata).where(SchemaMetadata.connection_id == connection.id)
        )
        return schema_result.scalars().all()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Schema refresh failed: {str(e)}"
        )
