# Journey QA Automation Console

An enterprise tool that **QA-tests marketing journeys end to end with an LLM**.
Pick a journey + audience segment, and the console:

1. **Generates a realistic profile cohort** — synthetic people, each an *archetype*
   of how a real audience member moves through the journey (holdout, early/late
   converter, never-converts, ineligible, consent-suppressed, channel-limited,
   frequency-capped, A/B variant…).
2. **Builds journey-level test suites** — QA concerns relevant to *that* journey
   (Audience Qualification, Suppression & Exclusion, Experiment Traffic Split,
   Personalization Rendering, Channel Discovery, Wait Node Timing, Exit Condition
   Logic). Irrelevant suites are skipped.
3. **Runs every profile against every suite** — simulating each profile walking
   the journey (with wait-time simulation) and emitting a per-suite verdict.
4. **Reports** pass/warn/fail grouped by suite, with full per-profile walk traces,
   versioned across runs.

It is **multi-provider**: Anthropic, OpenAI, **Azure OpenAI**, or Databricks.

```
.
├── apps/
│   ├── web/   # Next.js 14 (App Router, TypeScript) frontend
│   └── api/   # FastAPI (Python 3.11+) backend — LangGraph QA pipeline
├── examples/  # individual journey JSON files + segments/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Prerequisites

- **Node.js** ≥ 20 with **pnpm** ≥ 9 (`npm i -g pnpm`)
- **Python** ≥ 3.11
- An LLM provider key (Anthropic, OpenAI, **Azure OpenAI**, or Databricks)

## First-time setup

```bash
# 1. Install JS deps (root + apps/web)
pnpm install

# 2. Python deps (apps/api) — install CORE + the ONE provider you use.
cd apps/api
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt                 # core (always)
# then exactly one provider package:
pip install -r requirements-anthropic.txt        # MODEL_PROVIDER=anthropic
pip install -r requirements-openai.txt           # MODEL_PROVIDER=openai OR azure_openai
pip install -r requirements-databricks.txt       # MODEL_PROVIDER=databricks

# 3. Configure the provider
cp .env.example .env        # then edit .env (see below)
cd ../..
```

> Provider packages are split out so pip's resolver stays fast on Windows
> (`databricks-sdk` otherwise explodes the dependency tree). Install only the one
> you need.

## Provider configuration (`apps/api/.env`)

Pick a provider with `MODEL_PROVIDER` and fill in that provider's keys.

### Azure OpenAI

```ini
MODEL_PROVIDER=azure_openai
AZURE_OPENAI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
AZURE_API_KEY=<your-azure-key>
AZURE_OPENAI_API_VERSION=2024-12-01-preview
# The DEPLOYMENT name (what you named the model in Azure), NOT the model name:
AZURE_OPENAI_DEPLOYMENT_NAME=<your-deployment>
# Reasoning deployments (o1/o3/gpt-reasoning) are slow — keep the timeout generous:
# AZURE_OPENAI_TIMEOUT=180
```

Per-node deployment overrides are supported (first match wins):
`AZURE_OPENAI_DEPLOYMENT_<NODE>` → `AZURE_OPENAI_DEPLOYMENT_NAME` → config default.
Nodes: `FIT_CHECK`, `STRUCTURE_CHECK`, `PROFILE_SYNTH`, `WALK_PROFILE`, `VERDICT_SUMMARY`.

> **Reasoning models** are slow and a QA run makes many calls (cohort × suites).
> Keep `QA_MAX_WALKS` modest (e.g. `30`) and `QA_CONCURRENCY` low (`2`) to avoid
> the sporadic 5xx Azure returns under load. Transient 429/5xx are retried with
> backoff automatically.

### Anthropic / OpenAI / Databricks

```ini
MODEL_PROVIDER=anthropic        # ANTHROPIC_API_KEY=...
MODEL_PROVIDER=openai           # OPENAI_API_KEY=...
MODEL_PROVIDER=databricks       # DATABRICKS_HOST=... DATABRICKS_TOKEN=...
```

See `apps/api/.env.example` for every variable, including the QA-run tuning knobs
(`QA_CONCURRENCY`, `QA_MAX_WALKS`, `QA_WAIT_SIM_SECONDS`, `QA_MAX_PROMPT_CHARS`).

## Running

Two processes — one terminal each:

```bash
# Terminal 1 — Next.js (http://localhost:3000)
pnpm dev:web

# Terminal 2 — FastAPI (http://localhost:8000, Swagger at /docs)
pnpm dev:api
```

Or both with Turbo:

```bash
pnpm dev
```

The web app reads the API base URL from `apps/web/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## How a QA run works

1. **Pick** a journey + segment in the header.
2. **Generate & Run QA** — synthesizes the cohort + concern suites, then runs.
3. Watch the live progress (SSE stream with wait-time simulation); if the stream
   drops, the UI falls back to polling.
4. **Results** appear in the QA Runs tab: each suite lists every profile's verdict
   for that concern; click a profile to expand its full walk trace inline. Runs are
   versioned — switch between past runs.

**Walk model:** every profile is walked against every suite (re-walk per suite), so
a 24-profile cohort × 6 suites = 144 walks. Holdout is always present in the cohort.

## Backend pipeline (LangGraph DAG)

```
load_inputs → fit_check → structure_check → profile_synth
   → walk_fanout (Send → walk_profile × [cohort × suites]) → aggregate_walks → verdict_summary
```

- `apps/api/app/qa/nodes/` — the pipeline nodes
- `apps/api/app/qa/prompts.py` — per-node prompts
- `apps/api/app/llm/` — provider-agnostic router + per-node model config
- `apps/api/app/data/loaders.py` — loads journeys (`examples/*.json`) + segments

## Testing

```bash
# Backend
cd apps/api && python3 -m pytest tests/ -q

# Frontend type-check
cd apps/web && npx tsc --noEmit
```

## Notes

- Journeys live as **individual files** in `examples/` (brief/template files
  without `journey.nodes` are skipped); segments in `examples/segments/`.
- The product naming ("Orchestrate") is a placeholder — replace with your brand.
- Run state is in-memory (process-local). For horizontal scale, swap the registry
  for Redis behind the same interface.
