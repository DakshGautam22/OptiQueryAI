import re
from pydantic import BaseModel, Field
import sqlglot
from sqlglot import exp
from app.agents.base import AgentResult

class OptimizationData(BaseModel):
    optimized_sql: str
    optimization_report: list[str] = Field(default_factory=list)


class OptimizationAgent:
    def run(self, sql: str, schema_chunks: list[str], db_type: str) -> AgentResult:
        """Apply query optimization rules based on schema context and target database dialect."""
        optimized_sql = sql
        report: list[str] = []

        # Parse schema chunks to get table columns and keys
        known_tables, keys = self._parse_schema(schema_chunks)

        # 1. Optimize: Replace SELECT * with explicit columns
        try:
            parsed = sqlglot.parse_one(optimized_sql)
            modified = False
            
            # Find select queries
            for select_node in parsed.find_all(exp.Select):
                # Check if it queries star
                has_star = False
                for expr in select_node.expressions:
                    if isinstance(expr, exp.Star):
                        has_star = True
                        break
                
                if has_star:
                    # Find tables in select
                    tables = [t.name.lower() for t in select_node.find_all(exp.Table)]
                    if tables and tables[0] in known_tables:
                        cols = sorted(list(known_tables[tables[0]]))
                        # Rebuild select expressions with explicit columns
                        new_expressions = [exp.to_column(c) for c in cols]
                        select_node.set("expressions", new_expressions)
                        modified = True
                        report.append(f"Expanded SELECT * to explicit columns for table '{tables[0]}': {cols}")

            if modified:
                dialect = "postgres" if db_type.lower() == "postgresql" else db_type.lower()
                optimized_sql = parsed.sql(dialect=dialect)
        except Exception:
            # Fallback on parse failure
            pass

        # 2. Optimize: Replace YEAR(col) = N with range predicates
        # Matches: YEAR(column) = 2026 or YEAR(column) = '2026'
        year_pattern = r"\bYEAR\(([a-zA-Z0-9_]+)\)\s*=\s*['\"]?(\d{4})['\"]?"
        matches = re.findall(year_pattern, optimized_sql, re.IGNORECASE)
        for col, year in matches:
            old_str = re.search(r"\bYEAR\(" + col + r"\)\s*=\s*['\"]?" + year + r"['\"]?", optimized_sql, re.IGNORECASE).group(0)
            new_str = f"{col} >= '{year}-01-01' AND {col} <= '{year}-12-31'"
            optimized_sql = optimized_sql.replace(old_str, new_str)
            report.append(f"Rewrote YEAR({col}) = {year} to index-friendly range predicate: {new_str}")

        # 3. Optimize: Add index hints for MySQL if filtering on indexed columns (PK/FK)
        if db_type == "mysql":
            try:
                parsed_opt = sqlglot.parse_one(optimized_sql)
                tables_in_sql = [t.name.lower() for t in parsed_opt.find_all(exp.Table)]
                columns_in_where = [c.name.lower() for c in parsed_opt.find_all(exp.Column) if c.find_ancestor(exp.Where)]
                
                # If filtering on a known PK or FK
                for table in tables_in_sql:
                    if table in keys:
                        for col in columns_in_where:
                            if col in keys[table]:
                                # Append FORCE INDEX hint (MySQL syntax)
                                hint_str = f" FORCE INDEX (idx_{table}_{col})"
                                # Simple string replace to append hint after table name
                                table_regex = r"\b" + table + r"\b"
                                optimized_sql = re.sub(table_regex, f"{table}{hint_str}", optimized_sql, count=1, flags=re.IGNORECASE)
                                report.append(f"Injected MySQL index hint for filtered key: {hint_str.strip()}")
                                break
            except Exception:
                pass

        if not report:
            report.append("SQL query already optimal. No transformations applied.")

        opt_data = OptimizationData(
            optimized_sql=optimized_sql,
            optimization_report=report
        )
        return AgentResult(success=True, data=opt_data)

    def _parse_schema(self, schema_chunks: list[str]) -> tuple[dict[str, list[str]], dict[str, set[str]]]:
        """Parses RAG schema chunks to extract columns and key identifiers (PK/FK)."""
        known_tables: dict[str, list[str]] = {}
        keys: dict[str, set[str]] = {}
        
        for chunk in schema_chunks:
            table_match = re.search(r"Table:\s*([a-zA-Z0-9_]+)\.", chunk)
            if table_match:
                table_name = table_match.group(1).lower()
                keys[table_name] = set()
                
                # Columns
                columns_match = re.search(r"Columns:\s*(.*?)\.\s*Primary", chunk)
                if columns_match:
                    cols_text = columns_match.group(1)
                    col_list = []
                    for col_part in cols_text.split(","):
                        col_part = col_part.strip()
                        col_name_match = re.match(r"([a-zA-Z0-9_]+)", col_part)
                        if col_name_match:
                            col_list.append(col_name_match.group(1).lower())
                    known_tables[table_name] = col_list

                # Primary key
                pk_match = re.search(r"Primary key:\s*(.*?)\.\s*Foreign", chunk)
                if pk_match:
                    pks = pk_match.group(1).strip()
                    if pks != "None":
                        for pk in pks.split(","):
                            keys[table_name].add(pk.strip().lower())

                # Foreign keys
                fk_match = re.search(r"Foreign keys:\s*(.*?)\.", chunk)
                if fk_match:
                    fks_text = fk_match.group(1).strip()
                    if fks_text != "None":
                        # e.g. "user_id -> users.id"
                        for fk_part in fks_text.split(","):
                            fk_part = fk_part.strip()
                            col_fk_match = re.match(r"([a-zA-Z0-9_]+)", fk_part)
                            if col_fk_match:
                                keys[table_name].add(col_fk_match.group(1).lower())
                                
        return known_tables, keys
