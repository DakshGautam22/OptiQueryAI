import uuid
from typing import Any
from app.rag.vector_store import VectorStoreService

class RAGRetriever:
    def __init__(self):
        self.vector_store = VectorStoreService()

    def get_context(self, connection_id: uuid.UUID, question: str) -> dict[str, Any]:
        """Queries the vector store to collect context: matching schema chunks and successful example queries."""
        # 1. Fetch relevant table schemas
        schema_chunks = self.vector_store.retrieve_schema(
            connection_id=connection_id,
            query=question,
            top_k=5
        )
        
        # 2. Fetch similar successful historical queries
        example_queries = self.vector_store.retrieve_similar_queries(
            connection_id=connection_id,
            query=question,
            top_k=3
        )
        
        return {
            "schema_chunks": schema_chunks,
            "example_queries": example_queries
        }
