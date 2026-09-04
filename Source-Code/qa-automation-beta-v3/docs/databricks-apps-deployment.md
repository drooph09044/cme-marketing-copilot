# Deploying Orchestrate to Databricks Apps

This guide deploys the Journey Test Console (FastAPI backend + Next.js
frontend) as a single **Databricks App**. Databricks Apps runs a long-lived
HTTPS service inside your workspace, with built-in workspace authentication,
secrets, and direct access to Foundation Model APIs / Model Serving endpoints
— so the QA pipeline can call its LLMs without any cross-network token
plumbing.

## What you'll end up with

- A single Databricks App at `https://<app-slug>.<workspace>.databricksapps.com`
- FastAPI serving the API on the app's primary port
- Next.js built to static assets and served by the same FastAPI process
  (`StaticFiles` mount)
- `MODEL_PROVIDER=databricks` reading workspace-served endpoints
- Secrets (`DATABRICKS_TOKEN` etc.) injected via Databricks Secrets, never in
  the repo

---

## 1. Prerequisites

- Databricks workspace on AWS or Azure with **Databricks Apps** enabled
  (Premium tier; check *Settings → Workspace settings → Compute*)
- Databricks CLI ≥ `0.225.0` installed and authenticated:
  ```bash
  brew install databricks
  databricks auth login --host https://<workspace>.cloud.databricks.com
  ```
- Foundation Model APIs or your own provisioned serving endpoints available
  (see [README §3 of the Databricks setup guide](#))
- Local `pnpm install` + `pip install -r requirements.txt` succeed (you've
  already run a dev round)

---

## 2. Repo layout for Databricks Apps

Databricks Apps expects a single deployable bundle with an `app.yaml`
manifest at the root of the bundle. We'll create a thin deployment folder
that bundles the API + the Next.js build output:

```
deploy/
  app.yaml              # Databricks App manifest (created in §3)
  requirements.txt      # copy of apps/api/requirements.txt
  app/                  # copy of apps/api/app (the FastAPI package)
  static/               # the Next.js export output (created in §4)
```

You don't have to keep this folder in git — the deploy script regenerates it.
But it's the artifact uploaded to your workspace.

---

## 3. Create `app.yaml`

At the repo root, create `deploy/app.yaml`:

```yaml
# deploy/app.yaml
name: orchestrate-qa
description: Journey QA Test Console
command:
  - "uvicorn"
  - "app.main:app"
  - "--host"
  - "0.0.0.0"
  - "--port"
  - "$DATABRICKS_APP_PORT"

env:
  # Provider — read by app.llm.router.current_provider()
  - name: MODEL_PROVIDER
    value: "databricks"

  # Databricks runtime injects these automatically for app processes —
  # documented at https://docs.databricks.com/en/dev-tools/databricks-apps
  - name: DATABRICKS_HOST
    valueFrom: "databricks-host"      # built-in
  - name: DATABRICKS_TOKEN
    valueFrom: "databricks-app-token"  # built-in PAT for the app's service principal

  # Optional override: read OPENAI / ANTHROPIC keys from Databricks Secrets
  # if you want to mix providers (see §6).
  # - name: OPENAI_API_KEY
  #   valueFrom: { secretScope: "qa-secrets", secretKey: "openai-api-key" }
```

Key details:
- `$DATABRICKS_APP_PORT` is set by the platform — you bind to it, you don't
  pick it
- `databricks-app-token` is a **scoped PAT** auto-generated for the app's
  service principal, with workspace-level permissions you configure in the
  app's IAM page — no manual token management
- `databricks-host` is your workspace URL injected for free

---

## 4. Build the Next.js frontend as static assets + mount in FastAPI

Databricks Apps runs a single process per app. We let FastAPI serve both the
API (`/api/...`) and the Next.js build output (`/`). Two small changes:

### 4a. Switch Next.js to static export

In `apps/web/next.config.mjs`:

```js
const nextConfig = {
  reactStrictMode: true,
  output: "export",         // ← generates `apps/web/out/` with static HTML/JS
  trailingSlash: true,
  experimental: { typedRoutes: true },
  // Rewrites only apply in dev — production calls /api/* directly on the
  // same origin where FastAPI is serving.
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${apiBase}/:path*` }];
  },
};

export default nextConfig;
```

Then:

```bash
pnpm --filter web build
# Produces apps/web/out/ ready to copy into deploy/static/
```

### 4b. Mount static files in FastAPI

In `apps/api/app/main.py`, after the routers are mounted, add:

```python
import os
from fastapi.staticfiles import StaticFiles

STATIC_DIR = os.environ.get("STATIC_DIR", "/app/static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
```

This serves the Next.js build at `/` while keeping every API route (`/journeys`,
`/profiles/synth`, `/runs/qa`, etc.) mounted ahead of it. The `html=True` flag
makes the mount fall back to `index.html` for client-side routes so deep links
work.

Locally this branch is a no-op (the directory doesn't exist).

### 4c. Frontend → API on same origin

In `apps/web/lib/api.ts` the existing `fetch("/api/<path>")` already works —
in dev it's proxied via `next.config.mjs` rewrites; in production it goes
straight to the same FastAPI host. No code change needed.

---

## 5. The deploy script

Create `scripts/deploy-databricks.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
DEPLOY="$ROOT/deploy"

echo "→ Cleaning deploy/"
rm -rf "$DEPLOY"
mkdir -p "$DEPLOY/app" "$DEPLOY/static"

echo "→ Building frontend (static export)"
pnpm --filter @workflow-test/web build

echo "→ Copying FastAPI package"
cp -R "$ROOT/apps/api/app/." "$DEPLOY/app/"
cp "$ROOT/apps/api/requirements.txt" "$DEPLOY/requirements.txt"

echo "→ Copying Next.js static export"
cp -R "$ROOT/apps/web/out/." "$DEPLOY/static/"

echo "→ Copying examples (segments + journeys) — read by app.data.loaders"
mkdir -p "$DEPLOY/examples"
cp -R "$ROOT/examples/." "$DEPLOY/examples/"

# Adjust the loader path inside the bundle.
# (loaders.py uses parents[4]/examples; in the bundle examples sits alongside app/,
#  so we override via env var STATIC_DIR-style. See §6.)

echo "→ Copying app.yaml"
cp "$ROOT/deploy/app.yaml.tmpl" "$DEPLOY/app.yaml" 2>/dev/null || true

echo "→ Deploying via Databricks CLI"
databricks apps deploy orchestrate-qa --source-code-path "$DEPLOY"

echo "✓ Deployed. Open: https://orchestrate-qa.<workspace>.databricksapps.com"
```

Make it executable:

```bash
chmod +x scripts/deploy-databricks.sh
```

---

## 6. One-time setup steps

### 6a. Create the App in your workspace

```bash
databricks apps create orchestrate-qa \
  --description "Journey QA Test Console"
```

You'll see a service-principal id and a default URL.

### 6b. Grant the App permission to call serving endpoints

In the Databricks UI: **Serving → Endpoints → [your endpoint] → Permissions**
→ add the service principal (`<app-name>-<id>@apps.databricks.com`) with
**Can Query**.

Do this for every endpoint referenced in `apps/api/app/llm/config.py`
(`databricks-dbrx-instruct`, `databricks-meta-llama-3-1-70b-instruct`,
`databricks-meta-llama-3-1-8b-instruct`). Or, if you swapped the config to
use one endpoint everywhere, just that one.

### 6c. (Optional) Create a secret scope for mixed-provider use

If you want OpenAI / Anthropic fallback alongside Databricks:

```bash
databricks secrets create-scope qa-secrets
databricks secrets put-secret qa-secrets openai-api-key
databricks secrets put-secret qa-secrets anthropic-api-key
```

Then uncomment the `valueFrom: { secretScope, secretKey }` lines in `app.yaml`.

### 6d. Adjust loader paths in the bundle

The current `apps/api/app/data/loaders.py` walks `parents[4]/examples` (it's
oriented around the monorepo layout). In the Databricks Apps bundle, examples
sit next to `app/` instead. Make the loader robust to both layouts — replace
the constant at the top of `loaders.py`:

```python
# Original:
# _EXAMPLES = Path(__file__).resolve().parents[4] / "examples"

# Robust to both monorepo layout and the flattened deploy bundle:
def _resolve_examples_dir() -> Path:
    here = Path(__file__).resolve()
    # 1. Env override (preferred for prod)
    env = os.environ.get("EXAMPLES_DIR")
    if env and Path(env).is_dir():
        return Path(env)
    # 2. Monorepo layout: <root>/apps/api/app/data/loaders.py
    monorepo = here.parents[4] / "examples"
    if monorepo.is_dir():
        return monorepo
    # 3. Flattened deploy layout: deploy/app/data/loaders.py with deploy/examples/
    flat = here.parents[2] / "examples"
    if flat.is_dir():
        return flat
    raise FileNotFoundError(
        "Could not locate examples/ directory. Set EXAMPLES_DIR env var."
    )

_EXAMPLES = _resolve_examples_dir()
```

Then add to `app.yaml` env:

```yaml
- name: EXAMPLES_DIR
  value: "/app/examples"
```

---

## 7. Deploy

```bash
./scripts/deploy-databricks.sh
```

First deploy takes 3-5 minutes (Databricks builds the image, installs
requirements.txt, and provisions the container). Subsequent deploys are
~30 seconds (only the diff is uploaded).

Tail logs:

```bash
databricks apps logs orchestrate-qa --follow
```

You should see uvicorn boot, the SSE registry initialise, and the FastAPI
banner. Open the app URL printed by the deploy script.

---

## 8. Verify

In the deployed app:

1. **Health**: hit `https://<app-url>/health` → `{"status":"ok"}`
2. **Journeys**: hit `https://<app-url>/journeys` → 6 enterprise journeys
3. **UI**: visit the root URL, pick a segment, click **Generate Test Suites**
4. **Verdict hero** in the QA Runs tab should read `databricks · <duration>` —
   confirming the run used Databricks Foundation Model APIs end-to-end

---

## 9. Operations

### Updating the app

```bash
./scripts/deploy-databricks.sh
```

The container is rebuilt only if `requirements.txt` changed; otherwise just
the code is swapped. Active QA runs in flight at the moment of redeploy are
lost (it's all in-memory state) — schedule deploys around quiet periods.

### Rolling back

```bash
databricks apps deployments list orchestrate-qa
databricks apps rollback orchestrate-qa --deployment-id <previous-id>
```

### Scaling

App-level autoscaling lives in the **App Settings → Compute** page. The QA
pipeline is mostly I/O-bound on LLM calls — the default Small instance
handles ~5 concurrent runs comfortably. Bump to Medium if you see queue
backlog under `databricks apps metrics`.

### Cost control

Databricks Apps bills compute by the minute while the app is running. The
in-memory run + synth registries (`RunRegistry`, `SynthRegistry`) hold
nothing across restarts, so it's safe to scale the app to zero overnight via
**App Settings → Schedule**.

Foundation Model APIs bill per-token — watch the
*serving-endpoints* page for cost-by-endpoint and consider switching
high-volume nodes (`walk_profile`) to the cheaper Llama 3.1 8B endpoint in
`apps/api/app/llm/config.py`.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` after deploy | uvicorn didn't bind to `$DATABRICKS_APP_PORT` | Make sure `app.yaml`'s `command` includes `--port $DATABRICKS_APP_PORT` |
| `403 Forbidden` on `/serving-endpoints/...` | App's service principal lacks Can Query on the endpoint | Grant permission per §6b |
| `404` on every Next.js route except `/` | StaticFiles mount missing `html=True` | Re-check the `app.mount("/", StaticFiles(..., html=True))` line |
| `EXAMPLES_DIR not found` at startup | Bundled examples not present | Check the deploy script copied `examples/` into the bundle and `EXAMPLES_DIR` env is set |
| Frontend fetches `/api/...` return HTML | Static mount intercepts API paths | Router order matters — mount `StaticFiles` AFTER all `include_router(...)` calls in `app.main:app` |
| App boots but every QA run errors immediately | `MODEL_PROVIDER` mismatch with installed packages | Verify `langchain-databricks` is in `requirements.txt`; rerun deploy so the new requirement is installed |

---

## 11. Reference

- [Databricks Apps docs](https://docs.databricks.com/en/dev-tools/databricks-apps/index.html)
- [Foundation Model APIs](https://docs.databricks.com/en/machine-learning/model-serving/foundation-model-apis.html)
- [Databricks CLI reference](https://docs.databricks.com/en/dev-tools/cli/index.html)
- [Secrets management](https://docs.databricks.com/en/security/secrets/index.html)
