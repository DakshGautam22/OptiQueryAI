import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import OpenAI
from app.core.config import settings
from app.agents.base import AgentResult
from app.agents.intent_agent import IntentData
from app.agents.schema_agent import SchemaContext
from app.models.query_history import QueryHistory

class SQLGeneratorAgent:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.use_openai = bool(self.api_key and not self.api_key.startswith("sk-proj-placeholder"))
        
        # Instantiate OpenAI client (note: OpenAI synchronous client is usually fine, but wrapping it
        # in an async executor or using asyncio.to_thread is required to avoid blocking)
        if self.use_openai:
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=settings.OPENAI_BASE_URL
            )
        else:
            self.client = None

    async def run(
        self,
        schema_context: SchemaContext,
        question: str,
        intent_data: IntentData,
        conversation_history: list[dict],
        db_type: str,
        db: AsyncSession
    ) -> AgentResult:
        """Translate natural language questions to raw SQL statements. Falls back to cached queries on timeout."""
        
        # Check for matching cached query in query_history to use as fallback on timeout/error
        cached_sql = await self._lookup_cached_query(question, db)

        if self.use_openai and self.client:
            try:
                # Format schemas
                schemas_str = "\n".join(schema_context.schema_chunks)
                
                # Format examples
                examples_str = ""
                for idx, eg in enumerate(schema_context.example_queries):
                    examples_str += f"Example {idx+1}:\nNL: {eg['natural_language']}\nSQL: {eg['generated_sql']}\n\n"

                # Format conversation context
                history_context = ""
                for msg in conversation_history[-6:]:
                    role = msg.get("role", "user")
                    content = msg.get("content", "")
                    history_context += f"{role}: {content}\n"

                system_prompt = (
                    f"You are a Senior database developer specializing in writing SQL queries for {db_type} databases.\n"
                    "Convert the natural language prompt into a single syntactically correct SQL SELECT statement.\n"
                    "RULES:\n"
                    "1. Return ONLY the raw SQL query text. Do not include markdown formatting block like ```sql.\n"
                    "2. Avoid using SELECT *; explicitly query column names.\n"
                    "3. Ensure the SQL matches the schema definitions provided.\n"
                    "4. If no schema details match, return a SQL query based on best guesses.\n\n"
                    f"SCHEMA DETAILS:\n{schemas_str}\n\n"
                    f"EXAMPLE QUERIES:\n{examples_str}"
                )

                prompt = (
                    f"Conversation History:\n{history_context}\n"
                    f"User Intent: {intent_data.classification}\n"
                    f"User Question: {question}"
                )

                # Execute LLM call with a strict timeout (e.g., 8 seconds) to trigger fallback
                raw_sql = await asyncio.wait_for(
                    self._call_openai(system_prompt, prompt),
                    timeout=8.0
                )
                
                sql_cleaned = self._clean_sql(raw_sql)
                return AgentResult(success=True, data=sql_cleaned)

            except (asyncio.TimeoutError, Exception) as e:
                # LLM timeout or error occurred - attempt to return cached query
                if cached_sql:
                    return AgentResult(success=True, data=cached_sql, fallback_used=True)
                
                return AgentResult(
                    success=False,
                    data=None,
                    error_code="LLM_GENERATION_FAILED",
                    error_message=f"SQL Generation failed and no fallback available: {str(e)}"
                )

        # Local fallback execution if OpenAI API is disabled
        if cached_sql:
            return AgentResult(success=True, data=cached_sql, fallback_used=True)

        # Return a generated basic guess SQL if no cache exists
        guess_sql = self._generate_guess_sql(question, intent_data, db_type)
        return AgentResult(success=True, data=guess_sql, fallback_used=True)

    async def _call_openai(self, system_prompt: str, prompt: str) -> str:
        """Executes the OpenAI API call in a non-blocking threadpool."""
        return await asyncio.to_thread(
            self._execute_openai_sync, system_prompt, prompt
        )

    def _execute_openai_sync(self, system_prompt: str, prompt: str) -> str:
        """Synchronous wrapper for OpenAI client chat creation."""
        response = self.client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0
        )
        return response.choices[0].message.content

    async def _lookup_cached_query(self, question: str, db: AsyncSession) -> str | None:
        """Find the latest successful generated SQL for an identical natural language question."""
        try:
            stmt = select(QueryHistory).where(
                QueryHistory.natural_language == question,
                QueryHistory.success == True
            ).order_by(QueryHistory.created_at.desc()).limit(1)
            
            result = await db.execute(stmt)
            row = result.scalar_one_or_none()
            return row.generated_sql if row else None
        except Exception:
            return None

    def _clean_sql(self, sql: str) -> str:
        """Cleans markdown code snippets and leading/trailing spacing out of LLM responses."""
        cleaned = sql.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            # Remove ```sql or ``` line
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()
        # Strip trailing semicolon if present
        if cleaned.endswith(";"):
            cleaned = cleaned[:-1].strip()
        return cleaned

    def _generate_guess_sql(self, question: str, intent_data: IntentData, db_type: str) -> str:
        """Synthesizes a basic mock SQL query based on keywords in the question."""
        table = intent_data.table_hints[0] if intent_data.table_hints else "users"
        limit_clause = " LIMIT 10" if db_type == "postgresql" else " LIMIT 10"
        return f"SELECT * FROM {table}{limit_clause}"
