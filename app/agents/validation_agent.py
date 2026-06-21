import re
from pydantic import BaseModel, Field
import sqlglot
from sqlglot import exp
from app.agents.base import AgentResult

class ValidationData(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class ValidationAgent:
    def run(self, sql: str, schema_chunks: list[str]) -> AgentResult:
        """Parse, validate, and check SQL statements for safety, schemas matching, and injections."""
        errors: list[str] = []
        suggestions: list[str] = []

        # 1. Block stacked queries (multiple SQL statements)
        try:
            statements = sqlglot.parse(sql)
            if len(statements) > 1:
                errors.append("Stacked queries (multiple statements) are not allowed.")
        except Exception as e:
            pass

        # 2. Block comment injection patterns
        if "--" in sql or "/*" in sql or "*/" in sql:
            errors.append("SQL comments (--, /*, */) are forbidden to prevent comment injection.")

        # 3. Parse SQL syntax and check DML
        try:
            parsed = sqlglot.parse_one(sql)
        except Exception as e:
            errors.append(f"SQL Syntax Error: {str(e)}")
            return AgentResult(
                success=True,
                data=ValidationData(valid=False, errors=errors, suggestions=suggestions)
            )

        # Check nodes for DML actions
        dml_nodes = (exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Create)
        for node in parsed.find_all(dml_nodes):
            errors.append(f"DML operation '{node.__class__.__name__}' is forbidden. ONLY SELECT is permitted.")

        # Check raw query keywords for safety
        sql_upper = sql.upper()
        forbidden_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE", "RENAME", "GRANT", "REVOKE"]
        for kw in forbidden_keywords:
            # Match word boundaries to avoid false positives (e.g. column named "created_at")
            if re.search(r'\b' + kw + r'\b', sql_upper):
                errors.append(f"Forbidden keyword '{kw}' detected. Only read operations are permitted.")

        # Check UNION-based injections
        if parsed.find(exp.Union):
            errors.append("UNION operations are blocked by default to prevent data leakage injection vectors.")

        # 4. Schema verification (Tables & Columns matching)
        known_tables = self._parse_schema_chunks(schema_chunks)
        tables_in_sql = [t.name.lower() for t in parsed.find_all(exp.Table)]

        if known_tables:
            for t in tables_in_sql:
                if t not in known_tables:
                    errors.append(f"Table '{t}' is not defined in the harvested schema.")
                    suggestions.append(f"Ensure table name matches one of: {', '.join(known_tables.keys())}")
                else:
                    # Check table column references
                    pass
            
            # Verify columns
            for col_node in parsed.find_all(exp.Column):
                col_name = col_node.name.lower()
                # Skip numeric or string constant column names
                if col_name.isdigit():
                    continue

                if col_node.table:
                    col_table = col_node.table.lower()
                    if col_table in known_tables:
                        if col_name not in known_tables[col_table]:
                            errors.append(f"Column '{col_name}' does not exist on table '{col_table}'.")
                            suggestions.append(f"Available columns on '{col_table}': {', '.join(known_tables[col_table])}")
                else:
                    # Unqualified column name - check if it exists in any referenced table
                    found = False
                    for t in tables_in_sql:
                        if t in known_tables and col_name in known_tables[t]:
                            found = True
                            break
                    
                    if tables_in_sql and not found:
                        # Skip common aliases or special values like 'count' to prevent false positives
                        if col_name not in ["count", "sum", "avg", "min", "max", "now", "current_date"]:
                            errors.append(f"Column '{col_name}' does not exist in any referenced tables: {tables_in_sql}.")

        valid = len(errors) == 0
        validation_data = ValidationData(
            valid=valid,
            errors=errors,
            suggestions=suggestions
        )
        return AgentResult(success=True, data=validation_data)

    def _parse_schema_chunks(self, schema_chunks: list[str]) -> dict[str, set[str]]:
        """Parses list of RAG schema text chunks into a dictionary mapping table name to column names."""
        known_tables: dict[str, set[str]] = {}
        for chunk in schema_chunks:
            table_match = re.search(r"Table:\s*([a-zA-Z0-9_]+)\.", chunk)
            if table_match:
                table_name = table_match.group(1).lower()
                
                # Extract columns segment
                columns_match = re.search(r"Columns:\s*(.*?)\.\s*Primary", chunk)
                if columns_match:
                    cols_text = columns_match.group(1)
                    col_names = set()
                    
                    # Split columns (e.g. "id (INTEGER), name (VARCHAR(255))")
                    for col_part in cols_text.split(","):
                        col_part = col_part.strip()
                        col_name_match = re.match(r"([a-zA-Z0-9_]+)", col_part)
                        if col_name_match:
                            col_names.add(col_name_match.group(1).lower())
                            
                    known_tables[table_name] = col_names
        return known_tables
