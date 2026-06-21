import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.intent_agent import IntentAgent
from app.agents.schema_agent import SchemaAgent
from app.agents.sql_generator_agent import SQLGeneratorAgent
from app.agents.validation_agent import ValidationAgent
from app.agents.optimization_agent import OptimizationAgent
from app.agents.explanation_agent import ExplanationAgent

class PipelineService:
    def __init__(self):
        self.intent_agent = IntentAgent()
        self.schema_agent = SchemaAgent()
        self.sql_generator_agent = SQLGeneratorAgent()
        self.validation_agent = ValidationAgent()
        self.optimization_agent = OptimizationAgent()
        self.explanation_agent = ExplanationAgent()

    async def run_pipeline(
        self,
        question: str,
        connection_id: uuid.UUID,
        db_type: str,
        conversation_history: list[dict[str, Any]],
        db: AsyncSession
    ) -> dict[str, Any]:
        """Runs the entire multi-agent SQL generation pipeline in sequence, returning the results."""
        
        # 1. Intent Classification Agent
        intent_res = self.intent_agent.run(question, conversation_history)
        if not intent_res.success:
            return {
                "success": False, 
                "error_stage": "INTENT_AGENT", 
                "error_message": intent_res.error_message
            }
        intent_data = intent_res.data

        # 2. Schema Harvesting Agent (RAG Context retrieval)
        schema_res = self.schema_agent.run(intent_data, connection_id, question)
        if not schema_res.success:
            return {
                "success": False, 
                "error_stage": "SCHEMA_AGENT", 
                "error_message": schema_res.error_message
            }
        schema_context = schema_res.data

        # 3. SQL Generator Agent
        sql_res = await self.sql_generator_agent.run(
            schema_context=schema_context,
            question=question,
            intent_data=intent_data,
            conversation_history=conversation_history,
            db_type=db_type,
            db=db
        )
        if not sql_res.success:
            return {
                "success": False, 
                "error_stage": "SQL_GENERATOR_AGENT", 
                "error_message": sql_res.error_message
            }
        generated_sql = sql_res.data

        # 4. Validation Agent (Syntax, DML checks, injection check)
        val_res = self.validation_agent.run(generated_sql, schema_context.schema_chunks)
        if not val_res.success:
            return {
                "success": False, 
                "error_stage": "VALIDATION_AGENT", 
                "error_message": val_res.error_message
            }
        validation_data = val_res.data

        # 5. Optimization Agent (Dialect-specific SQL transformation)
        opt_res = self.optimization_agent.run(
            sql=generated_sql,
            schema_chunks=schema_context.schema_chunks,
            db_type=db_type
        )
        if not opt_res.success:
            return {
                "success": False, 
                "error_stage": "OPTIMIZATION_AGENT", 
                "error_message": opt_res.error_message
            }
        optimized_sql = opt_res.data.optimized_sql
        optimization_report = opt_res.data.optimization_report

        # 6. Explanation Agent (Plain-English execution steps)
        exp_res = self.explanation_agent.run(optimized_sql)
        if not exp_res.success:
            return {
                "success": False, 
                "error_stage": "EXPLANATION_AGENT", 
                "error_message": exp_res.error_message
            }
        explanation_steps = exp_res.data

        # Return full results
        return {
            "success": True,
            "natural_language": question,
            "generated_sql": generated_sql,
            "optimized_sql": optimized_sql,
            "optimization_report": optimization_report,
            "explanation_steps": explanation_steps,
            "validation": {
                "valid": validation_data.valid,
                "errors": validation_data.errors,
                "suggestions": validation_data.suggestions
            },
            "fallback_used": sql_res.fallback_used,
            "schema_chunks": schema_context.schema_chunks
        }
