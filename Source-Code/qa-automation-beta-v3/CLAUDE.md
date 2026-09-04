# CLAUDE.md — Workflow Test Monorepo

Persistent instructions for Claude when working in this project. Read first, every chat.

## What this project is

**Workflow Test — Journey Test Console.** An enterprise tool for testing journey-orchestration flows end to end with synthetic profiles. Single dropdown picks the active journey; the canvas, inspector, and run panel all react to the selection.

This is a **monorepo** with a Next.js frontend (`apps/web`) and a FastAPI backend (`apps/api`). The product name is **"Orchestrate"** — it's a generic placeholder, not a real brand. Replace freely.

## Repository layout

```
.
├── apps/
│   ├── web/              # Next.js 14 (App Router, TypeScript, React 18)
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── App.tsx              # Top-level shell, loads journey + profiles
│   │   │   ├── SubHeader.tsx        # Journey dropdown + Save draft
│   │   │   ├── CanvasToolbar.tsx
│   │   │   ├── JourneyCanvas.tsx    # Pan/zoom canvas, nodes + edges
│   │   │   ├── Inspector.tsx        # Right panel — tabs
│   │   │   ├── RunPanel.tsx         # Bottom panel — Test mode only
│   │   │   ├── inspector/
│   │   │   │   ├── ProfilesTab.tsx
│   │   │   │   ├── CriteriaTab.tsx
│   │   │   │   └── InspectTab.tsx
│   │   │   └── run/
│   │   │       ├── EventComposer.tsx
│   │   │       ├── Results.tsx
│   │   │       ├── Metrics.tsx
│   │   │       └── Assertions.tsx
│   │   ├── lib/
│   │   │   ├── types.ts             # Shared domain types
│   │   │   ├── api.ts               # Fetch client (proxied via /api)
│   │   │   ├── nodeKinds.ts         # Node taxonomy + glyphs
│   │   │   └── preflight.ts         # Client-side static analysis
│   │   ├── next.config.mjs          # Proxies /api → FastAPI
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── api/              # FastAPI (Python ≥ 3.11)
│       ├── app/
│       │   ├── main.py              # FastAPI app + CORS + routers
│       │   ├── models.py            # Pydantic schemas
│       │   ├── data/
│       │   │   └── fixtures.py      # JOURNEY_SUMMARIES, JOURNEY graph, profiles
│       │   └── routers/
│       │       ├── journey.py       # /journeys, /journey
│       │       ├── profiles.py      # /profiles, /profiles/generate
│       │       └── runs.py          # /runs, /runs/{id}/stream (SSE)
│       ├── requirements.txt
│       ├── pyproject.toml
│       └── package.json             # so Turbo can drive `pnpm dev:api`
├── package.json                     # workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── .gitignore
├── README.md
└── CLAUDE.md                        # ← you are here
```

There is also a parallel "live preview" copy at the repo root (`Journey Test Console.html`, `app.jsx`, `canvas.jsx`, `inspector.jsx`, `run-panel.jsx`, `styles.css`, `data.js`, `tweaks-panel.jsx`) — a static SPA mirror of the Next.js app, useful for quick design iteration without the build step. **Keep both in sync** when you change UI or copy.

## Tech stack — pinned

### Frontend (`apps/web`)
- **Next.js** `14.2.5` — App Router, `reactStrictMode: true`, `experimental.typedRoutes: true`
- **React** `18.3.1` + **react-dom** `18.3.1`
- **TypeScript** `5.5.3` — `strict: true`, `moduleResolution: "bundler"`
- Path alias: `@/*` → `./*` (e.g. `import App from "@/components/App"`)
- No styling framework — plain CSS in `app/globals.css`. Keep class names under the `jo-*` namespace.
- Fonts: Geist + Geist Mono via Google Fonts in `app/layout.tsx`

### Backend (`apps/api`)
- **FastAPI** ≥ 0.115 with **uvicorn[standard]** ≥ 0.30
- **Pydantic** v2 (`>= 2.7`)
- **sse-starlette** for `/runs/{id}/stream`
- Python **≥ 3.11** (uses PEP 604 union syntax `str | None`)
- All routers under `app.routers`; mounted in `app.main:app`
- In-memory state only — no database. `PROFILES` is module-level mutable.

### Monorepo tooling
- **pnpm** ≥ 9 with workspaces (`pnpm-workspace.yaml`)
- **Turbo** `^2.0.0` — `turbo.json` defines `dev` / `build` / `lint` / `typecheck`
- Node ≥ 20

## Run the stack

```bash
# JS deps
pnpm install

# Python deps (one-time)
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..

# Two terminals:
pnpm dev:web    # http://localhost:3000
pnpm dev:api    # http://localhost:8000  (Swagger UI at /docs)

# Or both via Turbo:
pnpm dev
```

The web app calls the API through Next.js rewrites: every `/api/*` request from the browser is proxied to `${NEXT_PUBLIC_API_BASE_URL}` (default `http://localhost:8000`). Override via `apps/web/.env.local` (see `.env.local.example`).

## API contract (frontend ↔ backend)

| Method | Path                       | Purpose                                                 |
|--------|----------------------------|---------------------------------------------------------|
| GET    | `/journeys`                | List journey summaries (powers the dropdown)            |
| GET    | `/journey?id=...`          | Full journey (nodes, edges, holdouts, suppression…)     |
| GET    | `/profiles`                | Current profile cohort                                  |
| POST   | `/profiles/generate`       | Synthesize N more profiles (`bias: balanced/edge/compliant`) |
| POST   | `/runs`                    | Start a test run — returns `{runId, stats}`             |
| GET    | `/runs/{run_id}/stream`    | SSE stream — `event: step` lines, then `event: done`    |
| GET    | `/health`                  | `{status: "ok"}` for probes                             |

`POST /runs` enqueues; the stream consumes the queue once. Run state is in-memory. SSE events:
- `step` → `{ts, level, node, nodeId, label, msg, progress}`
- `done` → `{status: "passed"|"failed", duration}`

When the web app can't reach the API, `RunPanel` falls back to a client-side simulation so the canvas still walks. Keep that fallback working.

## Design constraints — DO NOT undo

These were explicit product decisions. If asked to "restore Adobe-style chrome" or similar, push back unless the user explicitly reverses the decision.

- **No top bar.** `GlobalHeader` was deleted. The journey is selected via the dropdown in `SubHeader`. Don't add a logo, breadcrumbs, env switcher, search bar, or avatar back at the top of the page.
- **No mode switcher.** Test mode is the only mode. Dry Run and Suite Run are removed. The `mode` prop is gone everywhere; don't reintroduce it.
- **No Validate or Publish.** Only `Save draft` lives in the sub-header actions.
- **No Test Suites tab.** Inspector tabs are: Profiles · Criteria · Inspector. Don't add Suites back.
- **No external branding.** The product is generically named "Orchestrate". Do not recreate Adobe Journey Optimizer (or any other vendor's) distinctive UI, branding, icons, or proprietary terminology. Stay original.

## Visual system

- Type: **Geist** (UI) + **Geist Mono** (numbers, IDs, code).
- Base type size 13px. Headings tracked tight (`letter-spacing: -0.012em`).
- Accent default: `#2c5cdf`. Exposed as `--accent` so it can be themed at runtime.
- Density: comfortable by default; `is-dense` class enables compact mode.
- Color tokens live at the top of `globals.css` under `:root`. Always use the tokens — do not hardcode hex values inside components.
- Status badges: `.jo-badge--draft` (warn), `.jo-badge--live` (ok), `.jo-badge--scheduled` (accent). Add new statuses as new badge classes, not inline styles.
- Buttons: `.jo-btn` base, with `.jo-btn--primary` and `.jo-btn--ghost` variants. Don't invent new button skins.

## Coding conventions

### TypeScript (web)
- Components are function components, default-exported, `.tsx`.
- Use `"use client"` only where required (stateful, effects, browser-only APIs).
- Props are declared as `interface Props { … }` immediately above the component.
- Shared types live in `lib/types.ts`. Don't duplicate them per-file.
- Network calls go through `lib/api.ts` — components import `api` and call methods. Don't `fetch` directly in components.
- Tailwind / utility CSS is NOT in use. All styles are in `globals.css` using the `jo-*` namespace.
- No `any`. Prefer narrowly typed unions and discriminated unions over loose objects.

### Python (api)
- `from __future__ import annotations` at the top of every module.
- Pydantic v2 models in `app/models.py`. Reuse models across routers.
- Routers are thin — business logic stays in the router file unless it grows past ~200 lines, then promote to `app/services/*.py`.
- Mutable state lives in `app/data/fixtures.py` module-level. Never persist to disk.
- Type-check with `mypy app` (strict). Lint with `ruff check .`.

## Common tasks — checklists

### Adding a node type
1. Add the string to `NodeType` union in `apps/web/lib/types.ts`.
2. Add the same literal to `NodeType` in `apps/api/app/models.py`.
3. Add a `NODE_KIND` entry in `apps/web/lib/nodeKinds.ts` with `label`, `glyph`, `tone`, `category`.
4. If the tone is new, add a `.jo-node__glyph--<tone>` rule in `globals.css`.
5. Mirror the same change in the live preview (`canvas.jsx`, `styles.css`).

### Adding a new journey to the dropdown
1. Append a `JourneySummary(...)` to `JOURNEY_SUMMARIES` in `apps/api/app/data/fixtures.py`.
2. If the new journey needs a different graph, branch in `get_journey_by_id` and define a second `_JOURNEY_GRAPH_*` dict.
3. Mirror in `data.js` `journeys` array for the live preview.

### Adding an API endpoint
1. Define request/response models in `apps/api/app/models.py`.
2. Add a route to the appropriate router under `apps/api/app/routers/`.
3. Add a typed wrapper to `apps/web/lib/api.ts` (`api.<verbResource>(…)`).
4. Components call `api.<verbResource>(…)` — never raw `fetch`.

## Testing

There are no tests yet. When asked to add tests:
- Web: `vitest` + `@testing-library/react`. Put tests next to the component as `*.test.tsx`.
- API: `pytest` + `httpx.AsyncClient`. Tests live under `apps/api/tests/`.

## What to do when context is ambiguous

1. The README at the repo root is the user-facing setup doc — keep it concise.
2. This file (`CLAUDE.md`) is the source of truth for *internal* conventions.
3. The live HTML preview at the repo root is the design playground — fast to iterate, no build. When a change is approved there, port it into `apps/web/components/*.tsx` immediately.
4. If a request would conflict with the "DO NOT undo" list above, ask before doing it.
