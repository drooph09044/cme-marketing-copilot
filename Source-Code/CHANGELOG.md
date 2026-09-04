
Previewing CHANGELOG.md
Changelog
2026-07-27 - Unity Catalog Runtime Diagnostics and Source Inventory
Data access
Replaced file-glob discovery in Unity Catalog mode with the configured source-table registry, including source-system filtering for Media & OTT, Sports, Automotive, and Telecom.
Added batched table counts and column metadata to the Input Sources API so first-party source and total-record KPIs use Unity Catalog values.
Preserved table count and column-access errors instead of converting them to silent zero values.
Operations
Added GET /api/runtime/uc-health?source=<source> to validate the warehouse binding, catalog/schema configuration, exact raw source tables, and identity-resolution output tables without exposing credentials or row data.
Updated the Input Sources page to show the backend access error and a Retry action instead of silently rendering zero source tables.
Stopped retrying dependency-level 503 responses and disabled retries for the three-second pipeline status poll, preventing overlapping request storms.
Documented the required Databricks App source root, SQL warehouse binding, and Unity Catalog permissions.
Validation
Added a configured-table regression test covering Media source inventory and slv_med_golden_records resolution.
Extended the API/static contract smoke suite with the Unity Catalog health endpoint.
Passed Python compilation, the production frontend build, the configured UC inventory regression, and all 25 local and 25 fail-closed UC contract checks.
2026-07-26 - Databricks Frontend Asset Deployment Fix
Static bundle
Explicitly included dist/ and its hashed assets in the source/deployment ignore contracts.
Added frontend bundle discovery for the application root, Databricks parent source directory, working directory, and optional CODEX_FRONTEND_DIST override.
Added an incomplete-bundle diagnostic that reports the selected directory, missing referenced files, and searched locations instead of serving a blank page with asset 404 responses.
Disabled caching for index.html and enabled immutable caching for hashed JavaScript and CSS assets.
Validation
Extended the contract smoke suite to extract every built asset referenced by index.html and require an HTTP 200 response.
Passed 24/24 application and static-asset contracts in both local and Unity Catalog modes.
Verified the root HTML is non-cacheable and hashed JavaScript assets use immutable caching.
2026-07-25 - Databricks and Unity Catalog Migration Hardening
Architecture
Verified the complete MarketingEngine migration foundation against the cme-marketing-copilot reference without replacing MarketingEngine business algorithms.
Centralized legacy runtime paths, source aliases, pipeline metadata, identity fields, export fields, segment definitions, journey definitions, activity timestamps, and subscription patterns behind the existing configuration and payload loaders.
Activated callback-based services for semantic tagging, preprocessing, standardization, matching, clustering, golden-record generation, evaluation, and household linking while preserving MarketingEngine filenames and function behavior.
Unity Catalog Safety
Added the fail-closed consent runtime guard and enforced it in all ten consent batch modules.
Verified application startup in Unity Catalog mode without a SQL warehouse and confirmed that operational endpoints return controlled service errors instead of reading local data.
Documented catalog, schema, table, and Volume override hooks in .env.example.
API and Deployment
Updated the activity route to accept encoded path-style record identifiers.
Changed the Databricks App process model to one worker and eight threads so current in-memory QA run/simulation state remains consistent.
Rebuilt the production frontend bundle.
Validation
Expanded the contract smoke suite from 18 to 22 checks, adding encoded activity IDs, QA journey/segment endpoints, and the login edge case.
Passed 22/22 contract checks in both local and Unity Catalog modes.
Passed active Python compilation, configuration/registry validation, source/segment/journey parity assertions, service/guard coverage, secret scanning, and the production frontend build.
Added DATABRICKS_MIGRATION_REPORT.md with the eight-phase implementation record, detailed change ledger, readiness matrix, and external production gates.
2026-04-22 - Customer Profile CSV Export Automation
Backend
Customer 360 Export
Added automated Customer Profile CSV generation at legacy_idres/customer_profile_export.csv
Added POST /api/enrichment/export to manually regenerate the Customer Profile export
Updated GET /api/enrichment to refresh the CSV from the same Customer 360 rows used by the UI
Added exported Customer Profile fields:
identity fields from golden_records.csv
deterministic enrichment fields such as LTV, recency, engagement, affinity, and identity strength
activity_timeline JSON generated from clustered_records.csv
Reused the activity timeline helper in /api/profile/<golden_id>/cluster-data so the modal and CSV export use the same timeline logic
Pipeline Automation
Updated /api/pipeline/run-all so clicking Run Full Pipeline in Pipeline Overview regenerates customer_profile_export.csv after all pipeline steps complete successfully
Appends a final-step log message showing the export path and exported row count
Prevents export refresh when the full pipeline fails partway through, avoiding partial-output CSV regeneration
Data Export
Added generated legacy_idres/customer_profile_export.csv
Current export includes 3,506 Customer Profile rows with activity timeline data
Local Runtime Hygiene
Updated .gitignore to exclude local dependency/runtime artifacts created while running the app:
.venv/
.pydeps/
logs/
.tools/npm.tgz
Developer Setup
Added setup.bat to create the Python virtual environment, install backend dependencies, and install frontend npm packages on a fresh Windows machine
Added start.bat to launch the Flask backend and Vite frontend in separate terminal windows
Startup scripts prefer system Python/npm from PATH and fall back to the repo-local npm shim only when the bundled npm files are available
2026-04-16 — Household IDs, Preferred Source per Tag, Edge Tier Fix
Frontend
Golden Records Page
Added household_id column to the golden records table (displayed after golden_id)
Household IDs styled in bold purple (#8b5cf6) for visual distinction
Search placeholder updated to support searching by household ID
ID Graph Page
Added a 5th KPI card showing the household ID for the selected cluster (purple, monospace font)
KPI grid dynamically expands to 5 columns when household data is present
Cluster sidebar now displays household ID below the golden ID (clickable to copy, purple text)
Search placeholder updated to support searching by household
Blocking Config Page
Replaced the hidden "Preferred Data Source per Tag" section with a fully functional card
Added a global strategy selector dropdown with three options:
Most Preferred Source — reveals per-tag source dropdowns for email, phone, address
Most Recent — applies to all tags, hides per-tag table
Most Frequent — applies to all tags, hides per-tag table
Smart initialization: detects saved strategy on page load
Single "Save Configuration" button now saves both blocking config and source preferences together
Backend
API Changes
/api/graph/<cluster_id> — now returns household_id in the response
/api/clusters — each cluster entry now includes household_id; search supports filtering by household ID
/api/golden-records — household_id column included in response data
Pipeline — Step 3 (Blocking & Matching)
Replaced field-count heuristic in classify_edge() with score-based threshold classification using edge_tiers config
Ensures all 4 tiers (exact, strong, medium, weak) are properly populated based on match scores
Pipeline — Step 5 (Golden Record)
Added household assignment via Union-Find algorithm:
Groups golden records by shared device_id or matching address + zip
Max household size capped at 8 (realistic family size)
Devices shared by more than 3 golden records are skipped (public/shared kiosks)
Added PII filter: removes golden records with no name, email, or phone (device-only orphans)
Provenance now only written for retained golden records
Superseded IDs rebuilt to exclude filtered-out records
Writes household_summary.json with distribution stats
Configuration
blocking_config.json
Tag weights tuned to match original reference:
email: 52, phone: 28, device_id: 25, ip_address: 15, last_name: 13, first_name: 12, address: 8, zip: 5
Edge tier thresholds adjusted for balanced distribution:
exact: >= 100 (full identity match)
strong: >= 75 (email + name or email + device + ip)
medium: >= 55 (email + ip or email + partial name)
weak: >= 40 (email only or device + ip)
requirements.txt
Added missing Python dependencies: faker, usaddress, email-typo-fixer, numpy
.gitignore
Added __pycache__/ and *.pyc to prevent compiled Python files from being tracked
Pipeline Output Summary
Golden records: ~3,505 (100% purity, 0 impure)
Households: ~1,851 (max size 8, realistic distribution)
Edge tiers: exact 2.0% / strong 47.6% / medium 5.4% / weak 45.0%
Precision: 0.9999 | Recall: 0.4990 | F1: 0.6658
Cluster purity: 99.57%
