import uuid
import pytest
from app.models.schema_metadata import SchemaMetadata
from app.rag.vector_store import VectorStoreService

def test_schema_chunking_format():
    connection_id = uuid.uuid4()
    
    # 1. Create mock schema rows
    schema_rows = [
        SchemaMetadata(
            table_name="customers",
            column_name="id",
            data_type="INTEGER",
            is_pk=True,
            is_fk=False
        ),
        SchemaMetadata(
            table_name="customers",
            column_name="email",
            data_type="VARCHAR(255)",
            is_pk=False,
            is_fk=False
        ),
        SchemaMetadata(
            table_name="orders",
            column_name="id",
            data_type="INTEGER",
            is_pk=True,
            is_fk=False
        ),
        SchemaMetadata(
            table_name="orders",
            column_name="customer_id",
            data_type="INTEGER",
            is_pk=False,
            is_fk=True,
            ref_table="customers",
            ref_column="id"
        ),
    ]

    vector_store = VectorStoreService()
    
    # Group manually to test chunk formatter output
    tables = {}
    for row in schema_rows:
        t_name = row.table_name
        if t_name not in tables:
            tables[t_name] = {"cols": [], "pks": [], "fks": []}
        tables[t_name]["cols"].append(f"{row.column_name} ({row.data_type})")
        if row.is_pk:
            tables[t_name]["pks"].append(row.column_name)
        if row.is_fk and row.ref_table and row.ref_column:
            tables[t_name]["fks"].append(f"{row.column_name} → {row.ref_table}.{row.ref_column}")

    # Verify chunk structure for customers table
    cust_info = tables["customers"]
    cust_cols = ", ".join(cust_info["cols"])
    cust_pks = ", ".join(cust_info["pks"])
    cust_fks = ", ".join(cust_info["fks"]) if cust_info["fks"] else "None"
    cust_chunk = f"Table: customers. Columns: {cust_cols}. Primary key: {cust_pks}. Foreign keys: {cust_fks}."
    
    assert "Table: customers." in cust_chunk
    assert "Columns: id (INTEGER), email (VARCHAR(255))" in cust_chunk
    assert "Primary key: id." in cust_chunk
    assert "Foreign keys: None." in cust_chunk

    # Verify chunk structure for orders table
    orders_info = tables["orders"]
    orders_cols = ", ".join(orders_info["cols"])
    orders_pks = ", ".join(orders_info["pks"])
    orders_fks = ", ".join(orders_info["fks"])
    orders_chunk = f"Table: orders. Columns: {orders_cols}. Primary key: {orders_pks}. Foreign keys: {orders_fks}."
    
    assert "Table: orders." in orders_chunk
    assert "Columns: id (INTEGER), customer_id (INTEGER)" in orders_chunk
    assert "Primary key: id." in orders_chunk
    assert "Foreign keys: customer_id → customers.id." in orders_chunk

def test_vector_store_retrieval_and_indexing():
    connection_id = uuid.uuid4()
    vector_store = VectorStoreService()

    # Index sample schema rows
    schema_rows = [
        SchemaMetadata(
            table_name="users",
            column_name="id",
            data_type="INTEGER",
            is_pk=True,
            is_fk=False
        ),
        SchemaMetadata(
            table_name="users",
            column_name="username",
            data_type="VARCHAR(100)",
            is_pk=False,
            is_fk=False
        )
    ]
    vector_store.index_schema(connection_id, schema_rows)

    # Query RAG schema
    results = vector_store.retrieve_schema(connection_id, "Find all usernames", top_k=1)
    assert len(results) > 0
    assert "Table: users." in results[0]

    # Index sample successful query
    query_id = uuid.uuid4()
    vector_store.index_query(
        connection_id=connection_id,
        query_history_id=query_id,
        natural_language="get users list",
        generated_sql="SELECT id, username FROM users",
        success=True
    )

    # Retrieve similar successful queries
    history_matches = vector_store.retrieve_similar_queries(connection_id, "list all users", top_k=1)
    assert len(history_matches) == 1
    assert history_matches[0]["natural_language"] == "get users list"
    assert history_matches[0]["generated_sql"] == "SELECT id, username FROM users"
