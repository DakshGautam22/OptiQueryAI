from typing import Any, Optional
from pydantic import BaseModel, Field

class AgentResult(BaseModel):
    """Common output encapsulation for multi-agent execution results."""
    success: bool
    data: Any
    error_code: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    fallback_used: bool = Field(default=False)
