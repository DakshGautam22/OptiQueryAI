# Deferred Phase 2 Features & Technical Design Contracts

This document captures the feature roadmap deferred to Phase 2 of OptiQuery AI development. To maintain modularity, future implementations must adhere strictly to the following interface contracts.

---

## 1. Voice-to-SQL Integration

### Description
Allows analysts to dictate business questions instead of typing. The speech audio is processed and transcribed into a clean natural language query string to be fed directly into the SQL generator pipeline.

### Technical Contract

```python
import abc

class VoiceTranscriptionProvider(abc.ABC):
    """
    Abstract interface for converting speech audio files into text queries.
    """

    @abc.abstractmethod
    async def transcribe_audio(self, audio_bytes: bytes, content_type: str) -> str:
        """
        Transcribes incoming voice recordings.
        
        Args:
            audio_bytes: The raw speech audio payload.
            content_type: MIME type of the audio container (e.g., 'audio/wav', 'audio/mpeg').
            
        Returns:
            The transcribed natural language text query.
            
        Raises:
            TranscriptionError: If speech-to-text API fails or audio format is invalid.
        """
        pass
```

### Proposed Endpoint
- `POST /query/voice`
  - Consumes: `multipart/form-data` (file and connection details)
  - Returns: `{ "transcription": str, "generated_sql": str, "execution_result": dict }`

---

## 2. Insights Generator (Auto-dashboard Builder)

### Description
Analyzes harvested database connection schemas and automatically generates key performance indicators (KPIs), charts, and diagnostic reports without requiring prompt questions.

### Technical Contract

```python
import abc
from typing import TypedDict
from pydantic import BaseModel

class ChartConfig(BaseModel):
    chart_type: str  # 'bar', 'line', 'pie', 'kpi'
    x_axis: str
    y_axis: str
    title: str

class SuggestedInsight(BaseModel):
    title: str
    natural_language_reasoning: str
    recommended_sql: str
    recommended_chart: ChartConfig

class InsightsGenerator(abc.ABC):
    """
    Abstract interface for scanning schema metadata and outputting business insight charts.
    """

    @abc.abstractmethod
    async def generate_dashboard_insights(
        self, 
        schema_summary: str, 
        limit: int = 5
    ) -> list[SuggestedInsight]:
        """
        Inspects the tables, columns, and relations to recommend business metrics.
        
        Args:
            schema_summary: DDL schema context in markdown or textual format.
            limit: Maximum number of suggested cards.
            
        Returns:
            A list of recommended SQL queries and chart templates.
        """
        pass
```

### Proposed Endpoint
- `GET /connections/{connection_id}/insights`
  - Returns: `list[SuggestedInsight]`

---

## 3. LLM Model Switching Engine

### Description
Enables administrators to switch the underlying foundational model (e.g., swapping from GPT-4o to Claude 3.5 Sonnet or Gemini 1.5 Pro) based on cost, latency, or compliance requirements.

### Technical Contract

```python
import abc
from typing import Any

class ChatMessage(abc.ABC):
    role: str  # 'system', 'user', 'assistant'
    content: str

class LLMProvider(abc.ABC):
    """
    Unified abstract interface for chat model invocation.
    """

    @property
    @abc.abstractmethod
    def provider_name(self) -> str:
        """Returns provider identifier (e.g., 'openai', 'anthropic', 'google')."""
        pass

    @abc.abstractmethod
    async def generate_completion(
        self, 
        messages: list[dict[str, str]], 
        model_name: str,
        temperature: float = 0.0,
        max_tokens: int = 1000
    ) -> str:
        """
        Requests model inferences with clean unified parameters.
        
        Args:
            messages: Role/content dialogue payload.
            model_name: Exact LLM identifier (e.g., 'gpt-4o', 'claude-3-5-sonnet').
            temperature: Sampling randomness.
            max_tokens: Completion boundary limits.
            
        Returns:
            The raw text output.
        """
        pass
```

### Proposed Endpoint
- `POST /admin/settings/llm`
  - Consumes: `{ "provider": str, "model_name": str }`
  - Returns: `{ "status": "active", "active_provider": str }`

---

## 4. Admin Analytics Dashboard

### Description
Provides metrics on query volume, execution latencies, token consumption, caching efficiency, database error frequencies, and active connections across the entire system.

### Technical Contract

```python
import abc
from datetime import datetime
from pydantic import BaseModel

class MetricTimeSeriesPoint(BaseModel):
    timestamp: datetime
    value: float

class AnalyticsReport(BaseModel):
    total_queries: int
    success_rate: float
    average_latency_ms: float
    total_tokens_used: int
    cache_hits: int
    volume_over_time: list[MetricTimeSeriesPoint]
    latency_over_time: list[MetricTimeSeriesPoint]

class AdminAnalyticsService(abc.ABC):
    """
    Interface for compiling SaaS administrative analytics.
    """

    @abc.abstractmethod
    async def get_system_analytics(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> AnalyticsReport:
        """
        Aggregates query history metrics across all system connection audit logs.
        
        Args:
            start_date: Begin timestamp window.
            end_date: Close timestamp window.
            
        Returns:
            The compiled analytics report structure.
        """
        pass
```

### Proposed Endpoint
- `GET /admin/analytics`
  - Query params: `start_date`, `end_date`
  - Returns: `AnalyticsReport`
