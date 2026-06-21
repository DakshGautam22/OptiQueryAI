import os
import uuid
import numpy as np
from typing import Any, Optional
from app.rag.embedder import EmbeddingService
from app.models.schema_metadata import SchemaMetadata

try:
    import chromadb
except ImportError:
    chromadb = None


class VectorStoreService:
    def __init__(self, persist_directory: Optional[str] = None):
        self.embedder = EmbeddingService()
        # Default to a persistent directory or a scratch path inside workspace
        self.persist_directory = persist_directory or "./chroma_db"
        
        self.client = None
        if chromadb:
            try:
                chroma_host = os.getenv("CHROMA_SERVER_HOST")
                chroma_port = int(os.getenv("CHROMA_SERVER_PORT", "8000"))
                if chroma_host:
                    self.client = chromadb.HttpClient(host=chroma_host, port=chroma_port)
                else:
                    os.makedirs(self.persist_directory, exist_ok=True)
                    self.client = chromadb.PersistentClient(path=self.persist_directory)
            except Exception:
                pass
                
        # In-memory dictionary database fallback for environments where Chroma cannot compile
        self._fallback_db: dict[str, dict[str, list[Any]]] = {}

    def _get_collection(self, name: str) -> Any:
        """Fetch or create a ChromaDB collection, or return a handle to memory fallback."""
        if self.client:
            try:
                return self.client.get_or_create_collection(
                    name=name,
                    metadata={"hnsw:space": "cosine"}
                )
            except Exception:
                pass
                
        if name not in self._fallback_db:
            self._fallback_db[name] = {
                "ids": [],
                "embeddings": [],
                "documents": [],
                "metadatas": []
            }
        return self._fallback_db[name]

    def index_schema(self, connection_id: uuid.UUID, schema_rows: list[SchemaMetadata]) -> None:
        """Group schema rows by table, chunk into standard format, embed, and index."""
        if not schema_rows:
            return

        # 1. Group columns by table
        tables: dict[str, dict[str, list[str]]] = {}
        for row in schema_rows:
            t_name = row.table_name
            if t_name not in tables:
                tables[t_name] = {"cols": [], "pks": [], "fks": []}
                
            tables[t_name]["cols"].append(f"{row.column_name} ({row.data_type})")
            if row.is_pk:
                tables[t_name]["pks"].append(row.column_name)
            if row.is_fk and row.ref_table and row.ref_column:
                tables[t_name]["fks"].append(f"{row.column_name} → {row.ref_table}.{row.ref_column}")

        # 2. Formulate chunks
        documents = []
        ids = []
        metadatas = []
        for t_name, info in tables.items():
            cols_str = ", ".join(info["cols"])
            pks_str = ", ".join(info["pks"]) if info["pks"] else "None"
            fks_str = ", ".join(info["fks"]) if info["fks"] else "None"
            
            chunk = (
                f"Table: {t_name}. "
                f"Columns: {cols_str}. "
                f"Primary key: {pks_str}. "
                f"Foreign keys: {fks_str}."
            )
            documents.append(chunk)
            ids.append(f"schema_{connection_id}_{t_name}")
            metadatas.append({"connection_id": str(connection_id), "table_name": t_name})

        # 3. Create Embeddings in batch
        embeddings = self.embedder.embed_batch(documents)

        # 4. Save to collection
        collection_name = f"schema_{str(connection_id).replace('-', '_')}"
        col = self._get_collection(collection_name)
        
        if self._is_chroma_collection(col):
            col.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas
            )
        else:
            # Fallback memory insertion
            for i, emb, doc, meta in zip(ids, embeddings, documents, metadatas):
                # Remove if exists
                if i in col["ids"]:
                    idx = col["ids"].index(i)
                    col["embeddings"][idx] = emb
                    col["documents"][idx] = doc
                    col["metadatas"][idx] = meta
                else:
                    col["ids"].append(i)
                    col["embeddings"].append(emb)
                    col["documents"].append(doc)
                    col["metadatas"].append(meta)

    def retrieve_schema(self, connection_id: uuid.UUID, query: str, top_k: int = 5) -> list[str]:
        """Query schemas by similarity using query embeddings."""
        query_vector = self.embedder.embed(query)
        collection_name = f"schema_{str(connection_id).replace('-', '_')}"
        col = self._get_collection(collection_name)

        if self._is_chroma_collection(col):
            try:
                results = col.query(
                    query_embeddings=[query_vector],
                    n_results=top_k
                )
                if results and "documents" in results and results["documents"]:
                    return results["documents"][0]
            except Exception:
                pass
            return []
        else:
            # Memory cosine similarity search
            return self._perform_fallback_query(col, query_vector, top_k)

    def index_query(self, connection_id: uuid.UUID, query_history_id: uuid.UUID, natural_language: str, generated_sql: str, success: bool) -> None:
        """Embed natural language prompt and save query history for lookup."""
        query_vector = self.embedder.embed(natural_language)
        
        collection_name = f"queries_{str(connection_id).replace('-', '_')}"
        col = self._get_collection(collection_name)
        
        doc_id = str(query_history_id)
        metadata = {
            "connection_id": str(connection_id),
            "generated_sql": generated_sql,
            "success": int(success)  # Chroma prefers primitives, cast bool to int
        }

        if self._is_chroma_collection(col):
            col.upsert(
                ids=[doc_id],
                embeddings=[query_vector],
                documents=[natural_language],
                metadatas=[metadata]
            )
        else:
            if doc_id in col["ids"]:
                idx = col["ids"].index(doc_id)
                col["embeddings"][idx] = query_vector
                col["documents"][idx] = natural_language
                col["metadatas"][idx] = metadata
            else:
                col["ids"].append(doc_id)
                col["embeddings"].append(query_vector)
                col["documents"].append(natural_language)
                col["metadatas"].append(metadata)

    def retrieve_similar_queries(self, connection_id: uuid.UUID, query: str, top_k: int = 3) -> list[dict[str, Any]]:
        """Retrieve successful historic SQL queries similar to the current prompt."""
        query_vector = self.embedder.embed(query)
        collection_name = f"queries_{str(connection_id).replace('-', '_')}"
        col = self._get_collection(collection_name)

        matched_queries = []
        if self._is_chroma_collection(col):
            try:
                # Filter to success = 1 in collection queries
                results = col.query(
                    query_embeddings=[query_vector],
                    n_results=top_k,
                    where={"success": 1}
                )
                if results and "documents" in results and results["documents"]:
                    docs = results["documents"][0]
                    metas = results["metadatas"][0]
                    for doc, meta in zip(docs, metas):
                        matched_queries.append({
                            "natural_language": doc,
                            "generated_sql": meta.get("generated_sql", "")
                        })
            except Exception:
                pass
        else:
            # Memory search with filtering
            embeddings = col["embeddings"]
            metadatas = col["metadatas"]
            documents = col["documents"]
            
            # Filter first by success status
            active_indices = [i for i, m in enumerate(metadatas) if m.get("success") == 1]
            if active_indices:
                scores = []
                q_arr = np.array(query_vector)
                for idx in active_indices:
                    d_arr = np.array(embeddings[idx])
                    q_norm = np.linalg.norm(q_arr)
                    d_norm = np.linalg.norm(d_arr)
                    sim = np.dot(q_arr, d_arr) / (q_norm * d_norm) if q_norm > 0 and d_norm > 0 else 0.0
                    scores.append((sim, idx))
                
                # Sort descending
                scores.sort(key=lambda x: x[0], reverse=True)
                for _, idx in scores[:top_k]:
                    matched_queries.append({
                        "natural_language": documents[idx],
                        "generated_sql": metadatas[idx].get("generated_sql", "")
                    })
                    
        return matched_queries

    def _is_chroma_collection(self, col: Any) -> bool:
        """Determines if the collection handle is standard Chroma collection vs fallback dict."""
        return not isinstance(col, dict)

    def _perform_fallback_query(self, col: dict[str, list[Any]], query_vector: list[float], top_k: int) -> list[str]:
        """Internal helper performing cosine similarity search across in-memory vector fallback."""
        embeddings = col["embeddings"]
        documents = col["documents"]
        
        if not embeddings:
            return []
            
        scores = []
        q_arr = np.array(query_vector)
        for idx, d_emb in enumerate(embeddings):
            d_arr = np.array(d_emb)
            q_norm = np.linalg.norm(q_arr)
            d_norm = np.linalg.norm(d_arr)
            sim = np.dot(q_arr, d_arr) / (q_norm * d_norm) if q_norm > 0 and d_norm > 0 else 0.0
            scores.append((sim, idx))
            
        # Sort descending
        scores.sort(key=lambda x: x[0], reverse=True)
        return [documents[idx] for _, idx in scores[:top_k]]
