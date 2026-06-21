import re
from openai import OpenAI
from app.core.config import settings
from app.agents.base import AgentResult

class ExplanationAgent:
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

    def run(self, sql: str) -> AgentResult:
        """Generate a numbered step-by-step plain-English explanation of the SQL query."""
        if self.use_openai and self.client:
            try:
                system_prompt = (
                    "You are a database instructor. Explain the following SQL query in plain English. "
                    "Break down the query execution plan into numbered steps (e.g. 1. 2. 3. ...). "
                    "Only output the steps, one per line. Do not include markdown code block formatting."
                )
                
                response = self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Explain this SQL query: {sql}"}
                    ],
                    temperature=0.0
                )
                
                content = response.choices[0].message.content.strip()
                steps = [line.strip() for line in content.splitlines() if line.strip() and (line.strip()[0].isdigit() or line.strip().startswith("-"))]
                if steps:
                    return AgentResult(success=True, data=steps)
            except Exception:
                pass

        # Local fallback execution
        steps = self._generate_fallback_explanation(sql)
        return AgentResult(success=True, data=steps, fallback_used=True)

    def _generate_fallback_explanation(self, sql: str) -> list[str]:
        """Local parser that extracts SQL clauses and generates corresponding English steps."""
        steps = []
        sql_clean = sql.strip().replace("\n", " ")
        
        # 1. Detect FROM table
        from_match = re.search(r"\bFROM\s+([a-zA-Z0-9_]+)", sql_clean, re.IGNORECASE)
        table = from_match.group(1) if from_match else "target table"
        steps.append(f"1. Query the base records from the '{table}' database table.")

        # 2. Detect JOINs
        joins = re.findall(r"\bJOIN\s+([a-zA-Z0-9_]+)\b", sql_clean, re.IGNORECASE)
        for join_table in joins:
            steps.append(f"2. Perform an INNER JOIN with table '{join_table}' on the specified key relations.")

        # 3. Detect WHERE filters
        where_match = re.search(r"\bWHERE\s+(.*?)(?:\bGROUP BY\b|\bORDER BY\b|\bLIMIT\b|$)", sql_clean, re.IGNORECASE)
        if where_match:
            condition = where_match.group(1).strip()
            # Clean comments or mysql force index
            condition_clean = re.sub(r"\bFORCE INDEX.*?\b", "", condition, flags=re.IGNORECASE).strip()
            steps.append(f"3. Filter the merged records using conditions: {condition_clean}.")

        # 4. Detect GROUP BY
        group_match = re.search(r"\bGROUP BY\s+(.*?)(?:\bORDER BY\b|\bLIMIT\b|$)", sql_clean, re.IGNORECASE)
        if group_match:
            group_cols = group_match.group(1).strip()
            steps.append(f"4. Group the filtered data by columns: '{group_cols}' to compute aggregates.")

        # 5. Detect SELECT expressions
        select_match = re.search(r"\bSELECT\s+(.*?)\bFROM\b", sql_clean, re.IGNORECASE)
        if select_match:
            exprs = select_match.group(1).strip()
            steps.append(f"5. Project the aggregate results or explicit fields: '{exprs}'.")

        # 6. Detect ORDER BY
        order_match = re.search(r"\bORDER BY\s+(.*?)(?:\bLIMIT\b|$)", sql_clean, re.IGNORECASE)
        if order_match:
            order_cols = order_match.group(1).strip()
            steps.append(f"6. Sort the final output records by: '{order_cols}'.")

        # 7. Detect LIMIT
        limit_match = re.search(r"\bLIMIT\s+(\d+)", sql_clean, re.IGNORECASE)
        if limit_match:
            limit = limit_match.group(1)
            steps.append(f"7. Limit the final response payload to the top {limit} rows.")

        return steps
