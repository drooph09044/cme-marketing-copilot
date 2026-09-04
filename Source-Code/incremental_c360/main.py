from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audit_logger import AuditLogger
from data_profiler import profile_tables
from data_quality_framework import assert_quality, validate_dataframe
from domain_identifier import classify_tables
from generic_upsert_engine import delta_merge, optimize_table
from identity_graph_processor import refresh_identity_graph
from job_controller import JobController
from metadata_manager import SqlRunner, load_config, matches_any, metadata_table_name
from synthetic_data_generator import generate_domain_changes
from unity_catalog_discovery import discover_unity_catalog_tables
from watermark_manager import WatermarkManager


def parse_args():
    parser = argparse.ArgumentParser(description="Customer360 45-day incremental generator")
    parser.add_argument("--config", default=str(Path(__file__).with_name("config.yaml")))
    parser.add_argument("--run-date", default=date.today().isoformat())
    parser.add_argument("--discover-only", action="store_true")
    parser.add_argument("--profile-only", action="store_true")
    parser.add_argument("--skip-optimize", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(args.config)
    run_date = datetime.fromisoformat(args.run_date).date()
    runner = SqlRunner(config)

    # Discovery and profiling are intentionally read-only. Do not initialize
    # or write the audit/control Delta tables when either mode is used.
    if args.discover_only or args.profile_only:
        discovered = discover_unity_catalog_tables(runner, config)
        classified = classify_tables(discovered, config)
        write_tables = _write_tables(classified, config)
        if args.profile_only:
            profiles = profile_tables(runner, write_tables, config)
            print(
                f"Profiled {len(profiles)} eligible source tables; "
                f"{len(classified)} total in-scope tables were discovered"
            )
            return 0
        print(
            f"Discovered {len(discovered)} tables; "
            f"in-scope classified tables: {len(classified)}; "
            f"eligible write targets: {len(write_tables)}"
        )
        return 0

    controller = JobController(runner, config)
    audit = AuditLogger(runner, config)
    watermark = WatermarkManager(runner, config)
    batch = controller.new_batch(run_date)
    controller.start(batch)
    audit.start_run(batch["run_id"], batch["batch_id"], batch["run_date"])

    inserted = updated = failed = 0
    try:
        discovered = discover_unity_catalog_tables(runner, config)
        classified = classify_tables(discovered, config)

        write_tables = _write_tables(classified, config)
        profiles = profile_tables(runner, write_tables, config)

        if not write_tables:
            raise RuntimeError(
                "No eligible write tables were found. Check generation.write_schema_include_patterns "
                "and the discovered Unity Catalog schemas."
            )

        insert_targets = _insert_targets_by_domain(write_tables)
        generated_by_table = []
        update_history_table = metadata_table_name(config, "update_history_table")
        runner.sql(f"""
        CREATE TABLE IF NOT EXISTS {update_history_table} (
          run_id STRING, batch_id STRING, run_date STRING, domain_name STRING,
          dataset_name STRING, record_key STRING, update_reason STRING, updated_at STRING
        ) USING DELTA
        """)
        for table_index, table in enumerate(write_tables, start=1):
            print(
                f"[process {table_index}/{len(write_tables)}] {table.raw_name} "
                f"domain={table.domain} category={table.category} keys={table.primary_keys}"
            )
            profile = profiles[table.raw_name]
            domain_insert_count = int(config["domains"][table.domain].get("daily_insert_count", 0))
            insert_count = domain_insert_count if insert_targets.get(table.domain) == table.raw_name else 0
            try:
                insert_df, update_df = generate_domain_changes(
                    runner,
                    table,
                    profile,
                    run_date,
                    batch["run_id"],
                    config,
                    insert_count_override=insert_count,
                )
            except Exception as exc:
                raise RuntimeError(f"Change generation failed for {table.raw_name}: {exc}") from exc
            for change_type, df in (("insert", insert_df), ("update", update_df)):
                if _is_empty(df):
                    continue
                quality = validate_dataframe(df, table, batch["run_id"], batch["batch_id"])
                audit.log_quality(quality)
                assert_quality(quality, config)
                metrics = delta_merge(runner, table, df, table.primary_keys, schema_evolution=config.get("generation", {}).get("schema_evolution", True))
                if change_type == "update":
                    _record_update_history(runner, update_history_table, table, df, batch)
                inserted += metrics["records_inserted"]
                updated += metrics["records_updated"]
                generated_by_table.append((table, df))
                audit.log({
                    "run_id": batch["run_id"],
                    "batch_id": batch["batch_id"],
                    "pipeline_name": config["audit"]["pipeline_name"],
                    "domain_name": table.domain,
                    "dataset_name": table.raw_name,
                    "start_time": None,
                    "end_time": datetime.utcnow().isoformat(),
                    "records_read": metrics["records_read"],
                    "records_inserted": metrics["records_inserted"] if change_type == "insert" else 0,
                    "records_updated": metrics["records_updated"] if change_type == "update" else 0,
                    "records_rejected": 0,
                    "status": "SUCCEEDED",
                    "error_message": None,
                    "execution_duration": None,
                    "run_date": batch["run_date"],
                })
            if not args.skip_optimize:
                optimize_table(runner, table, table.primary_keys, config)
            watermark_column = table.watermark_columns[0] if table.watermark_columns else None
            watermark.update(config["audit"]["pipeline_name"], table.domain, table.raw_name, watermark_column, batch["run_date"], batch["batch_id"])

        refresh_identity_graph(runner, write_tables, generated_by_table, config)
        controller.finish(batch, "SUCCEEDED", inserted, updated, failed)
        return 0
    except Exception as exc:
        failed += 1
        controller.finish(batch, "FAILED", inserted, updated, failed)
        audit.log({
            "run_id": batch["run_id"],
            "batch_id": batch["batch_id"],
            "pipeline_name": config["audit"]["pipeline_name"],
            "domain_name": None,
            "dataset_name": None,
            "start_time": None,
            "end_time": datetime.utcnow().isoformat(),
            "records_read": 0,
            "records_inserted": inserted,
            "records_updated": updated,
            "records_rejected": failed,
            "status": "FAILED",
            "error_message": str(exc),
            "execution_duration": None,
            "run_date": batch["run_date"],
        })
        raise


def _is_empty(df) -> bool:
    if df is None:
        return True
    if hasattr(df, "isEmpty"):
        return bool(df.isEmpty())
    return len(df) == 0


def _insert_targets_by_domain(tables) -> dict[str, str]:
    targets = {}
    preference = {"master": 0, "transaction": 1, "metric": 2, "identity": 3, "relationship": 4, "reference": 5}
    for table in sorted(tables, key=lambda t: (t.domain or "", preference.get(t.category or "", 9), t.raw_name)):
        if table.category in {"master", "transaction"} and table.domain not in targets:
            targets[table.domain] = table.raw_name
    return targets


def _write_tables(tables, config: dict):
    patterns = (config.get("generation") or {}).get("write_schema_include_patterns") or []
    return [table for table in tables if matches_any(table.schema, patterns)]


def _record_update_history(runner, history_table: str, table, df, batch: dict[str, str]) -> None:
    if runner.spark is None or not table.primary_keys:
        return
    from pyspark.sql import functions as F

    history = df.select(
        F.lit(batch["run_id"]).alias("run_id"),
        F.lit(batch["batch_id"]).alias("batch_id"),
        F.lit(batch["run_date"]).alias("run_date"),
        F.lit(table.domain).alias("domain_name"),
        F.lit(table.raw_name).alias("dataset_name"),
        F.concat_ws("||", *[F.col(k).cast("string") for k in table.primary_keys]).alias("record_key"),
        F.lit(f"{table.domain}_{table.category}_business_update").alias("update_reason"),
        F.current_timestamp().cast("string").alias("updated_at"),
    )
    history.write.format("delta").mode("append").saveAsTable(history_table)


if __name__ == "__main__":
    raise SystemExit(main())

