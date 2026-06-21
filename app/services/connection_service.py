import asyncio
import uuid
import asyncpg
from app.models.schema_metadata import SchemaMetadata

async def test_connection(
    db_type: str, 
    host: str, 
    port: int, 
    database_name: str, 
    username: str, 
    password: str
) -> tuple[bool, str]:
    """Test connection viability to target database with a 5s timeout."""
    if db_type == "postgresql":
        try:
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    host=host,
                    port=port,
                    user=username,
                    password=password,
                    database=database_name
                ),
                timeout=5.0
            )
            await conn.close()
            return True, ""
        except Exception as e:
            return False, f"PostgreSQL Connection Error: {str(e)}"
            
    elif db_type == "mysql":
        # Since MySQL driver isn't standard in the project dependencies, check TCP socket connectivity
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=5.0
            )
            writer.close()
            await writer.wait_closed()
            return True, ""
        except Exception as e:
            return False, f"MySQL Port unreachable: {str(e)}"
            
    elif db_type == "sqlite":
        try:
            import aiosqlite
            # database_name is the SQLite database file path
            async with aiosqlite.connect(database_name) as conn:
                await conn.execute("SELECT 1")
            return True, ""
        except Exception as e:
            return False, f"SQLite Connection Error: {str(e)}"

    return False, f"Unsupported database type: {db_type}"


async def introspect_schema(
    connection_id: uuid.UUID,
    db_type: str,
    host: str,
    port: int,
    database_name: str,
    username: str,
    password: str
) -> list[SchemaMetadata]:
    """Extract database tables, columns, data types, primary keys, and foreign keys."""
    schema_list: list[SchemaMetadata] = []
    
    if db_type == "postgresql":
        try:
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    host=host,
                    port=port,
                    user=username,
                    password=password,
                    database=database_name
                ),
                timeout=10.0
            )
            
            # 1. Fetch tables, columns, and raw types
            columns_query = """
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position;
            """
            columns_rows = await conn.fetch(columns_query)
            
            # 2. Fetch Primary Keys
            pks_query = """
                SELECT kcu.table_name, kcu.column_name 
                FROM information_schema.table_constraints tc 
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name 
                    AND tc.table_schema = kcu.table_schema 
                WHERE tc.constraint_type = 'PRIMARY KEY' 
                  AND tc.table_schema = 'public';
            """
            pk_rows = await conn.fetch(pks_query)
            primary_keys = {(r["table_name"], r["column_name"]) for r in pk_rows}
            
            # 3. Fetch Foreign Keys (handles single column FK constraints)
            fks_query = """
                SELECT
                    tc.table_name AS table_name,
                    kcu.column_name AS column_name,
                    ccu.table_name AS ref_table,
                    ccu.column_name AS ref_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                    ON tc.constraint_name = ccu.constraint_name
                    AND tc.table_schema = ccu.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                  AND tc.table_schema = 'public';
            """
            fk_rows = await conn.fetch(fks_query)
            foreign_keys = {
                (r["table_name"], r["column_name"]): (r["ref_table"], r["ref_column"])
                for r in fk_rows
            }
            
            await conn.close()
            
            # 4. Construct SchemaMetadata objects
            for col in columns_rows:
                tbl = col["table_name"]
                col_name = col["column_name"]
                data_type = col["data_type"]
                
                is_pk = (tbl, col_name) in primary_keys
                is_fk = (tbl, col_name) in foreign_keys
                ref_tbl = foreign_keys[(tbl, col_name)][0] if is_fk else None
                ref_col = foreign_keys[(tbl, col_name)][1] if is_fk else None
                
                schema_list.append(SchemaMetadata(
                    connection_id=connection_id,
                    table_name=tbl,
                    column_name=col_name,
                    data_type=data_type,
                    is_pk=is_pk,
                    is_fk=is_fk,
                    ref_table=ref_tbl,
                    ref_column=ref_col
                ))
                
        except Exception:
            # Let exceptions bubble up to connection handling logic
            raise
            
    elif db_type == "mysql":
        # Mock/Stub schema output for MySQL since driver is not loaded in dev environment
        # Return an empty list for safety or basic test template
        pass
        
    elif db_type == "sqlite":
        try:
            import aiosqlite
            async with aiosqlite.connect(database_name) as conn:
                conn.row_factory = aiosqlite.Row
                
                # Fetch tables
                tables_cursor = await conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
                )
                tables = [r["name"] for r in await tables_cursor.fetchall()]
                
                for table in tables:
                    # Fetch columns info for table
                    columns_cursor = await conn.execute(f"PRAGMA table_info('{table}');")
                    columns = await columns_cursor.fetchall()
                    
                    # Fetch foreign keys for table
                    fks_cursor = await conn.execute(f"PRAGMA foreign_key_list('{table}');")
                    fks = await fks_cursor.fetchall()
                    foreign_keys = {r["from"]: (r["table"], r["to"]) for r in fks}
                    
                    for col in columns:
                        col_name = col["name"]
                        data_type = col["type"]
                        is_pk = bool(col["pk"])
                        is_fk = col_name in foreign_keys
                        ref_tbl = foreign_keys[col_name][0] if is_fk else None
                        ref_col = foreign_keys[col_name][1] if is_fk else None
                        
                        schema_list.append(SchemaMetadata(
                            connection_id=connection_id,
                            table_name=table,
                            column_name=col_name,
                            data_type=data_type,
                            is_pk=is_pk,
                            is_fk=is_fk,
                            ref_table=ref_tbl,
                            ref_column=ref_col
                        ))
        except Exception as e:
            raise

    return schema_list
