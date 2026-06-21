import uuid
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.intent_agent import IntentAgent
from app.agents.schema_agent import SchemaAgent, SchemaContext
from app.agents.sql_generator_agent import SQLGeneratorAgent
from app.agents.validation_agent import ValidationAgent
from app.agents.optimization_agent import OptimizationAgent
from app.agents.explanation_agent import ExplanationAgent
from app.models.query_history import QueryHistory

def test_intent_agent_fallback():
    agent = IntentAgent()
    
    # 1. Test aggregation query
    res = agent.run("What is the total sum of sales today?", [])
    assert res.success is True
    assert res.data.classification == "aggregation"
    assert "today" in res.data.date_ranges
    assert "sales" in res.data.table_hints

    # 2. Test comparison query
    res = agent.run("Compare orders from this month vs last month", [])
    assert res.success is True
    assert res.data.classification == "comparison"
    assert "orders" in res.data.table_hints

def test_schema_agent_confidence():
    agent = SchemaAgent()
    connection_id = uuid.uuid4()
    
    # Mock retriever get_context
    with patch.object(agent.retriever, "get_context") as mock_ctx:
        mock_ctx.return_value = {
            "schema_chunks": ["Table: users. Columns: id (INTEGER), name (VARCHAR). Primary key: id. Foreign keys: None."],
            "example_queries": []
        }
        
        from app.agents.intent_agent import IntentData
        intent = IntentData(classification="lookup", table_hints=["users"])
        
        res = agent.run(intent, connection_id, "Find user details")
        assert res.success is True
        # Confidence score boosted since "users" hint matches retrieved table
        assert res.data.confidence_score > 0.9

@pytest.mark.asyncio
async def test_sql_generator_timeout_fallback(db_session: AsyncSession):
    agent = SQLGeneratorAgent()
    
    from app.models.organization import Organization, PlanEnum
    from app.models.user import User, RoleEnum
    from app.models.database_connection import DatabaseConnection, DBTypeEnum
    
    org = Organization(name="Test Org", plan=PlanEnum.free)
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    
    user = User(
        email="test_fallback@query.com",
        password_hash="hashed",
        role=RoleEnum.analyst,
        org_id=org.id
    )
    db_session.add(user)
    
    connection = DatabaseConnection(
        org_id=org.id,
        name="Test DB",
        db_type=DBTypeEnum.postgresql,
        host_encrypted=b"host",
        port=5432,
        database_name="test_db",
        username_encrypted=b"user",
        password_encrypted=b"pass",
        iv=b"iviviviviviviviv"
    )
    db_session.add(connection)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(connection)
    
    connection_id = connection.id
    user_id = user.id
    
    # Seed a successful query in history to trigger cache fallback
    history_row = QueryHistory(
        user_id=user_id,
        connection_id=connection_id,
        session_id=uuid.uuid4(),
        natural_language="find user name",
        generated_sql="SELECT username FROM users",
        optimized_sql="SELECT username FROM users",
        optimization_report={"report": []},
        execution_time_ms=5,
        row_count=1,
        success=True
    )
    db_session.add(history_row)
    await db_session.commit()

    schema_context = SchemaContext(schema_chunks=[], example_queries=[], confidence_score=0.5)
    from app.agents.intent_agent import IntentData
    intent = IntentData(classification="lookup")

    # Mock call_openai to raise timeout error
    with patch.object(agent, "_call_openai", new_callable=AsyncMock) as mock_call:
        mock_call.side_effect = TimeoutError("OpenAI call timed out")
        
        res = await agent.run(
            schema_context=schema_context,
            question="find user name",
            intent_data=intent,
            conversation_history=[],
            db_type="postgresql",
            db=db_session
        )
        
        # Generator should catch timeout and return cached SQL
        assert res.success is True
        assert res.data == "SELECT username FROM users"
        assert res.fallback_used is True

def test_validation_agent():
    agent = ValidationAgent()
    schemas = ["Table: users. Columns: id (INTEGER), name (VARCHAR). Primary key: id. Foreign keys: None."]
    
    # 1. Valid SQL
    res = agent.run("SELECT id, name FROM users WHERE id = 5", schemas)
    assert res.success is True
    assert res.data.valid is True
    assert len(res.data.errors) == 0

    # 2. Block DML (Delete)
    res = agent.run("DELETE FROM users WHERE id = 5", schemas)
    assert res.success is True
    assert res.data.valid is False
    assert any("DML operation" in err or "Forbidden keyword" in err for err in res.data.errors)

    # 3. Block Stacked Queries
    res = agent.run("SELECT id FROM users; DROP TABLE logs", schemas)
    assert res.success is True
    assert res.data.valid is False
    assert any("Stacked queries" in err for err in res.data.errors)

    # 4. Block SQL comments
    res = agent.run("SELECT id FROM users -- comment here", schemas)
    assert res.success is True
    assert res.data.valid is False
    assert any("comments" in err for err in res.data.errors)

    # 5. Invalid Column name
    res = agent.run("SELECT age FROM users", schemas)
    assert res.success is True
    assert res.data.valid is False
    assert any("does not exist" in err for err in res.data.errors)

def test_optimization_agent():
    agent = OptimizationAgent()
    schemas = ["Table: users. Columns: id (INTEGER), name (VARCHAR), age (INTEGER). Primary key: id. Foreign keys: None."]
    
    # 1. Expand SELECT *
    res = agent.run("SELECT * FROM users", schemas, "postgresql")
    assert res.success is True
    assert "SELECT age, id, name FROM users" in res.data.optimized_sql
    assert any("Expanded SELECT *" in rep for rep in res.data.optimization_report)

    # 2. Rewrite YEAR predicate
    res = agent.run("SELECT name FROM users WHERE YEAR(created_at) = 2026", schemas, "postgresql")
    assert res.success is True
    assert "created_at >= '2026-01-01' AND created_at <= '2026-12-31'" in res.data.optimized_sql
    assert any("Rewrote YEAR" in rep for rep in res.data.optimization_report)

    # 3. Inject MySQL force index hint
    mysql_schemas = ["Table: users. Columns: id (INTEGER). Primary key: id. Foreign keys: None."]
    res = agent.run("SELECT id FROM users WHERE id = 10", mysql_schemas, "mysql")
    assert res.success is True
    assert "users FORCE INDEX (idx_users_id)" in res.data.optimized_sql
    assert any("Injected MySQL index hint" in rep for rep in res.data.optimization_report)

def test_explanation_agent_fallback():
    agent = ExplanationAgent()
    sql = "SELECT id, name FROM users WHERE age >= 18 GROUP BY id ORDER BY name LIMIT 10"
    
    res = agent.run(sql)
    assert res.success is True
    steps = res.data
    assert len(steps) >= 4
    assert any("Query the base records from the 'users'" in step for step in steps)
    assert any("Filter the merged records" in step for step in steps)
    assert any("Group the filtered data" in step for step in steps)
    assert any("Limit the final response" in step for step in steps)
