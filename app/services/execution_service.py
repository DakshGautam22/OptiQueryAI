import time
import hashlib
import asyncio
import uuid
from datetime import datetime
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import asyncpg
import aiosqlite
from app.models.database_connection import DatabaseConnection, DBTypeEnum
from app.models.audit_log import AuditLog
from app.services.encryption import decrypt_credential

async def execute_query(
    connection_id: uuid.UUID,
    sql: str,
    user_id: uuid.UUID,
    db: AsyncSession,
    ip_address: str = "127.0.0.1"
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Execute read-only SELECT statement with 10s timeout, 1000 row limit, and log audit entries."""
    
    # 1. Enforce SELECT only (basic check)
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT") and not sql_upper.startswith("WITH"):
        raise ValueError("Only SELECT read-only statements are permitted for execution.")

    # 2. Retrieve Database Connection details
    conn_query = await db.execute(
        select(DatabaseConnection).where(DatabaseConnection.id == connection_id)
    )
    conn_record = conn_query.scalar_one_or_none()
    if not conn_record:
        raise ValueError("Database connection record not found.")

    # Decrypt credentials
    host = decrypt_credential(conn_record.host_encrypted, conn_record.iv)
    username = decrypt_credential(conn_record.username_encrypted, conn_record.iv)
    password = decrypt_credential(conn_record.password_encrypted, conn_record.iv)

    # 3. Setup Audit logging details
    sql_hash = hashlib.sha256(sql.encode("utf-8")).hexdigest()
    sql_preview = sql[:200]

    rows: list[dict[str, Any]] = []
    columns: list[str] = []
    success = False
    error_message: Optional[str] = None
    row_count = 0
    start_time = time.perf_counter()

    try:
        # Enforce limit at the execution level (append LIMIT if not present, or handle in pagination)
        # To avoid query breaking, we slice the retrieved rows to 1000.
        
        # 4. Connect and query depending on database type
        if conn_record.db_type == DBTypeEnum.postgresql:
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    host=host,
                    port=conn_record.port,
                    user=username,
                    password=password,
                    database=conn_record.database_name
                ),
                timeout=10.0
            )
            try:
                # Query with strict 10s execution timeout
                records = await asyncio.wait_for(conn.fetch(sql), timeout=10.0)
                
                # Truncate to 1000 rows limit
                records = records[:1000]
                row_count = len(records)
                
                if records:
                    columns = list(records[0].keys())
                    rows = [dict(r) for r in records]
            finally:
                await conn.close()
                
        elif conn_record.db_type == DBTypeEnum.mysql:
            # For mysql connection, we write a mock success placeholder in test/dev modes
            # Since standard mysql client is unpinned, we handle via test mock or socket test
            # If in integration testing, a mock is used.
            raise NotImplementedError("Live MySQL execution not supported without mysql client library.")
            
        elif str(conn_record.db_type).lower().endswith("sqlite"):
            # Internal test helper path using sqlite database files
            async with aiosqlite.connect(conn_record.database_name) as sqlite_conn:
                sqlite_conn.row_factory = aiosqlite.Row
                async with sqlite_conn.execute(sql) as cursor:
                    records = await cursor.fetchall()
                    records = records[:1000]
                    row_count = len(records)
                    
                    if records:
                        columns = list(records[0].keys())
                        rows = [dict(r) for r in records]
                        
        success = True
        
    except Exception as e:
        success = False
        error_message = str(e)
        raise e
        
    finally:
        execution_time_ms = int((time.perf_counter() - start_time) * 1000)
        
        # 5. Write to audit logs
        audit_log = AuditLog(
            user_id=user_id,
            connection_id=connection_id,
            sql_hash=sql_hash,
            sql_preview=sql_preview,
            execution_time_ms=execution_time_ms,
            row_count=row_count,
            success=success,
            error_message=error_message,
            ip_address=ip_address
        )
        db.add(audit_log)
        await db.commit()

    # 6. Auto-detect optimal chart config
    chart_config = detect_chart_type(columns, rows)
    return rows, columns, chart_config


def detect_chart_type(columns: list[str], rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Applies rules to recommend chart type (line, bar, pie, table) and axis mappings."""
    if not columns or not rows:
        return {"type": "table", "x_axis": None, "y_axes": []}

    # Examine first row values to identify data types
    first_row = rows[0]
    date_cols = []
    numeric_cols = []
    string_cols = []

    for col in columns:
        val = first_row.get(col)
        # Exclude numeric-looking columns that act as IDs
        if col.lower() in ["id", "uuid", "connection_id", "session_id"]:
            continue
            
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            numeric_cols.append(col)
        elif isinstance(val, (datetime, str)) and any(x in col.lower() for x in ["date", "time", "day", "month", "year"]):
            date_cols.append(col)
        elif isinstance(val, str):
            string_cols.append(col)

    # Heuristic Rule 1: Date/Time + Numbers -> Line Chart
    if date_cols and numeric_cols:
        return {
            "type": "line",
            "x_axis": date_cols[0],
            "y_axes": numeric_cols
        }

    # Heuristic Rule 2: Strings + Numbers -> Bar or Pie Chart
    if string_cols and numeric_cols:
        chart_type = "pie" if len(rows) <= 5 else "bar"
        return {
            "type": chart_type,
            "x_axis": string_cols[0],
            "y_axes": [numeric_cols[0]]
        }

    # Heuristic Rule 3: Multiple Numbers -> Bar Chart
    if len(numeric_cols) >= 2:
        return {
            "type": "bar",
            "x_axis": columns[0],  # Fallback to first column as X
            "y_axes": numeric_cols[1:]
        }

    # Heuristic Rule 4: Otherwise fallback to Table View
    return {
        "type": "table",
        "x_axis": None,
        "y_axes": []
    }
