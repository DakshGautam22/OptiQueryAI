import uuid
from pydantic import BaseModel
from app.agents.base import AgentResult
from app.agents.intent_agent import IntentData
from app.rag.retriever import RAGRetriever

class SchemaContext(BaseModel):
    schema_chunks: list[str]
    example_queries: list[dict]
    confidence_score: float


class SchemaAgent:
    def __init__(self):
        self.retriever = RAGRetriever()

    def run(self, intent_data: IntentData, connection_id: uuid.UUID, question: str) -> AgentResult:
        """Fetch matching database schemas and past SQL examples from RAG store."""
        try:
            # 1. Retrieve context
            context = self.retriever.get_context(connection_id, question)
            schema_chunks = context.get("schema_chunks", [])
            example_queries = context.get("example_queries", [])

            # 2. Calculate context confidence score
            confidence = 0.5
            if schema_chunks:
                confidence = 0.8
                # Boost if hints match retrieved schemas
                retrieved_table_names = [
                    chunk.split("Table: ")[1].split(".")[0].lower()
                    for chunk in schema_chunks if "Table: " in chunk
                ]
                
                matches = 0
                for hint in intent_data.table_hints:
                    if hint.lower() in retrieved_table_names:
                        matches += 1
                        
                if intent_data.table_hints:
                    match_ratio = matches / len(intent_data.table_hints)
                    confidence += 0.2 * match_ratio
                    
            confidence = min(1.0, max(0.0, confidence))

            schema_context = SchemaContext(
                schema_chunks=schema_chunks,
                example_queries=example_queries,
                confidence_score=confidence
            )
            return AgentResult(success=True, data=schema_context)
            
        except Exception as e:
            return AgentResult(
                success=False,
                data=None,
                error_code="SCHEMA_RETRIEVAL_FAILED",
                error_message=str(e)
            )
