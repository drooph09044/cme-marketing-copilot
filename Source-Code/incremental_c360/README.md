# Customer360 Incremental Generation Framework

This package adds a metadata-driven incremental data generation and Delta Lake UPSERT layer without changing existing Customer360 business logic.

## What It Does

- Discovers Unity Catalog datasets from `system.information_schema`.
- Classifies only Media, Sports, and Automotive tables.
- Excludes Telecom tables through disabled domain configuration and table exclusion patterns.
- Profiles source tables before generation.
- Generates daily synthetic inserts and business-style updates for a configurable 45-day campaign.
- Performs Delta Lake `MERGE` operations with schema evolution and change detection.
- Maintains audit, job-control, quality, and watermark tables.
- Refreshes discovered identity graph/link tables for newly generated customers where those tables exist.
- Runs in Databricks or locally with PySpark plus Databricks SQL connectivity.

## Production Design Decisions

- Table names are not hardcoded. Discovery uses Unity Catalog metadata and information schema.
- Domain behavior is configuration-driven in `config.yaml`; daily insert counts and update percentages can be changed without code edits.
- Telecom is explicitly disabled and filtered at discovery and classification.
- Existing tables are updated through Delta `MERGE`; no overwrite or truncation path is used.
- Generated updates are keyed by run date and random seed so record selection varies by day while remaining replayable.
- Audit and job-control tables are append-only, which keeps replay history intact.
- Databricks job clusters are recommended for this batch workload because they give isolated dependency control, autoscaling, auto-termination, and predictable cost boundaries.

## Run In Databricks

```bash
databricks bundle deploy
databricks bundle run c360_incremental_45_day_campaign
```

Or run the Python task directly from a Databricks notebook/job:

```bash
python incremental_c360/main.py --config incremental_c360/config.yaml --run-date 2026-07-22
```

## Run Locally

Install requirements and set:

```bash
pip install -r incremental_c360/requirements.txt
set DATABRICKS_HOST=https://adb-xxxx.azuredatabricks.net
set DATABRICKS_TOKEN=<token>
set DATABRICKS_WAREHOUSE_ID=<warehouse-id>
set DATABRICKS_CATALOG=main
python incremental_c360/main.py --config incremental_c360/config.yaml
```

## Local Scheduling

Windows:

```bash
schtasks /Create /SC DAILY /TN c360_incremental_45_day_campaign /TR "python incremental_c360/main.py --config incremental_c360/config.yaml" /ST 08:00 /F
```

Linux/macOS cron:

```cron
0 8 * * * python /path/to/incremental_c360/main.py --config /path/to/incremental_c360/config.yaml
```

## Recovery

- Re-run a specific day with `--run-date YYYY-MM-DD`.
- Use the audit and job-control tables to find failed batches.
- Watermark rows are updated only after successful table processing.
- Delta Lake ACID transactions protect partial merges.

## Performance

- Keep Delta tables partitioned by stable business date columns where available.
- ZORDER by discovered primary/candidate keys and high-use join keys.
- Use autoscaling job clusters for variable table volumes.
- Run `OPTIMIZE` after daily merges and `VACUUM` with the configured retention window.

