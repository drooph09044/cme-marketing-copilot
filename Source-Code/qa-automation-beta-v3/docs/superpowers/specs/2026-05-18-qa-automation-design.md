# QA Automation for Journey × Segment — Design

**Status:** Approved for planning
**Date:** 2026-05-18
**Authors:** rahukkanodia2050@gmail.com (with Claude)
**Spec location:** `docs/superpowers/specs/2026-05-18-qa-automation-design.md`

---

## 1. Problem

The Journey Test Console (`apps/web` + `apps/api`) today only simulates a fixed walk through a hand-coded journey. A real QA workflow needs to take a `(journey, segment)` pair selected by a human and **automatically verify**:

1. The segment is a sensible audience for the journey (fit).
2. The journey graph is structurally sound (no unreachable nodes, missing exits, fcap/consent/quiet-hours gaps).
3. Realistic profiles matching the segment actually flow through the journey correctly (simulated walk).

The system must use **LangGraph** for orchestration and expose a **model-routing layer** that lets the team swap the underlying LLM between **Anthropic** (default) and **Databricks Model Serving** without changing graph or node code.

## 2. Inputs the system already has

- `examples/journey.json` — 18 real AJO-style journeys (rich schema: `entryCriteria`, `touchpoints`, `journey.nodes`, `exitConditions`, `ajoConfig`, `tracking`, `analytics`).
- `examples/segments/*.json` — 4 segment definitions (rule-based: `LTV Tier`, `Engagement Tier`, `Recency`, `Content Affinity`).
- Existing FastAPI + Next.js scaffold with SSE-based run streaming.

These become the live data; the previous hand-coded `JOURNEY` fixture is removed.

## 3. Scope

### In scope
- `(segment, journey)` selection drives an end-to-end QA run.
- Three checks: **fit_check**, **structure_check**, **simulated profile walk**.
- LangGraph DAG with parallel per-profile walks via `Send`.
- Model router (env-var driven) with Anthropic + Databricks adapters.
- New endpoints integrated into existing `/runs` SSE contract.
- Minimal UI changes: segment dropdown + "Run QA" button + report rendering.

### Out of scope (deferred to v2)
- **Personalization / message QA** for each touchpoint (tone, CTA, token validity).
- Persistent storage of runs (in-memory with ~1-hour TTL for now).
- Auth / multi-tenancy.
- Cost / token budgeting per run.
- Real-time validation of Databricks Model Serving endpoint URL at startup (fail-fast at first invocation instead).

### Explicit DO-NOT (from `CLAUDE.md`)
- Do **not** reintroduce a top bar, mode switcher, Validate/Publish, or Test Suites tab.
- Do **not** add external branding.
- Stay within `jo-*` CSS namespace; use design tokens from `globals.css`.

## 4. High-level architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Next.js console  (existing UI, adds segment dropdown + "Run QA" button)   │
└──────────────────────────────┬─────────────────────────────────────────────┘
                               │ POST /runs/qa {journeyId, segmentId}
                               │ EventSource /runs/{id}/stream
                               │ GET /runs/{id}/report
┌──────────────────────────────▼─────────────────────────────────────────────┐
│  FastAPI  (apps/api)                                                       │
│   ├─ routers/runs.py       extended: /runs/qa, /runs/{id}/report           │
│   ├─ routers/segments.py   new: /segments, /segments/{id}                  │
│   ├─ routers/journey.py    rewritten: reads examples/journey.json          │
│   ├─ qa/graph.py           LangGraph DAG assembly                          │
│   ├─ qa/nodes/*.py         one file per node                               │
│   ├─ qa/state.py           QAState TypedDict                               │
│   ├─ qa/schemas.py         FitFinding, Finding, WalkTrace, QAReport        │
│   ├─ qa/static_checks.py   pure-Python structural rules (no LLM)           │
│   ├─ qa/prompts.py         one prompt constant per LLM node                │
│   ├─ qa/store.py           in-memory run registry + per-run asyncio.Queue  │
│   ├─ llm/router.py         get_chat_model(node) factory                    │
│   ├─ llm/providers.py      anthropic + databricks adapters                 │
│   ├─ llm/config.py         NODE_MODEL_CONFIG                               │
│   └─ data/loaders.py       load examples/journey.json + segments/*.json    │
└────────────────────────────────────────────────────────────────────────────┘
```

**Cross-cutting principles:**
- LangGraph runs server-side. Each node emits an SSE step event into an `asyncio.Queue` keyed by `run_id`; the existing `GET /runs/{run_id}/stream` consumes that queue.
- **No node imports `anthropic` or `databricks` directly.** All LLM calls go through `llm/router.py`. Switching providers is `export MODEL_PROVIDER=databricks` + restart.
- The 18 journeys + 4 segments load at startup. No DB.
- SSE wire format is **unchanged** from today (`step` events with the same field shape); only `nodeId`s are new.

## 5. LangGraph DAG

### State schema (`qa/state.py`)
```python
class QAState(TypedDict):
    run_id: str
    journey: dict            # raw journey from examples/journey.json
    segment: dict            # raw segment from examples/segments/*.json
    fit: FitFinding | None
    structure: list[Finding]
    profiles: list[Profile]
    walks: list[WalkTrace]
    verdict: Verdict | None
```

### Nodes
| # | Node | LLM? | Purpose |
|---|------|------|---------|
| 1 | `load_inputs` | no | Look up segment + journey by id. Validate. |
| 2 | `fit_check` | yes | Reason about segment-vs-journey fit. → `FitFinding{verdict, score, reasons[]}`. |
| 3 | `structure_check` | yes | Pure-Python structural rules first (unreachable nodes, missing exit, missing consent, quiet-hours gap, no fcap before push). LLM then writes plain-English explanations + severity. |
| 4 | `profile_synth` | yes | Generate 5 realistic profiles satisfying the segment rules + 2 adversarial edge cases (no consent, fcap=3, boundary value). |
| 5 | `walk_fanout` | no | LangGraph `Send` fan-out, one `walk_profile` per profile, run in parallel. |
| 6 | `walk_profile` | yes | Per profile: traverse journey nodes deterministically; at `condition`/`split`/branching nodes, LLM evaluates which branch this profile takes. Records per-node `pass/warn/fail` with reasoning. |
| 7 | `aggregate_walks` | no | Collect WalkTrace results back into state. |
| 8 | `verdict_summary` | yes | Given fit + structure + walks, write 3-paragraph executive summary + overall `pass`/`warn`/`fail`. |

### Wiring
```
load_inputs → fit_check ─┐
              ↓          │
         structure_check ┤
              ↓          │
         profile_synth   │
              ↓          │
    walk_fanout (Send fan-out)
              ↓
      [walk_profile × N runs in parallel]
              ↓
       aggregate_walks
              ↓
      verdict_summary → END
```

### Failure handling
- `load_inputs` fail (bad ids) → emit `done {status: failed}`, skip rest.
- Any other node never throws. Errors are recorded as findings; the final verdict reflects them.
- LLM call failure inside a node: caught, recorded as a `severity: err` finding, node returns; pipeline continues.

## 6. Model router

### File layout
```
apps/api/app/llm/
├── __init__.py
├── router.py        # get_chat_model(node_name)
├── providers.py     # anthropic + databricks factories
└── config.py        # NODE_MODEL_CONFIG
```

### Public API
```python
# llm/router.py
def get_chat_model(node: str) -> BaseChatModel: ...
```

Returns a LangChain `BaseChatModel`. Callers use `.invoke()`, `.with_structured_output(PydanticModel)`, `.stream()` — same interface either provider.

### Provider selection
- `MODEL_PROVIDER=anthropic` (default) → `ChatAnthropic` (`langchain-anthropic`), auth via `ANTHROPIC_API_KEY`.
- `MODEL_PROVIDER=databricks` → `ChatDatabricks` (`langchain-databricks`), auth via `DATABRICKS_HOST` + `DATABRICKS_TOKEN`.

### Per-node config (`llm/config.py`)
```python
NODE_MODEL_CONFIG = {
    "fit_check":       {"anthropic": "claude-opus-4-7",          "databricks": "databricks-dbrx-instruct",          "temperature": 0.2, "max_tokens": 1500},
    "structure_check": {"anthropic": "claude-sonnet-4-6",        "databricks": "databricks-meta-llama-3-1-70b",     "temperature": 0.1, "max_tokens": 1200},
    "profile_synth":   {"anthropic": "claude-sonnet-4-6",        "databricks": "databricks-meta-llama-3-1-70b",     "temperature": 0.7, "max_tokens": 2000},
    "walk_profile":    {"anthropic": "claude-haiku-4-5-20251001","databricks": "databricks-meta-llama-3-1-8b",      "temperature": 0.1, "max_tokens": 800},
    "verdict_summary": {"anthropic": "claude-opus-4-7",          "databricks": "databricks-dbrx-instruct",          "temperature": 0.3, "max_tokens": 2000},
}
```

Cheap/fast model for hot `walk_profile`; strong model for `fit_check` and `verdict_summary`.

### Calling pattern inside a node
```python
def fit_check(state: QAState) -> dict:
    llm = get_chat_model("fit_check").with_structured_output(FitFinding)
    finding = llm.invoke(FIT_PROMPT.format(segment=state["segment"], journey=state["journey"]))
    emit_step(state["run_id"], "fit_check", "info", finding.summary, progress=20)
    return {"fit": finding}
```

### Adding a third provider later
One new factory in `providers.py`, one new key per `NODE_MODEL_CONFIG` entry. No graph changes.

## 7. API contract

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/segments` | List all segments from `examples/segments/*.json`. |
| GET    | `/segments/{id}` | Single segment detail. |
| GET    | `/journeys` | **Replaced.** Loads from `examples/journey.json` (18 real journeys). |
| GET    | `/journey?id=...` | **Replaced.** Returns the rich journey shape from `examples/journey.json`. |
| POST   | `/runs/qa` | Start a QA run. Body: `{journeyId, segmentId, profileCount?: int = 5}`. Returns `{runId, status: "queued"}`. |
| GET    | `/runs/{run_id}/stream` | **Existing endpoint, reused.** SSE stream. |
| GET    | `/runs/{run_id}/report` | Final structured report. Persisted in-memory ~1 hour. |
| GET    | `/health` | unchanged |

### SSE wire format (unchanged shape, new nodeIds)
```
event: step
data: {"ts":"14:02:11","level":"info","node":"fit_check","nodeId":"fit_check",
       "label":"Segment fit check","msg":"Segment matches journey entry criteria.","progress":20}

event: step
data: {"ts":"14:02:25","level":"info","node":"walk_profile:p3","nodeId":"walk_profile",
       "label":"Profile walk — Priya (high-LTV, low-engagement)",
       "msg":"Exited at TP4 (consent revoked).","progress":75}

event: done
data: {"status":"failed","duration":18420,"reportUrl":"/runs/abc123/report"}
```

- `nodeId` is canonical (`fit_check`, `structure_check`, `profile_synth`, `walk_profile`, `verdict_summary`) for frontend colour-coding.
- `node` carries a per-instance suffix for fan-out walks (`walk_profile:p3`).

### Final report shape (`GET /runs/{id}/report`)
```jsonc
{
  "runId": "abc123",
  "journeyId": "season-ticket-renewal-journey",
  "segmentId": "seg_high_ltv_customers_who",
  "modelProvider": "anthropic",
  "verdict": "warn",
  "summary": "Segment fits the journey, but two touchpoints lack consent gates...",
  "fit": {
    "verdict": "pass",
    "score": 0.86,
    "reasons": ["High-LTV aligns with renewal upsell", "Recency=High matches re-engagement timing"]
  },
  "structure": [
    {"nodeId": "TP3", "severity": "warn", "message": "No fcap guard before push send"},
    {"nodeId": "n7",  "severity": "info", "message": "Exit reachable from all branches"}
  ],
  "walks": [
    {
      "profile": {"id": "p1", "name": "Priya", "age": 41, "...": "..."},
      "steps": [
        {"nodeId":"n1","verdict":"pass","reason":"Entry criteria satisfied"},
        {"nodeId":"n2","verdict":"pass","reason":"Email sent — consent=true"},
        {"nodeId":"n3","verdict":"fail","reason":"Quiet hours violated (22:00 local)"}
      ],
      "endedAt": "n3",
      "verdict": "fail"
    }
  ],
  "createdAt": "2026-05-18T14:02:08Z",
  "durationMs": 18420
}
```

Backend Pydantic models live in `apps/api/app/qa/schemas.py`; matching TypeScript types in `apps/web/lib/types.ts`.

## 8. Frontend changes

1. **`SubHeader.tsx`** — second dropdown (Segment), populated from `GET /segments`. "Save draft" stays. **Run QA** button replaces the implicit Test trigger.
2. **`RunPanel.tsx`** — extend message renderer for new `nodeId`s. Keep the offline client-side fallback simulation.
3. **`Inspector.tsx` → Inspector tab** — after run completes, fetch `/runs/{id}/report`; render verdict badge, fit reasons, structure findings list, per-profile walk traces (collapsible).
4. **`lib/api.ts`** — add `listSegments()`, `startQARun()`, `getReport()`. No raw `fetch` in components.
5. **`lib/types.ts`** — add `Segment`, `FitFinding`, `Finding`, `WalkTrace`, `QAReport`.

No new Inspector tab, no top-bar elements, no Validate/Publish/Suites — every CLAUDE.md "DO NOT undo" rule respected.

## 9. Project layout (post-implementation)

```
apps/api/app/
├── main.py                         # registers /segments router
├── models.py                       # unchanged
├── data/
│   ├── fixtures.py                 # gutted — old hand-coded JOURNEY removed
│   └── loaders.py          [NEW]
├── routers/
│   ├── journey.py                  # rewritten — reads from loaders
│   ├── profiles.py                 # unchanged
│   ├── segments.py         [NEW]
│   └── runs.py                     # + POST /runs/qa, + GET /runs/{id}/report
├── qa/                     [NEW]
│   ├── __init__.py
│   ├── graph.py
│   ├── state.py
│   ├── schemas.py
│   ├── store.py
│   ├── prompts.py
│   ├── static_checks.py
│   └── nodes/
│       ├── load_inputs.py
│       ├── fit_check.py
│       ├── structure_check.py
│       ├── profile_synth.py
│       ├── walk_profile.py
│       ├── aggregate_walks.py
│       └── verdict_summary.py
└── llm/                    [NEW]
    ├── __init__.py
    ├── router.py
    ├── providers.py
    └── config.py

apps/web/
├── components/
│   ├── SubHeader.tsx               # + segment dropdown, + Run QA button
│   ├── RunPanel.tsx                # + new nodeId labels, + report fetch
│   └── inspector/
│       └── InspectTab.tsx          # + QA report rendering
└── lib/
    ├── api.ts                      # + listSegments, startQARun, getReport
    └── types.ts                    # + Segment, QAReport, ...

apps/api/requirements.txt           # + langgraph, langchain-anthropic, langchain-databricks, python-dotenv

apps/api/.env.example       [NEW]   # MODEL_PROVIDER, ANTHROPIC_API_KEY, DATABRICKS_HOST, DATABRICKS_TOKEN
```

## 10. Dependencies to add

`apps/api/requirements.txt`:
- `langgraph>=0.2`
- `langchain-core>=0.3`
- `langchain-anthropic>=0.2`
- `langchain-databricks>=0.1`
- `python-dotenv>=1.0`

No new frontend deps.

## 11. Configuration

`apps/api/.env.example`:
```bash
# Pick one: anthropic (default) | databricks
MODEL_PROVIDER=anthropic

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Databricks Model Serving (OpenAI-compatible)
DATABRICKS_HOST=https://<workspace>.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
```

`MODEL_PROVIDER` is read once at process start. Restart to switch providers.

## 12. Testing strategy

`apps/api/tests/` (pytest + httpx.AsyncClient):
- `test_loaders.py` — examples files parse correctly into Pydantic models.
- `test_static_checks.py` — structural rules fire on known-bad journey fixtures.
- `test_llm_router.py` — env var flips provider; per-node config overrides win; mock the chat models.
- `test_qa_graph.py` — end-to-end with a **stub LLM** (returns canned structured outputs); asserts SSE step sequence + final report shape.

`apps/web/` (vitest + RTL):
- One test for the segment dropdown wire-up + "Run QA" button calling the right API method.

No real LLM calls in CI.

## 13. Open questions / risks

- **Databricks model identifier accuracy.** The placeholders in `NODE_MODEL_CONFIG` (`databricks-dbrx-instruct`, `databricks-meta-llama-3-1-70b`, `databricks-meta-llama-3-1-8b`) must match the exact serving endpoint names in the user's Databricks workspace. Confirm before first run; otherwise `MODEL_PROVIDER=databricks` will fail fast with a clear error.
- **Token cost of profile-walk fan-out.** 5 profiles × ~10 nodes × small Haiku/Llama-8B calls is bounded but not zero. Default `profileCount=5`. Allow override per run via the POST body.
- **In-memory run registry.** Restarts lose runs. Acceptable for the dev console; revisit when promoting to staging.
- **LangGraph `Send` API parallelism vs. async LLM clients.** Both Anthropic and Databricks LangChain integrations support async invoke. Walks will use `ainvoke()` so the fan-out is truly concurrent, not serialized.

## 14. Acceptance criteria

The feature is done when:
1. With `MODEL_PROVIDER=anthropic`, running `(seg_high_ltv_customers_who, season-ticket-renewal-journey)` from the UI streams 6+ step events and produces a non-empty `QAReport` with all three sections populated.
2. Setting `MODEL_PROVIDER=databricks` + valid Databricks env vars produces an equivalent report with no code changes.
3. A known-bad journey fixture (unreachable exit) yields `verdict=fail` and the `structure` array contains a matching finding.
4. All three "DO NOT undo" constraints from `CLAUDE.md` are still honoured in the UI.
5. `pytest apps/api` and `pnpm --filter web test` pass with no real LLM calls.
