# SQLWhisper

Ask questions about your PostgreSQL data in plain English. SQLWhisper reads your database schema, uses a fine-tuned language model to generate SQL, executes it in a read-only transaction, and displays the results in a React dashboard.

This is a local, single-user development project.

## Features

- Save and select PostgreSQL connections.
- Extract table definitions, column types, nullability, and key relationships from the `public` schema.
- Generate SQL using **Qwen2.5-Coder-1.5B-Instruct** with a locally saved LoRA adapter.
- Submit natural-language prompts and view results in a table.
- Add connections through a React 19 form action, with loading and error states.
- Use a dark dashboard built with React, TypeScript, and Tailwind CSS.

## How it works

```text
Select a database → Enter a question → Fetch schema → Generate SQL
                                                         ↓
Display results ← Return column names and rows ← Execute query
```

Connection details are stored in a local SQLite database. Queries run against the selected PostgreSQL database, not SQLite. The generated statement is prepared as a single statement and executed in a read-only transaction with a 30-second statement timeout.

## Project structure

```text
SQLWhisper/
├── Backend/
│   ├── main.py                     # FastAPI app and CORS configuration
│   ├── requirements.txt
│   ├── docker-compose.yaml         # Optional local PostgreSQL server
│   ├── controller/
│   │   ├── DatabaseRouter.py        # Saved connections and schema extraction
│   │   └── SQLrouter.py             # Model loading, generation, query execution
│   ├── database/
│   │   └── sqlite.py               # Creates the local credentials database
│   ├── models/qwen-lora-tuned-sql/  # Adapter and tokenizer files
│   └── notebooks/                  # Training, evaluation, and JSONL datasets
└── Frontend/
    ├── src/
    │   ├── assets/                 # SVG files and other assets
    │   ├── components/             # Connection form and database list items
    │   ├── types/                  # API response types
    │   └── webpages/dashboard/     # Dashboard and prompt submission
    └── vite.config.ts
```

## Local setup

The commands below use **PowerShell**, starting from the repository root. The development environment uses Python 3.13 and Node.js 22.19.0. The current model configuration uses CUDA-enabled PyTorch, 4-bit bitsandbytes quantization, and automatic device placement; a compatible NVIDIA GPU and driver are expected for this setup. CPU-only inference has not been validated.

### 1. Prepare the backend environment

```powershell
cd C:\SQLWhisper
py -3.13 -m venv Backend/.venv
.\Backend\.venv\Scripts\python.exe -m pip install torch==2.11.0 --index-url https://download.pytorch.org/whl/cu128
.\Backend\.venv\Scripts\python.exe -m pip install -r Backend/requirements.txt
```

Skip environment creation if `Backend/.venv` already exists. Using its Python executable directly avoids needing to activate the environment.

### 2. Provide the model files

The backend expects these files under `Backend/models/qwen-lora-tuned-sql/`:

```text
adapter_config.json
adapter_model.safetensors
tokenizer.json
tokenizer_config.json
chat_template.jinja
```

If the adapter weights are absent from your checkout, supply the trained artifacts before starting the server. The adapter alone is not the base model: Transformers also loads `Qwen/Qwen2.5-Coder-1.5B-Instruct`, downloading it when it is not already cached. The initial startup can take time and requires sufficient disk space and network access.

### 3. Start PostgreSQL

Use an existing PostgreSQL server, or start the included Docker Compose service:

```powershell
docker compose -f Backend/docker-compose.yaml up -d
```

The included service exposes PostgreSQL at **`localhost:5532`**. Its database name and username are both `sqlwhisper`; its development password is configured in `Backend/docker-compose.yaml`.

**Use port `5532` when adding this Docker database in the dashboard.** Port `5432` is the container's internal port and the usual default for a separately installed PostgreSQL server.

Create or import your tables and data before asking questions. Starting the container does not create an `employees` table or any other application dataset.

### 4. Start FastAPI

From the repository root:

```powershell
.\Backend\.venv\Scripts\python.exe -m uvicorn Backend.main:app --reload --port 8000
```

Wait for `Application startup complete`. Model loading happens during application import, so even the health endpoint is unavailable until loading finishes. Development reloads can reload the model too.

- API documentation: <http://127.0.0.1:8000/docs>
- Health endpoint: <http://127.0.0.1:8000/health>

### 5. Start the frontend

In a second terminal:

```powershell
cd C:\SQLWhisper\Frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. The frontend calls `http://127.0.0.1:8000` directly. FastAPI permits the development origins `http://localhost:5173` and `http://127.0.0.1:5173` through CORS.

## Using the dashboard

1. Click **Add database** and enter the connection settings.
2. Save the connection. Saving stores the settings; it does not test the PostgreSQL connection.
3. Select a database from the list on the right.
4. Enter a question in the **Query [database name]** textarea.
5. Click **Submit prompt** and view the returned rows below it.

For example, if your database contains an `employees` table:

```text
Show the first 5 employees ordered by their ID.
```

The interface prevents duplicate submissions and database switching while a query is running. Prompt drafts are kept separately for each database during the dashboard session.

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Check whether the app is available |
| GET | `/database/getEntries` | List saved connections without passwords |
| POST | `/database/creatingEntry` | Save a connection and return its ID |
| POST | `/sql/prompt/{database_id}` | Generate and execute SQL, then return results |

### Save a connection

Send a JSON body to `POST /database/creatingEntry`:

```json
{
  "host": "localhost",
  "port": 5532,
  "dbname": "sqlwhisper",
  "username": "sqlwhisper",
  "password": "YOUR_DATABASE_PASSWORD",
  "sslmode": "prefer"
}
```

Successful response: HTTP `201` with `{"id": 1}`. No user ID is required; the backend supplies a local single-user value internally.

### Submit a prompt

In Thunder Client, select **POST** and use:

```text
http://127.0.0.1:8000/sql/prompt/1
```

Replace `1` with the saved connection ID. Set the body to JSON:

```json
{
  "prompt": "Show the first 5 employees"
}
```

Example result shape:

```json
{
  "columns": ["id", "name"],
  "rows": [[1, "Alice"], [2, "Bob"]]
}
```

Column names and row values follow the SQL result order. A query with no matching records returns an empty `rows` array. The endpoint currently returns fetched data, not the generated SQL.

## Training and evaluation

`Backend/notebooks/notebook.ipynb` contains the LoRA training workflow; `eval.ipynb` compares the base and tuned models. Run them with `Backend/notebooks` as the working directory so their relative dataset and model paths resolve correctly. Use a Jupyter environment with the model dependencies installed.

Training and inference use this text structure:

```text
Instruction: Translate this question into ONE read-only PostgreSQL 14+ SELECT query. Use only the schema below. Return SQL only; no markdown or explanation.

Database schema:
CREATE TABLE ...;

Question: [user question]
Response:
```

Training examples include the expected SQL after `Response:`. During inference, the model generates that continuation. Evaluation reports perplexity from the model's cross-entropy loss; this is not a measurement of query-result correctness.

## Development checks

```powershell
# From Frontend
npm run build
npm run lint

# From the repository root
.\Backend\.venv\Scripts\python.exe -m pip check
```

## Troubleshooting

| Problem | Check |
| --- | --- |
| `uvicorn` is not recognized | Use the full virtual-environment Python command shown above. |
| `ModuleNotFoundError` | Install `Backend/requirements.txt` using `Backend/.venv/Scripts/python.exe`. |
| Database connection times out | Confirm the server is running and the saved host/port are correct; the included Docker service uses host port `5532`. |
| Adapter or tokenizer cannot be found | Check `Backend/models/qwen-lora-tuned-sql/`. |
| Browser reports a CORS error | Use frontend port `5173`, backend port `8000`, and restart FastAPI after changing CORS settings. |
| Query returns an error | Check the connection, table permissions, and question. Model-generated SQL can be invalid. |

## Current limitations

- Connection passwords are stored as plain text in the local SQLite file `Backend/database/credentials.db`. Keep that file out of version control.
- There is no authentication or per-user authorization. Run this as a local development app, not an exposed multi-user service.
- Schema extraction currently covers tables in `public`.
- Prompts are truncated to 1,024 tokens, and generation is limited to 256 new tokens. Large schemas or long queries may be cut off.
- Query results use `fetchall()` without pagination or a row cap. Ask for bounded results when exploring large tables.
- Read-only execution does not establish SQL correctness or make arbitrary generated queries a complete security sandbox. Use a database role with only the permissions needed.
- API URLs and allowed origins are configured for local development; update them before deployment.
- Keep virtual environments and training checkpoints out of Git. Large adapter weights may need separate artifact storage.
