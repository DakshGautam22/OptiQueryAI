# OptiQuery AI - Data Flow Diagram (DFD)

This document maps out how data flows through **OptiQuery AI**—from a user's initial natural language query in the Next.js frontend, through the FastAPI backend and multi-agent pipeline, into vector databases for schema harvesting, and finally executing secure SQL transactions against customer databases.

---

## 1. High-Level Data Flow Architecture

Below is the structured path that data takes during a query generation and execution lifecycle.

```mermaid
graph TD
    %% Define styles
    classDef client fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef backend fill:#f0fdf4,stroke:#16a34a,stroke-width:2px;
    classDef agent fill:#faf5ff,stroke:#7e22ce,stroke-width:2px;
    classDef db fill:#fef2f2,stroke:#dc2626,stroke-width:2px;

    %% Components
    User([Business User]):::client
    UI[Next.js Client UI]:::client
    Router[FastAPI API Routers]:::backend
    Coord[Pipeline Coordinator]:::backend
    Chroma[(ChromaDB Vector Store)]:::db
    LLM{OpenAI / LLM API}:::agent
    Exec[Execution Service]:::backend
    TargetDB[(Target DB: PG/MySQL/SQLite)]:::db
    AppDB[(Core Application DB)]:::db

    %% Data Flow Connections
    User -->|1. Enters NL Question| UI
    UI -->|2. POST /query/generate + Auth JWT| Router
    Router -->|3. Validate Org & Credentials| AppDB
    Router -->|4. Trigger Agent Pipeline| Coord
    
    %% RAG & Agent Flow
    Coord <-->|5. Semantic Schema Retrieval| Chroma
    Coord <-->|6. Iterate Agent Prompts & Context| LLM
    Coord -->|7. Verified SQL Query| Exec
    
    %% Execution Flow
    Exec -->|8. Fetch Decrypted Credentials| AppDB
    Exec -->|9. Safe Read-Only SQL Execution| TargetDB
    TargetDB -->|10. Return Raw Rows & Columns| Exec
    Exec -->|11. Log Query Metrics| AppDB
    Exec -->|12. SQL, Rows, Charts & Explanation| UI
    UI -->|13. Display Structured Results| User
```

---

## 2. Detailed Pipeline Data Flow

The backend handles natural language-to-SQL translations using a 6-stage sequential agent pipeline. Here is the data structure passing through the pipeline:

```
[User NL Input] ──> (Intent Agent) ──> (Schema Agent) ──> (Generator Agent)
                                                             │
[Paginated Output] <── (Explanation Agent) <── (Optimizer Agent) <── (Validation Agent)
```

### Stage-by-Stage Data Transformation

| Stage | Input Data | Transformation / Process | Output Data |
| :--- | :--- | :--- | :--- |
| **1. Intent Agent** | NL Question, Target Dialect | Analyzes intent (SQL vs. general chat), performs security check (SQL Injection & Prompt Injection detection). | Intent Flag (`is_sql`), Security Status |
| **2. Schema Agent** | NL Question, Connection metadata | Queries **ChromaDB** with embeddings of the question. Extracts similar tables, columns, types, and sample queries. | Schema Context (Harvested DDL & Table Descriptions) |
| **3. Generator Agent**| NL Question, Schema Context, Dialect | Constructs system prompt containing guidelines, harvested schema, and asks LLM to write the draft query. | Draft SQL Query |
| **4. Validation Agent**| Draft SQL Query, Schema Metadata | Syntactically parses the SQL. Rejects non-read operations (`INSERT`, `UPDATE`, `DELETE`, `DROP`). Ensures only valid tables are accessed. | Validated SQL Query (or syntax/security errors) |
| **5. Optimizer Agent** | Validated SQL Query, Schema Indexes | Analyzes query plan hints, validates index coverage, applies limits, and rewrites inefficient joins/subqueries. | Optimized SQL Query |
| **6. Explanation Agent**| Optimized SQL Query, Original NL Question | Prompts the LLM to generate an intuitive explanation of the SQL logic for non-technical users. | HTML/Markdown SQL Explanation |

---

## 3. Security & Credentials Data Flow

To run queries securely on customer databases, OptiQuery AI uses **AES-256 Fernet encryption** to encrypt and decrypt database credentials in transit and at rest.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Organization Admin
    participant UI as Next.js Client
    participant API as FastAPI Backend
    participant Key as Environment Key
    participant DB as Core App DB (Sqlite/Postgres)
    participant Target as Target Database

    Admin->>UI: Input Target Database Credentials (Host, User, Pass)
    UI->>API: POST /connections (HTTPS Post Body)
    Note over API: Load DATABASE_ENCRYPTION_KEY
    API->>API: Encrypt password/credentials (AES-256 Fernet)
    API->>DB: Save Encrypted Record in `database_connections` table
    
    Note over Admin, Target: Query Execution Flow
    Admin->>UI: Request NL Query
    UI->>API: POST /query/execute (Connection ID)
    API->>DB: Fetch Encrypted Connection Record
    API->>API: Decrypt password using key
    API->>Target: Open connection pool & execute read-only query
    Target-->>API: Return rows
    API-->>UI: Return result set
```

> [!IMPORTANT]
> The encryption keys (`DATABASE_ENCRYPTION_KEY` and `CREDENTIAL_ENCRYPTION_KEY`) are stored exclusively in root environment variables (`.env`) and are never written to any database tables or committed to version control.
