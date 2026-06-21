# OptiQuery AI 🚀

[![CI/CD Pipeline](https://github.com/DakshGautam22/OptiQueryAI/actions/workflows/ci.yml/badge.svg)](https://github.com/DakshGautam22/OptiQueryAI/actions/workflows/ci.yml)

**Talk to your database in plain English.** OptiQuery AI is an intelligent Natural Language to SQL (NL-to-SQL) platform that translates everyday business questions into precise, optimized SQL queries, executes them securely, and displays the results in beautiful charts and tables.

---

## 🌟 Key Features

*   🗣️ **Natural Language Queries**: No SQL knowledge required. Ask questions like *"Who are our top 5 customers by sales this month?"* and get answers instantly.
*   🤖 **Smart Multi-Agent Pipeline**: Six specialized AI agents work together to verify intents, fetch schemas, generate draft SQL, validate query safety, optimize performance, and explain the logic in simple terms.
*   📊 **Visual Results**: Instantly render raw database rows as interactive data tables and charting visualizations.
*   🔒 **Secure by Design**: Credentials are protected using AES-256 encryption. Query execution is restricted to safe, read-only queries.

---

## 🧭 How It Works

```
1. Ask a Question ────────> 2. AI Multi-Agent Pipeline ────────> 3. Secure Execution ────────> 4. Visualize Results
  (Plain English)             (DDL Retrieval & Validation)        (Safe Read-Only DB Run)      (Charts & Tables)
```

---


## Architecture

OptiQuery AI utilizes a decoupled client-server architecture with integrated vector embeddings search and a secure agent execution lifecycle.

```mermaid
graph TD
    Client[Next.js Frontend Client - Port 3000] <-->|HTTP / REST / Cookies| API[FastAPI Backend Server - Port 8000]
    
    subgraph FastAPI Backend App
        API <--> Router[API Routers: Auth, Connections, Query, Chat, Admin]
        Router <--> Pipeline[Agent Pipeline Coordinator]
        Pipeline <--> DB[PostgreSQL Core Database]
        Pipeline <--> RAG[Vector Store Service]
    end

    subgraph Vector RAG Engine
        RAG <--> Chroma[(ChromaDB Server - Port 8001)]
    end
    
    subgraph Multi-Agent SQL Pipeline
        Pipeline --> A1[Intent Agent]
        A1 --> A2[Schema Agent]
        A2 --> A3[Generator Agent]
        A3 --> A4[Validation Agent]
        A4 --> A5[Optimizer Agent]
        A5 --> A6[Explanation Agent]
        A1 & A2 & A3 & A4 & A5 & A6 <--> LLM{OpenAI GPT-4o / LLM}
    end

    subgraph External Connections
        Pipeline <-->|Secure Transactions| TargetDB[(Target Customer Databases: PG / MySQL)]
    end
```

---

## Prerequisites

Before starting, ensure you have the following installed on your system:
- **Node.js** (v18.x or higher)
- **Python** (v3.10 or higher)
- **Docker & Docker Compose** (v2.0 or higher)
- **OpenAI API Key** (or equivalent endpoint credentials)

---

## Quickstart

Get the full stack up and running locally in exactly **5 commands**:

```bash
# 1. Clone the repository
git clone https://github.com/DakshGautam22/OptiQueryAI.git

# 2. Enter the workspace directory
cd OptiQueryAI

# 3. Create the environment settings file
copy .env.example .env

# 4. Spin up the Postgres database, ChromaDB, FastAPI Backend, Next.js client, and Seeding service
docker compose up --build -d

# 5. Verify the health status of the backend API
curl http://localhost:8000/health
```

*OptiQuery AI is now ready! Visit **http://localhost:3000** in your browser.*

---

## Environment Variables Reference

Configure these settings inside your `.env` file at the root of the project:

| Variable Name | Description | Example Value | Required |
| :--- | :--- | :--- | :---: |
| `DATABASE_URL` | Async connection string for the core Postgres database. | `postgresql+asyncpg://postgres:postgres@localhost:5432/optiquery_ai` | Yes |
| `JWT_SECRET_KEY` | Salt for encoding user authentication session cookies. | `use-a-secure-32-byte-hex-string` | Yes |
| `JWT_PRIVATE_KEY_PATH` | File path to the RSA PEM private key for JWT signatures. | `jwt_private.pem` | Yes |
| `JWT_PUBLIC_KEY_PATH` | File path to the RSA PEM public key for JWT signatures. | `jwt_public.pem` | Yes |
| `DATABASE_ENCRYPTION_KEY` | 32-byte Fernet key for encrypting connection credentials. | `base64-encoded-fernet-key-32-bytes=` | Yes |
| `CREDENTIAL_ENCRYPTION_KEY`| Secondary key used to protect passwords in connection pools. | `base64-encoded-fernet-key-32-bytes=` | Yes |
| `OPENAI_API_KEY` | Secret credentials to execute LLM calls for agents. | `sk-proj-XXXXXXXXXXXXXXXXXXXXXXXX` | Yes |
| `CHROMA_PERSIST_DIRECTORY` | Local file path for vector database storage. | `./chroma_db` | No |
| `CHROMA_SERVER_HOST` | Hostname of remote Chroma server (used in Docker). | `chromadb` | No |
| `CHROMA_SERVER_PORT` | Port of remote Chroma server (used in Docker). | `8000` | No |

---

## API Endpoint Reference

The backend API exposes the following key endpoints:

### Authentication Router (`/auth`)
- `POST /auth/register` - Create user credentials and default organization.
- `POST /auth/login` - Authenticate session and write secure HttpOnly cookies.
- `GET /auth/me` - Retrieve current user profile and subscription tier.
- `POST /auth/change-password` - Validate old credentials and modify password.
- `DELETE /auth/logout` - Clear cookies and close active sessions.

### Connections Router (`/connections`)
- `GET /connections` - List active database connection configurations.
- `POST /connections` - Securely save new connection parameters (AES encrypted).
- `GET /connections/{id}/schema` - Browse metadata schema maps.
- `POST /connections/{id}/test` - Perform health connectivity checks.
- `POST /connections/{id}/refresh` - Force RAG re-indexing and schema harvesting.
- `DELETE /connections/{id}` - Revoke credentials and wipe database index.

### Query Router (`/query`)
- `POST /query/generate` - Execute the 6-agent NL-to-SQL generation pipeline.
- `POST /query/execute` - Execute the generated SQL query and return rows.
- `GET /query/history` - View searchable query analytics and logs.

### Admin Router (`/admin`)
- `GET /admin/users` - List all members inside the administrator's organization.
- `PUT /admin/users/{user_id}` - Toggle member active status or update user roles.
- `GET /admin/audit-logs` - Retrieve global audit trails of query logs.

---

## How to Add a New Agent

To introduce a new agent (e.g., a "Security Guard Agent" to scan queries for SQL Injection) to the pipeline, follow these steps:

1. **Define the Agent Class**:
   Create a new Python class inside the `app/agents/` directory that inherits from `BaseAgent` (or the equivalent abstract interface).
   ```python
   from app.agents.base import BaseAgent
   
   class SecurityAgent(BaseAgent):
       async def run(self, state: dict) -> dict:
           # Write prompt calling OpenAI to scan for SQL Injection
           # Append output or flags to state
           return state
   ```

2. **Add prompts and metadata**:
   Create system messages and validation prompts for the LLM. Keep this isolated inside the agent file.

3. **Register in Pipeline Coordinator**:
   Open `app/agents/pipeline.py` (or the coordinator file) and add the agent to the execution flow.
   ```python
   from app.agents.security import SecurityAgent
   
   # In the run_pipeline method:
   state = await SecurityAgent().run(state)
   ```

4. **Update the Frontend Stepper**:
   Add the new step indicator to `frontend/components/query/agent-pipeline-status.tsx` to display its status (`loading`, `success`, `error`) in the user interface.

---

## How to Swap the LLM Model

OptiQuery AI utilizes OpenAI's chat completions API by default. To swap the model:

1. **Locate the LLM wrapper**:
   Open `app/core/llm.py` (or the agent core file that invokes LLM completion calls).
   
2. **Modify the Model Parameter**:
   Locate where `model="gpt-4o"` is specified in `openai.chat.completions.create` and change it to your desired model (e.g., `model="gpt-4-turbo"` or a custom finetuned version).

3. **Configure API Endpoints**:
   If swapping to an alternative LLM provider (like Anthropic Claude or Google Gemini), implement their SDK handler inside `app/core/llm.py` and supply the required API keys (e.g., `ANTHROPIC_API_KEY`) in your `.env` file.

---

## Troubleshooting

Here are the 5 most common setup errors and how to fix them:

### 1. `NameError: name 'get_current_user' is not defined`
* **Cause**: Missing imports in the FastAPI auth endpoints.
* **Fix**: Ensure `from app.core.dependencies import get_current_user` is present at the top of `app/api/auth.py`.

### 2. `ValueError: Key must be 32 url-safe base64-encoded bytes`
* **Cause**: `DATABASE_ENCRYPTION_KEY` or `CREDENTIAL_ENCRYPTION_KEY` in your `.env` is invalid or not encoded properly.
* **Fix**: Generate a new key by executing `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and copy the result to your `.env`.

### 3. JWT Keys Not Found on Start
* **Cause**: `jwt_private.pem` and `jwt_public.pem` files are missing from the root directory.
* **Fix**: Generate a new RSA keypair using OpenSSL:
  ```bash
  openssl genpkey -algorithm RSA -out jwt_private.pem -pkeyopt rsa_keygen_bits:2048
  openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem
  ```

### 4. Database Connection Refused inside Docker
* **Cause**: The backend container is attempting to connect to `localhost:5432`, which refers to itself rather than the Postgres container.
* **Fix**: Ensure your `docker-compose.yml` environment section overrides `DATABASE_URL` to point to the `postgres` service name: `DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/optiquery_ai`.

### 5. `ModuleNotFoundError: No module named 'app'` when running migrations
* **Cause**: Python is unable to resolve the project packages because the current working directory is not added to `PYTHONPATH`.
* **Fix**: Run the command with `PYTHONPATH=. alembic upgrade head` on Unix, or `set PYTHONPATH=.` on Windows CMD before running alembic.
