# MarketingEngine Databricks and Unity Catalog Migration Report

Date: 2026-07-25  
Reference project: `cme-marketing-copilot`  
Migrated project: `MarketingEngine`

## Executive Decision

**Migration implementation status: code-complete within the supplied
workspace.**

**Production certification status: pending external deployment inputs and a
live Databricks validation run.**

The migrated MarketingEngine now has the Databricks Apps packaging,
configuration, Unity Catalog (UC) compatibility layer, dataset registry,
central payload loaders, service boundaries, pipeline bootstraps, consent
fail-closed controls, static frontend hosting, and validation coverage found in
the reference architecture. MarketingEngine remains the source of truth for
business functions.

No core identity, matching, clustering, golden-record, evaluation, enrichment,
segmentation, consent, campaign, authentication, or QA algorithm was replaced
with reference logic. The retained MarketingEngine application registers 134
routes compared with 118 in the reference and keeps the newer authentication
and QA route families.

The available validation proves:

- 136 active Python source files compile;
- application import succeeds in local and UC modes;
- 24 of 24 non-mutating API and static-asset contract checks pass in local mode;
- 24 of 24 checks pass in UC mode without falling back to local operational
  data;
- all four configured source systems and 126 dataset registry references load;
- configured source aliases, 41 segments, and 13 journeys match the active
  runtime values;
- pipeline service and consent guard coverage is complete;
- the production frontend builds successfully;
- no credential literals were found in the active deployable source.

The remaining blockers are not safe to infer from the reference repository:
authoritative UC mappings for authentication and persisted QA state, governed
segment and journey master datasets, production secrets, and a live SQL
warehouse/runtime. Those are deployment decisions, not missing business code.

---

## Phase 1 - Complete Codebase Comparison

### 1.1 Full-tree inventory

Generated dependencies, local data/output folders, backups, and the separately
bundled QA beta project were excluded from the application comparison.

| Measure | Reference | MarketingEngine |
|---|---:|---:|
| Filtered files | 252 | 900 |
| Common relative paths | 232 | 232 |
| Project-only paths | 20 | 668 |
| Byte-identical common files | 29 | 29 |
| Differing common files | 203 | 203 |
| Registered Flask routes | 118 | 134 |

The difference count confirms that copying the reference application wholesale
would have overwritten substantial MarketingEngine behavior. The reference was
therefore used as an architectural pattern, while changed MarketingEngine
business modules were retained.

### 1.2 Functional comparison

| Domain | Result |
|---|---|
| Identity resolution steps 1-6 | Same functional stages; MarketingEngine callbacks and filenames retained |
| Matching and clustering | MarketingEngine scoring, thresholds, graph operations, and output shapes retained |
| Golden record and evaluation | MarketingEngine survivorship, provenance, household, evaluation, and export behavior retained |
| Consent | Existing consent calculations retained; reference fail-closed UC batch guard added |
| Segmentation and journeys | MarketingEngine metadata and endpoints retained; values moved behind config/payload loaders where equivalence was proven |
| Measurement and enrichment | MarketingEngine response shapes and calculations retained; UC/lazy access architecture verified |
| Authentication | MarketingEngine-only routes retained; secret configuration fails closed |
| QA Automation | MarketingEngine-only routes and in-memory runtime retained; deployment constrained to one worker for consistency |
| Frontend | MarketingEngine UI retained and rebuilt; Flask/Databricks Apps serving contract verified |

### 1.3 API findings

- The MarketingEngine API is a strict functional superset by route count.
- Authentication and QA Automation endpoints remain present.
- The activity endpoint now uses Flask's `path` converter so an encoded record
  identifier is not truncated.
- The reference consent variable name difference (`golden_id` versus `moscid`)
  does not change the callable URL pattern and did not require a route change.
- UC-backed endpoint failures return controlled service errors when a warehouse
  is unavailable; they do not silently read local operational files.

---

## Phase 2 - Architectural Gap Analysis

The detailed pre-implementation analysis is in
`MIGRATION_GAP_ANALYSIS.md`. The material gaps and their final disposition are
summarized here.

| Gap | Initial severity | Final disposition |
|---|---|---|
| Databricks Apps entrypoint, descriptor, and exclusions | Critical | Implemented and verified |
| Central configuration and environment interpolation | Critical | Implemented and parsed successfully |
| UC data adapter and dataset registry | Critical | Implemented; 126 references verified |
| Local path dependency in operational pipelines | Critical | UC bootstraps installed; no-local-fallback smoke passed |
| Credential literals and insecure secret defaults | Critical | Removed from deployable runtime; environment/secret inputs required |
| Backend and pipeline class boundaries | High | Added; all eight active service constructions verified |
| Consent batch writes without UC fail-closed guard | High | Fixed in all ten batch scripts |
| Pipeline child-process UC compatibility | High | Implemented through pipeline bootstrap |
| Consent and segment UC compatibility | High | Implemented through domain bootstraps |
| Encoded activity identifiers | Medium | Fixed with `path:record_id` |
| QA state across multiple app workers | High | Single-worker deployment preserves current state semantics |
| Auth UC repository mapping | High/external | Open; no authoritative mapping supplied |
| Persisted QA run/simulation/profile mapping | High/external | Open; no authoritative mapping supplied |
| Governed segment and journey masters | External/reference gap | Open; configuration remains authoritative |
| Live runtime/table/result certification | External | Pending Databricks deployment |

### Security position

- Active deployable source contains no detected Adobe key, bearer token, JWT
  default, password, or private-key literal.
- `.databricksignore` excludes `.env` files, login CSVs, local data, generated
  results, dependencies, backups, archives, logs, and the separately bundled QA
  beta project.
- Existing ignored local secret files were not copied into runtime config and
  were not deleted because they may be user-owned evidence. If their values are
  real, the owner should rotate them and remove the local files.
- Required secret values are represented by names/placeholders only.

---

## Phase 3 - Migration Strategy Used

1. Treat MarketingEngine as the source of truth for all functions and payload
   contracts.
2. Inventory both trees and compare common, reference-only, and
   MarketingEngine-only modules.
3. Reuse only the reference's Databricks architecture: configuration, registry,
   IO compatibility, service boundaries, deployment packaging, and error
   handling.
4. Install the UC compatibility layer before application and pipeline modules
   access data.
5. Move equivalent source/path/payload metadata into configuration while
   retaining newer MarketingEngine-only values.
6. Wrap existing functions with callback-based services instead of rewriting
   algorithms.
7. Add fail-closed behavior wherever UC mode cannot safely use a local output.
8. Validate local behavior, UC behavior, static assets, security hygiene, and
   configuration parity independently.
9. Keep missing catalog/schema/table decisions as explicit gates rather than
   inventing names.

This strategy minimizes regression risk because architecture changes occur
around the existing functions, not inside their calculations.

---

## Phase 4 - Implemented File Plan

### Databricks application and deployment

| File/group | Implemented purpose |
|---|---|
| `app.py` | Databricks Apps entrypoint, UC bootstrap, application construction, and built-frontend serving |
| `app.yaml` | Production command and one-worker/eight-thread state-safe process model |
| `.databricksignore` | Deployment boundary excluding secrets, local data, dependencies, backups, and generated files |
| `.env.example` | Value-free catalog, schema, table, Volume, warehouse, secret, and app configuration contract |
| `requirements.txt` | Production Python dependency manifest |
| `dist/**` | Current production frontend bundle |

`app.yaml` is the canonical descriptor. A duplicate `app.yml` was intentionally
not added because two competing deployment descriptors create ambiguity and
provide no functional value.

### Configuration, registry, and data access

| File/group | Implemented purpose |
|---|---|
| `backend/config.yaml`, `config/**/*.yml` | Source, directory, table, payload, pipeline, consent, segment, journey, and runtime metadata |
| `backend/config_loader.py` | Validated environment interpolation and typed configuration access |
| `backend/databricks_uc_io.py` | UC table/Volume compatibility and controlled access failures |
| `backend/data_registry.py` | Central logical dataset resolution |
| `backend/tag_resolver.py` | Central tag/field resolution |
| `backend/payload_loader.py` | Externalized segment, journey, and runtime payload access |
| `backend/services/**` | Provider, repository, artifact, measurement, concurrency, and application boundaries |

### Identity, consent, and segmentation runtime

| File/group | Implemented purpose |
|---|---|
| `legacy_idres/legacy_pipeline_config.py` | Source-aware pipeline configuration |
| `legacy_idres/pipeline_uc_bootstrap.py` | UC-compatible IO for pipeline subprocesses |
| `legacy_idres/backend/consent_uc_bootstrap.py` | UC-compatible consent IO |
| `legacy_idres/Segmentation/segmentation_uc_bootstrap.py` | UC-compatible segmentation IO |
| `legacy_idres/services/**` | Callback-based class boundaries around unchanged functions |
| Pipeline steps 1-6 and household generator | Active construction/use of the corresponding service classes |
| Consent batch modules | Fail-closed UC runtime guard |
| `legacy_idres/backend/app.py` | Configuration-driven runtime values and encoded activity route |

### Validation

| File/group | Implemented purpose |
|---|---|
| `scripts/contract_smoke.py` | Non-mutating local/UC route and status checks, including QA and auth edge cases |
| `MIGRATION_GAP_ANALYSIS.md` | Pre-change comparison, risk position, and verified addendum |
| `DATABRICKS_MIGRATION_REPORT.md` | Final implementation evidence and production gate record |

---

## Phase 5 - Detailed Change Ledger

Each row records: **A** file, **B** reason, **C** old behavior, **D** new
behavior, **E** rationale, **F** Databricks impact, **G** functional impact, and
**H** validation.

### 5.1 Deployment and configuration changes

| A. File | B. Reason | C. Old | D. New | E. Why | F. Databricks impact | G. Functional impact | H. Validation |
|---|---|---|---|---|---|---|---|
| `.env.example` | Complete deployment contract | Singular table-schema hook and incomplete mapping inputs | Adds catalog, plural table-schema map, and Volume-directory map placeholders | Documents all supported environment overrides without values | Enables environment-specific UC mapping | None | Value-free secret scan and config parse |
| `app.yaml` | Preserve QA state consistency | Two gunicorn worker processes, each with independent memory | One worker with eight threads | Current QA runs/simulations are in memory | Stable Databricks App behavior until governed persistence exists | Same API; removes random cross-worker state loss | Local and UC smoke; command inspection |
| `.databricksignore` | Secure deployable boundary | Local and generated artifacts could be included | Excludes secrets, CSV/JSON outputs, dependencies, backups, archives, logs, and the beta bundle while explicitly including `dist/**` | Prevents data/secret leakage while retaining the production frontend | Only production code/config/assets are deployed | None | 100 rules inspected |
| `config/payloads/legacy_runtime.yml` | Externalize proven runtime constants | Activity timestamp and subscription-source lists embedded in Python | Adds MarketingEngine-specific timestamp and subscription pattern keys | Avoids adopting a broader reference list that could change behavior | Configurable per deployment | Values remain exactly equal to prior MarketingEngine constants | Config parity assertions |
| `dist/**` | Supply current UI bundle | Prior or stale build artifacts | Fresh Vite production bundle: 3 files, 2,028,695 bytes | Databricks App serves built assets | Deployable single-app frontend | UI source unchanged | Vite build: 1,293 modules, PASS |

### 5.2 Legacy API configuration and route change

| A. File | B. Reason | C. Old | D. New | E. Why | F. Databricks impact | G. Functional impact | H. Validation |
|---|---|---|---|---|---|---|---|
| `legacy_idres/backend/app.py` | Remove repeated runtime metadata from code | Root/data/output paths, sources, pipeline files, field lists, segments, journeys, activity metadata, and source aliases declared locally | Uses central path, source, payload, segment, journey, and runtime loaders; local names keep `.csv`, UC logical names are extensionless | One source of environment truth with exact MarketingEngine values | UC names resolve through registry/compatibility layer | Response contracts and calculations unchanged | 134-route import in both modes; config parity; 24/24 smoke |
| `legacy_idres/backend/app.py` | Support encoded record IDs | `/activity/<record_id>` rejected slash-containing encoded identifiers | `/activity/<path:record_id>` | Matches reference route robustness | None | Expands accepted identifiers; handler unchanged | Encoded activity smoke returns expected controlled 404 |

### 5.3 Pipeline service activation

| A. File | B. Reason | C. Old | D. New | E. Why | F. Databricks impact | G. Functional impact | H. Validation |
|---|---|---|---|---|---|---|---|
| `step1_semantic_tagging.py` | Use class boundary | Procedural orchestration | Constructs `SemanticTaggingService` with existing callbacks | Matches reference architecture without copying algorithms | Service receives configured/UC-resolved inputs | Mandatory ML and missing-input behavior retained | Class construction and compile PASS |
| `step2_preprocess.py` | Use class boundary | Procedural orchestration | Constructs `PreprocessingService` | Consistent pipeline boundary | UC bootstrap remains active | `all_preprocessed.csv` local contract retained | Class construction and compile PASS |
| `step2b_standardize.py` | Use class boundary | Procedural orchestration | Constructs `StandardizationService` | Consistent pipeline boundary | UC bootstrap remains active | `all_standardized.csv` local contract retained | Class construction and compile PASS |
| `step3_blocking.py` | Use class boundary | Procedural orchestration | Constructs `MatchingService` with existing scoring/matching callbacks | Separates orchestration from business functions | Source-aware configured IO | Matching rules, edge tiers, and output schema unchanged | Service source/config assertions and compile PASS |
| `step4_clustering.py` | Use class boundary | Procedural orchestration | Constructs `ClusteringService` with existing graph callbacks | Separates orchestration from clustering | Source-aware configured IO | Cluster algorithm unchanged | Class construction and compile PASS |
| `step5_golden_record.py` | Use class boundary | Procedural orchestration | Constructs `GoldenRecordService` with existing survivorship callbacks | Separates orchestration from calculation | Source-aware configured IO | Golden ID, household, provenance, and export logic unchanged | Class construction and compile PASS |
| `step6_evaluation.py` | Use class boundary | Procedural orchestration | Constructs `EvaluationService` with existing evaluation callbacks | Separates orchestration from metrics | Configured/UC-aware output resolution | Metric formulas and report schema unchanged | Class construction and compile PASS |
| `generate_household_links.py` | Add source-aware service orchestration | Direct local-only orchestration | Constructs `HouseholdLinkService` around the same pairwise household algorithm and configured sources | Makes household step consistent with pipeline architecture | Supports UC bootstrap and logical paths | Pairing logic and local CSV names retained | Four-source service assertion and compile PASS |
| `legacy_idres/services/semantic_tagging_service.py` | Preserve newer Step 1 rules | Reference wrapper allowed manual fallback and missing-input skipping | Adds `ml_required` and `skip_missing_inputs`; active caller sets `True`/`False` | Prevent architectural reuse from weakening MarketingEngine behavior | Fail-fast behavior is retained in jobs | No business change | Constructor assertions |
| `legacy_idres/services/preprocessing_service.py` | Preserve union filename | Reference wrapper used a different/default union name | Adds optional `union_filename`; active caller uses `all_preprocessed.csv` | Preserve downstream contract | Logical name remains portable | No schema/name regression | Constructor assertions |
| `legacy_idres/services/standardization_service.py` | Preserve union filename | Reference wrapper used a different/default union name | Adds optional `union_filename`; active caller uses `all_standardized.csv` | Preserve downstream contract | Logical name remains portable | No schema/name regression | Constructor assertions |

### 5.4 Consent fail-closed changes

| A. File | B. Reason | C. Old | D. New | E. Why | F. Databricks impact | G. Functional impact | H. Validation |
|---|---|---|---|---|---|---|---|
| `legacy_idres/backend/consent/consent_runtime_guard.py` | Prevent unsafe local writes in UC jobs | No centralized batch guard | Reference-equivalent runtime guard | A UC batch must not silently write local consent results | Fails closed when UC compatibility is unavailable | Consent calculations unchanged | Import/call coverage scan |
| `build_identity_graph.py` | Enforce guard | Batch ran without explicit UC readiness check | Imports and calls guard before work | Safe output boundary | Prevents local fallback | None in local mode | Coverage and compile PASS |
| `consent_enrich.py` | Enforce guard | Same | Same guard call | Same | Same | None in local mode | Coverage and compile PASS |
| `consent_gate.py` | Enforce guard | Same | Same guard call | Same | Same | None in local mode | Coverage and compile PASS |
| `consent_golden_record.py` | Enforce guard | Same | Same guard call | Same | Same | None in local mode | Coverage and compile PASS |
| `consent_household_propagation.py` | Enforce guard | Same | Same guard call | Same | Same | None in local mode | Coverage and compile PASS |
| `consent_idr_join.py` | Enforce guard | Same | Same guard call | Same | Same | None in local mode | Coverage and compile PASS |
| `consent_ledger.py` | Enforce guard | Same | Same guard call | Same | Same | None in local mode | Coverage and compile PASS |
| `consent_refresh.py` | Enforce guard | Same | Same guard call | Same | Same | None in local mode | Coverage and compile PASS |
| `consent_survivorship.py` | Enforce guard | Same | Same guard call | Same | Same | None in local mode | Coverage and compile PASS |
| `consent_validation_report.py` | Enforce guard | Same | Same guard call | Same | Same | None in local mode | Coverage and compile PASS |

### 5.5 Validation expansion

| A. File | B. Reason | C. Old | D. New | E. Why | F. Databricks impact | G. Functional impact | H. Validation |
|---|---|---|---|---|---|---|---|
| `scripts/contract_smoke.py` | Cover retained/new endpoint families and deployed assets | 18 checks; generic mutating methods lacked explicit empty JSON and built assets were not requested | 24 checks; safe empty JSON, encoded activity path, QA journeys, QA segments, login edge case, and every JS/CSS path extracted from `index.html` | Prevent a successful API smoke from masking a blank frontend | Same suite runs in local and UC modes | Validation only | 24/24 local and 24/24 UC PASS |
| `MIGRATION_GAP_ANALYSIS.md` | Establish before/after evidence | Earlier plan did not reflect already-present scaffolding | Adds verified inventory, omissions, baseline, and no-assumption gates before final hardening | Auditable migration decision record | None | None | Manual review |

### 5.6 Previously present migration foundation verified in this pass

The workspace contained part of the migration foundation before this final
hardening pass. With no usable repository history, those files cannot be
truthfully attributed to a specific earlier commit. They were inspected and
validated as part of the completed target:

- root `app.py`, `requirements.txt`, `.databricksignore`, and deployment config;
- `backend/config_loader.py`, `databricks_uc_io.py`, `data_registry.py`,
  `tag_resolver.py`, `payload_loader.py`, and `backend/services/**`;
- `config/**` table, path, source, consent, segment, journey, pipeline, and
  payload mappings;
- pipeline, consent, and segmentation UC bootstraps;
- service class modules under `legacy_idres/services/**`;
- incremental Customer 360 support and application error handling;
- static frontend routing and lazy data-service integration.

This distinction prevents fabricated edit history while still certifying the
current delivered state.

---

## Phase 6 - Validation and Regression Evidence

| Validation | Result | Evidence/meaning |
|---|---|---|
| Active Python compilation | PASS | 136 files compiled from source; dependencies, backups, and beta bundle excluded |
| Config parse | PASS | Config version 1; four source systems; 22 configured directories |
| Registry validation | PASS | 126 logical dataset references resolve structurally |
| Payload config parse | PASS | All configured YAML payload files load |
| Configuration parity | PASS | 81 source-label cases, 41 segments, 13 journeys; identity/export/activity metadata exact |
| Pipeline service coverage | PASS | Eight service classes constructed with expected sources, filenames, and Step 1 flags |
| Consent guard coverage | PASS | Guard file plus import/call in all ten batch modules |
| Local application import | PASS | 134 routes |
| UC-mode application import | PASS | 134 routes without warehouse credentials |
| Local API/static smoke | PASS | 24/24, including both hashed frontend assets |
| UC-mode API/static smoke | PASS | 24/24; UC data endpoints fail in a controlled manner when warehouse is absent |
| No-local-fallback behavior | PASS | UC mode does not substitute local operational CSV/JSON results |
| Secret literal scan | PASS | No matches in active deployable source |
| Absolute-path scan | PASS | No active environment-specific path literals found; logger format false positives excluded |
| Frontend production build | PASS | Vite 5.4.21; 1,293 modules transformed |

The frontend build emitted a size advisory for the approximately 1.95 MB
JavaScript bundle. It is a performance optimization opportunity, not a build
or functional failure.

### Post-deployment static asset hardening (2026-07-26)

The first Databricks deployment served `dist/index.html` but returned HTTP 404
for the two hashed files it referenced. The deployment also started Flask's
development server, proving that the deployed source did not use the canonical
root `app.yaml`.

The target now:

- explicitly includes `dist/**` in both source and Databricks deployment ignore
  contracts;
- resolves the complete bundle from the configured root, Databricks parent
  source directory, working directory, or `CODEX_FRONTEND_DIST`;
- reports an incomplete bundle as a controlled HTTP 503 with missing-file
  diagnostics instead of returning a blank application shell;
- serves `index.html` without caching and hashed assets with immutable caching;
- validates the bundle independently with
  `scripts/verify_frontend_bundle.py`; and
- requests every asset referenced by `index.html` in the local and UC smoke
  suites.

The corrected bundle contains the 80,278-byte CSS asset and 1,948,009-byte
JavaScript asset. Both returned HTTP 200 in local and UC-mode validation.

### What this validation proves

- Route registration and non-mutating status contracts remain intact.
- MarketingEngine-only authentication and QA endpoints remain registered.
- Configuration externalization did not alter the active metadata values.
- The service refactor preserved callback selection, source lists, and local
  output filenames.
- UC mode starts without relying on local datasets and reports missing runtime
  infrastructure safely.

### What requires live data to prove

Exact row-by-row equivalence, volume write behavior, SQL warehouse queries,
permissions, secret scopes, performance, and production concurrency require a
live Databricks environment with representative source data. These cannot be
proven from a source-only workspace.

---

## Phase 7 - Databricks Readiness

### Deployment readiness matrix

| Capability | Status | Notes |
|---|---|---|
| Databricks Apps entrypoint | Ready | Root app construction and SPA serving present |
| App command | Ready | Gunicorn, one worker/eight threads |
| Dependency manifest | Ready | Root production requirements present |
| Deployment exclusions | Ready | Secrets/local outputs/dependencies excluded |
| Central configuration | Ready | Environment overrides and validated loaders |
| UC table/Volume adapter | Ready for mapped datasets | Controlled errors when infrastructure is missing |
| Dataset registry | Ready | 126 references structurally validated |
| Identity pipeline UC bootstrap | Ready for live certification | Algorithms retained |
| Consent UC bootstrap and guard | Ready for live certification | Fails closed |
| Segmentation UC bootstrap | Ready for live certification | Mapping-dependent |
| Frontend artifact | Ready | Production build passes |
| Authentication persistence | Mapping required | Do not deploy as production auth until governed repository is supplied |
| QA persistent state | Mapping required | Current state is in memory; one-worker mitigation applied |
| Governed segment master | Mapping required | No authoritative reference mapping |
| Governed journey master | Mapping required | No authoritative reference mapping |
| End-to-end production certification | Pending | Requires live warehouse, secrets, tables, Volumes, grants, and representative data |

### Required deployment inputs

Supply these through Databricks App environment variables, secret references,
or approved configuration overrides:

- catalog and schema names;
- logical table-to-UC mappings;
- logical directory-to-Volume mappings;
- SQL warehouse identifier and server/host configuration;
- service principal or application authentication supplied by the platform;
- JWT/application secret;
- Adobe/AJO credentials and endpoint-specific identifiers where those features
  are enabled;
- authoritative auth and persisted QA repository decisions;
- UC grants for the application principal.

No value is embedded in source control or this report.

### Recommended live certification sequence

1. Create or identify the catalog, schemas, tables, and Volumes.
2. Populate the explicit environment mapping contract.
3. Grant least-privilege access to the Databricks App identity.
4. Add required secrets through the approved secret mechanism.
5. Deploy the application and confirm root/asset health.
6. Run read-only UC endpoint smoke tests.
7. Run pipeline steps against a representative, isolated dataset.
8. Compare row counts, schemas, IDs, edge tiers, clusters, golden records,
   consent outputs, segments, and evaluation metrics with the approved
   MarketingEngine baseline.
9. Exercise consent and segmentation writes in an isolated target.
10. Complete authentication and QA persistence tests after their mappings are
    approved.
11. Record performance, concurrency, restart, and rollback evidence.

---

## Phase 8 - Open Risks and Recommendations

| Priority | Risk | Recommendation |
|---|---|---|
| Critical | No authoritative UC tables for users, sessions, and auth audit | Approve a governed authentication repository and mappings before production access |
| Critical | No persistent QA run/simulation/profile repository | Define UC tables or another approved durable store; then multi-worker scaling can be reconsidered |
| High | Segment and journey masters are configuration/artifact-backed | Approve governed master tables if production stewardship requires them |
| High | No live Databricks execution evidence | Run the certification sequence above in the target workspace |
| High | Existing ignored local secret files may contain real values | Rotate real credentials and securely remove local copies under owner control |
| Medium | Frontend bundle is large | Introduce route-level code splitting after migration certification; do not combine optimization with migration acceptance |
| Medium | One worker limits process-level scale | Retain until QA state is durable; scale with threads/replicas only after state design is approved |
| Medium | Full result equivalence needs representative data | Establish signed baseline datasets and expected output checksums/counts |

## Final Readiness Statement

The MarketingEngine repository is **ready for Databricks deployment and live
certification**, with its existing business functions preserved and its
Databricks/Unity Catalog architecture implemented.

It is **not yet certified for unrestricted production use** because the target
workspace mappings, grants, secrets, governed authentication/QA persistence,
and live result-equivalence evidence were not supplied. Declaring otherwise
would require unsupported assumptions.

Once those external gates are supplied, the remaining work is deployment
configuration and live verification rather than a redesign of the migrated
application.
