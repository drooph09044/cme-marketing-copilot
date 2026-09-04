# MarketingEngine Databricks Migration Gap Analysis

Date: 2026-07-24

Reference implementation:
`C:\Users\ambika257346\Downloads\Databricks Integration\cme-marketing-copilot\cme-marketing-copilot`

Business-function source:
`C:\Users\ambika257346\Downloads\Databricks Integration\MarketingEngine\MarketingEngine`

## Decision and Guardrail

The MarketingEngine code is the source of truth for algorithms, routes, payloads,
calculations, filters, transformations, and UI behavior. The reference project is
used only for configuration, Databricks/Unity Catalog access, deployment,
externalized payloads, compatibility adapters, and class/service boundaries.

No reference file will replace a changed MarketingEngine business module unless
its business-function equivalence is proven. New-only features, especially QA
Automation, authentication, Campaign Manager, Settings, and their API contracts,
must remain present.

## Phase 1 - Complete Codebase Comparison

### Inventory summary

| Area | Reference | MarketingEngine | Evidence |
|---|---|---|---|
| Databricks app entrypoint | Present (`app.py`) | Missing | Root inventory |
| Databricks deployment descriptor | Present (`app.yaml`, `app.yml`) | Missing | Root inventory |
| Deployment exclusions | Present (`.databricksignore`) | Missing | Root inventory |
| Production Python manifest | Present (`requirements.txt`) | Only `backend/requirements.txt` | Root/backend inventory |
| Central runtime config | `backend/config.yaml` plus `config/` | Missing | File inventory |
| UC data access | `backend/databricks_uc_io.py` | Missing | File inventory |
| Dataset registry | `backend/data_registry.py` | Missing | File inventory |
| Central path/payload loaders | Present | Missing | File inventory |
| Backend service layer | Seven files under `backend/services/` | Missing | File inventory |
| Pipeline service layer | Nine files under `legacy_idres/services/` | Missing | File inventory |
| Pipeline UC adapter | Present | Missing | File inventory |
| Consent UC adapter | Present | Missing | File inventory |
| Segmentation UC adapter | Present | Missing | File inventory |
| Incremental C360 module | Present | Missing | File inventory |
| QA Automation | Missing/incomplete in reference | Present in MarketingEngine | New-only backend/frontend inventory |
| Authentication | Absent from active reference legacy app | Present in MarketingEngine | Route/function inventory |

The filtered comparison found 126 common application paths. Only 23 were
byte-identical and 103 differed. The reference has 80+ migration-only files that
do not exist in MarketingEngine. MarketingEngine also has substantial new-only
code, including the QA runtime, Campaign Manager, Settings, additional
connectors/authentication behavior, and additional operational data.

### API comparison

- Top-level copilot/measurement business endpoints exist in both projects.
- The reference additionally serves `/`, `/assets/<path>`, and the frontend
  fallback route required by a single-process Databricks App.
- MarketingEngine additionally registers the QA Automation API family.
- The MarketingEngine legacy API adds `/api/login` and `/api/logout`.
- The reference adds a source-aware consent route and uses a `<path:record_id>`
  activity route so encoded record identifiers remain valid.
- Connector URLs are equivalent, though handler/module packaging differs.

### Business-module comparison

The six identity pipeline stages are structurally similar. Most core helper
functions are identical; reference differences concentrate in:

- configuration-derived source lists, prefixes, paths, blocking rules, and
  account identifiers;
- UC file-style adapters around the same CSV/JSON business functions;
- class wrappers whose constructors receive existing business callbacks;
- source-aware output resolution and Databricks error handling.

Because the changed functions are not all byte-identical, the reference pipeline
files cannot be copied wholesale without risking a business regression.

## Phase 2 - Architectural Gap Analysis

| Capability | Reference evidence | MarketingEngine gap | Severity |
|---|---|---|---|
| Databricks Apps packaging | `app.py`, `app.yaml`, `.databricksignore` | No deployable app contract at project root | Critical |
| Unity Catalog access | `databricks_uc_io.py`, `DataRegistry` | Direct local CSV/JSON/path access remains the default | Critical |
| Configuration | `backend/config.yaml`, `config/*.yml` | Catalog/schema/table/path/source settings are in code | Critical |
| Secret handling | Payload loader and environment-name indirection | Literal Adobe credential material and an insecure JWT fallback are in code | Critical |
| Operational persistence | UC tables and Volumes via adapter | Auth and feature artifacts use local CSV/JSON paths | Critical |
| Pipeline subprocesses | `pipeline_uc_bootstrap.py` imported by steps | Child scripts do not install UC compatibility | High |
| Consent writes | `consent_uc_bootstrap.py` | Consent pandas/file writes remain local | High |
| Segment member writes | `segmentation_uc_bootstrap.py` | AI segment output remains path-based | High |
| Class architecture | Backend and pipeline service classes | Core MarketingEngine pipeline remains procedural | High |
| Industry context | Configured source registry and aliases | Source lists/prefixes are repeated in modules | High |
| Frontend hosting | Flask serves built assets and SPA fallback | Active backend does not serve `dist/` | High |
| Error handling | Central `DatabricksDataAccessError` handler | No UC-specific application error handler | Medium |
| Lazy data access | Measurement service loads on demand | Measurement CSV is read twice at import time | High |
| QA Automation data | Reference explicitly records this as missing | QA reads local example/journey/segment JSON; no reference UC table mapping exists | High / mapping input required |
| Auth UC tables | No reference mapping exists | Users, sessions, and audit logs are local CSV files | High / mapping input required |
| Segment metadata master | Reference readiness report says pending | No complete UC segment master implementation to mirror | Open reference gap |
| Journey metadata master | Reference readiness report says pending | No complete UC journey metadata table to mirror | Open reference gap |
| Runtime certification | Reference requires in-Databricks validation | Local environment has no live UC runtime/warehouse evidence | External gate |

### Security findings

1. `backend/app.py` contains a literal Adobe API key and bearer token.
2. `legacy_idres/backend/app.py` falls back to a known default JWT secret.
3. Non-empty local secret files exist under Segmentation and the bundled QA
   beta project.
4. MarketingEngine has no `.databricksignore`; local environments, tools,
   generated files, and secret files could therefore be uploaded.
5. The reference project's local `.env` is also unsafe and will not be copied.

Secret values are intentionally not reproduced in this report.

### No-assumption gaps

The reference does not define authoritative Unity Catalog mappings for:

- QA Automation run/profile/simulation state;
- QA example artifacts outside the configured journey/segment directories;
- authentication users, sessions, and auth audit logs;
- a governed segment master table;
- a governed journey metadata table;
- some MarketingEngine-only operational datasets.

The implementation may expose configuration hooks and safe fail-closed behavior,
but must not invent production catalog/schema/table names. Those mappings remain
deployment inputs and will be reported as open risks.

## Phase 3 - Migration Strategy

1. Add the reference configuration, registry, UC adapter, deployment, and
   service infrastructure without copying any credential-bearing `.env`.
2. Add environment interpolation and fail-fast validation for environment-
   specific catalog/schema/volume/AJO values.
3. Patch the MarketingEngine top-level backend in place:
   - install UC compatibility before importing the legacy app;
   - keep QA route registration;
   - preserve current API response shapes and calculations;
   - replace local journey/segment/report IO with the reference artifact service;
   - replace import-time measurement CSV reads with lazy UC-backed reads;
   - externalize AJO credentials and payload defaults;
   - add static built-frontend serving.
4. Add UC bootstrap imports and configuration-derived constants to pipeline,
   consent, and segmentation modules while keeping their algorithms intact.
5. Add the reference class/service modules as callback-based wrappers; use them
   only where the MarketingEngine function contract is unchanged.
6. Add deployment exclusions for secrets, local data, dependency folders,
   backups, and generated outputs.
7. Validate syntax, configuration, route parity, frontend build, secret scans,
   hardcoding scans, and local API contracts.
8. Keep live UC data/result equivalence as a Databricks deployment gate.

## Phase 4 - File-by-File Implementation Plan

| File/group | Planned change | Functional impact |
|---|---|---|
| `app.py`, `app.yaml`, `app.yml` | Add Databricks entrypoint/deployment configuration from reference; remove environment-specific literal identifiers where the descriptor supports indirection | Packaging only |
| `.databricksignore`, `.gitignore`, `.env.example` | Exclude secrets/local outputs; document required variables without values | No runtime logic change |
| `requirements.txt` | Merge reference Databricks dependencies with QA dependencies already required by MarketingEngine | Dependency availability only |
| `backend/config.yaml`, `config/**` | Add reference mappings; add QA artifact path categories without inventing UC table names | Environment/data resolution only |
| `backend/config_loader.py` | Add validated environment placeholder expansion | Configuration resolution only |
| `backend/databricks_uc_io.py`, `backend/data_registry.py`, `backend/tag_resolver.py` | Copy reference UC foundation | Data-source substitution only |
| `backend/payload_loader.py`, `config/payloads/**` | Copy reference payload externalization and remove literal AJO secrets/payload values from Python | Same request construction from config/env |
| `backend/services/**` | Copy reference base/provider/repository/artifact/measurement/concurrency services | Adds reusable boundaries |
| `backend/app.py` | In-place architectural patch preserving MarketingEngine route logic and QA registration | Expected API contract unchanged |
| `legacy_idres/legacy_pipeline_config.py` | Copy reference source/path/rule context adapter | Centralizes existing constants |
| `legacy_idres/pipeline_uc_bootstrap.py` | Copy reference pipeline UC adapter | Redirects operational IO only in UC mode |
| Pipeline step files | Import adapter and resolve environment-specific constants from config; retain business functions | Expected algorithm/output schema unchanged |
| `legacy_idres/backend/consent_uc_bootstrap.py` and consent modules | Add UC write/read adapter import | Data-source substitution only |
| `legacy_idres/Segmentation/segmentation_uc_bootstrap.py` and segmentation modules | Add UC adapter import | Data-source substitution only |
| `legacy_idres/services/**` | Copy callback-based class wrappers | Adds class architecture without rewriting algorithms |
| QA data loaders | Make configured UC Volume directories usable through the installed compatibility layer | Same JSON shapes and selection logic |
| Authentication | Remove default JWT secret and fail closed when missing; UC auth table names remain an explicit mapping gap | Security hardening; no authentication rule change |
| `scripts/contract_smoke.py` | Add non-mutating route and response-shape checks including QA | Validation only |
| Migration reports | Record every modified file, reason, before/after, Databricks impact, functional impact, and evidence | Documentation only |

## Pre-Implementation Risk Position

The migration can make the application deployable and UC-capable without
rewriting business algorithms. It cannot honestly be certified as fully
production-ready until the missing authoritative UC mappings are supplied and
the Databricks runtime gate is executed against real tables, Volumes, secrets,
and a SQL warehouse. Those are evidence gaps, not assumptions to be filled in
by code.

## Verified Current-State Addendum

Verification date: 2026-07-25

This addendum was completed after the originally planned migration
infrastructure had been added to MarketingEngine and before the remaining
runtime changes in this pass.

### Full-tree evidence

- The filtered reference inventory contains 252 files and the filtered
  MarketingEngine inventory contains 900 files. Generated/local dependency
  folders and the separately bundled QA beta project were excluded.
- There are 232 common relative paths, 20 reference-only paths, and 668
  MarketingEngine-only paths.
- Of the 232 common paths, 29 are byte-identical and 203 differ. The high
  difference count is expected because MarketingEngine remains the business
  source of truth.
- MarketingEngine now contains the planned Databricks entrypoint, deployment
  descriptor, UC adapter, dataset registry, config/payload loaders, service
  classes, pipeline/consent/segmentation bootstraps, and contract smoke script.

### Verified migration omissions

| Finding | Reference evidence | MarketingEngine evidence | Safe action |
|---|---|---|---|
| Consent batch fail-closed guard is missing | `legacy_idres/backend/consent/consent_runtime_guard.py` plus guard calls in ten batch scripts | Guard file and calls absent; the scripts only import the UC bootstrap | Copy the reference guard and add the same import/call sites without changing consent calculations |
| Encoded activity record IDs are not accepted | Reference route uses `<path:record_id>` | MarketingEngine route uses `<record_id>` | Change only the Flask converter; handler logic and response stay unchanged |
| Pipeline service classes are present but not used | Reference Step 1-6 and household entrypoints construct callback-based service classes | MarketingEngine copied the classes but its entrypoints still execute procedural orchestration directly | Route the unchanged functions through the existing callback-based services while preserving MarketingEngine filenames, ML requirement, source selection, and algorithms |
| Global source context remains literal in the legacy backend | Reference derives default/supported sources and reusable payload mappings from config | MarketingEngine still declares source constants and several metadata lists in Python | Externalize only values proven equivalent to existing payload config; retain newer values where equivalence is not proven |

### Validation baseline before remaining runtime changes

- Local application import: PASS.
- UC-mode application import with no warehouse credentials: PASS (134 routes
  registered; no startup-time local-data dependency).
- Local non-mutating contract smoke: PASS, 18/18 checks.
- Route inventory: reference 118 routes; MarketingEngine 134 routes.
  MarketingEngine retains the newer authentication and QA route families.
- The only material reference route-shape difference is the activity
  `<path:record_id>` converter. The consent `<golden_id>` versus `<moscid>`
  difference is the same effective URL pattern and is not a missing callable
  endpoint.

### No-assumption gates retained

No authoritative reference mapping exists for authentication users/sessions/
audit, persisted QA runs/simulations/profiles, a governed segment master, or a
governed journey metadata master. This pass will not invent table names for
those assets. They remain explicit deployment inputs and Databricks runtime
certification gates.
