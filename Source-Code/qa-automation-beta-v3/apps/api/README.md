# Journey Test Console — API

FastAPI backend for the Journey Test Console.

## Run

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: <http://localhost:8000/docs>

## Endpoints

| Method | Path                       | Description                                 |
|--------|----------------------------|---------------------------------------------|
| GET    | `/journey`                 | Active journey fixture                       |
| GET    | `/profiles`                | Current profile cohort                       |
| POST   | `/profiles/generate`       | Synthesize N more profiles with a bias      |
| POST   | `/runs`                    | Start a test run; returns `runId` + stats   |
| GET    | `/runs/{run_id}/stream`    | SSE stream of step events for a run         |

Data is in-memory (`app/data/fixtures.py`) — restarting clears state.
