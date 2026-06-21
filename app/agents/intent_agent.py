import json
from typing import Literal
from pydantic import BaseModel, Field
from openai import OpenAI
from app.core.config import settings
from app.agents.base import AgentResult

class IntentData(BaseModel):
    classification: Literal["analytical", "lookup", "aggregation", "comparison", "unknown"]
    table_hints: list[str] = Field(default_factory=list)
    date_ranges: list[str] = Field(default_factory=list)
    filters: list[str] = Field(default_factory=list)
    is_refinement: bool = Field(default=False)


class IntentAgent:
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

    def run(self, question: str, conversation_history: list[dict]) -> AgentResult:
        """Classify user intent and extract query parameters (table hints, filters, etc.)."""
        if self.use_openai and self.client:
            try:
                # Build context from conversation history
                history_context = ""
                for msg in conversation_history[-6:]:
                    role = msg.get("role", "user")
                    content = msg.get("content", "")
                    history_context += f"{role}: {content}\n"

                system_prompt = (
                    "You are an Intent Extraction Agent. Classify the user question into one of the categories: "
                    "analytical, lookup, aggregation, comparison, or unknown. "
                    "Extract any table names mentioned as table_hints. Extract date/time boundaries as date_ranges. "
                    "Extract general conditions/constraints as filters. Determine if this question is a refinement "
                    "of the previous conversational history (is_refinement)."
                )

                prompt = f"Conversation History:\n{history_context}\nUser Question: {question}"

                # Query OpenAI with JSON schema response enforcement
                response = self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                
                res_content = response.choices[0].message.content
                data = json.loads(res_content)
                
                # Coerce fields into IntentData
                intent_data = IntentData(
                    classification=data.get("classification", "unknown"),
                    table_hints=data.get("table_hints", []),
                    date_ranges=data.get("date_ranges", []),
                    filters=data.get("filters", []),
                    is_refinement=bool(data.get("is_refinement", False))
                )
                return AgentResult(success=True, data=intent_data)
                
            except Exception as e:
                # Log error and trigger local fallback
                pass

        # Local fallback parsing logic
        return AgentResult(success=True, data=self._fallback_classify(question, conversation_history), fallback_used=True)

    def _fallback_classify(self, question: str, conversation_history: list[dict]) -> IntentData:
        """Local heuristic parser to extract intent information when LLM is unavailable."""
        q = question.lower()
        classification = "unknown"
        
        # Heuristics
        if any(w in q for w in ["sum", "avg", "average", "count", "min", "max", "total"]):
            classification = "aggregation"
        elif any(w in q for w in ["compare", "versus", "vs", "than", "difference"]):
            classification = "comparison"
        elif any(w in q for w in ["find", "details of", "who is", "what is", "select", "show me"]):
            classification = "lookup"
        elif any(w in q for w in ["analyse", "trend", "report", "growth", "month over month", "yearly"]):
            classification = "analytical"

        table_hints = []
        for word in q.replace("?", "").replace(",", "").split():
            # Basic table matching guesses (plural words or known entities)
            if word in ["users", "orders", "organizations", "connections", "logs", "customers", "products", "sales"]:
                table_hints.append(word)

        date_ranges = []
        if "today" in q:
            date_ranges.append("today")
        if "yesterday" in q:
            date_ranges.append("yesterday")
        if "month" in q:
            date_ranges.append("current_month")

        filters = []
        if "where" in q:
            # Extract parts after where
            parts = q.split("where")
            if len(parts) > 1:
                filters.append(parts[1].strip())

        is_refinement = len(conversation_history) > 0 and ("it" in q or "that" in q or "previous" in q or "filter" in q or "sort" in q)

        return IntentData(
            classification=classification,
            table_hints=table_hints,
            date_ranges=date_ranges,
            filters=filters,
            is_refinement=is_refinement
        )
