import hashlib
import numpy as np
from openai import OpenAI
from app.core.config import settings

class EmbeddingService:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.use_openai = bool(self.api_key and not self.api_key.startswith("sk-proj-placeholder"))
        
        if self.use_openai:
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=settings.OPENAI_BASE_URL
            )
        else:
            self.client = None

    def embed(self, text: str) -> list[float]:
        """Generate a 1536-dimensional embedding vector for the given text."""
        if self.use_openai and self.client:
            try:
                response = self.client.embeddings.create(
                    model="text-embedding-3-small",
                    input=text
                )
                return response.data[0].embedding
            except Exception:
                # Log error in real app, fallback to mock in case of API failure
                pass

        # Local deterministic fallback (returns a normalized 1536-dimensional vector based on the string hash)
        return self._generate_fallback_vector(text)

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts in batch."""
        if not texts:
            return []

        if self.use_openai and self.client:
            try:
                response = self.client.embeddings.create(
                    model="text-embedding-3-small",
                    input=texts
                )
                return [item.embedding for item in response.data]
            except Exception:
                # Fallback to local batch processing on API failures
                pass

        return [self._generate_fallback_vector(t) for t in texts]

    def _generate_fallback_vector(self, text: str) -> list[float]:
        """Generate a deterministic 1536-dimensional unit vector based on SHA-256 hash of text."""
        # Standard dimension size for text-embedding-3-small
        dim = 1536
        
        # Seed generator with hash value to make it deterministic for identical inputs
        hasher = hashlib.sha256(text.encode("utf-8"))
        seed = int(hasher.hexdigest()[:8], 16)
        rng = np.random.default_rng(seed)
        
        # Generate random values and normalize to a unit vector
        vector = rng.normal(size=dim)
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
            
        return vector.tolist()
