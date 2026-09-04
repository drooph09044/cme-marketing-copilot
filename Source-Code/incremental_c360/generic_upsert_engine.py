from __future__ import annotations

from metadata_manager import quote_identifier

def _dedupe_merge_source(source_df, keys: list[str]):
    from pyspark.sql import functions as F
    from pyspark.sql.window import Window

    window = Window.partitionBy(*[F.col(key) for key in keys]).orderBy(F.col("_c360_change_hash").desc())
    return source_df.withColumn("_c360_merge_rank", F.row_number().over(window)).filter(F.col("_c360_merge_rank") == 1).drop("_c360_merge_rank")

def delta_merge(runner, table, source_df, keys: list[str], schema_evolution: bool = True) -> dict[str, int]:
    if not keys:
        raise ValueError(f"No merge keys discovered for {table.raw_name}. Configure primary/candidate keys before upsert.")
    if _is_empty(source_df):
        return {"records_read": 0, "records_inserted": 0, "records_updated": 0}

    if runner.spark is None:
        raise RuntimeError("Delta MERGE requires PySpark/Delta runtime. Use Databricks or local PySpark with Delta support.")

    from delta.tables import DeltaTable
    from pyspark.sql import functions as F

    spark = runner.spark
    if schema_evolution:
        spark.conf.set("spark.databricks.delta.schema.autoMerge.enabled", "true")
    source = source_df.withColumn("_c360_change_hash", F.sha2(F.to_json(F.struct(*[F.col(c) for c in source_df.columns])), 256))
    source = _dedupe_merge_source(source, keys)
    if not spark.catalog.tableExists(table.fqtn):
        source.write.format("delta").mode("append").saveAsTable(table.fqtn)
        count = source.count()
        return {"records_read": count, "records_inserted": count, "records_updated": 0}

    _ensure_hash_column(runner, table)
    target = DeltaTable.forName(spark, table.fqtn)
    condition = " AND ".join(f"target.{quote_identifier(k)} <=> source.{quote_identifier(k)}" for k in keys)
    update_cols = {c: f"source.{quote_identifier(c)}" for c in source.columns if c not in keys}
    (
        target.alias("target")
        .merge(source.alias("source"), condition)
        .whenMatchedUpdate(condition="target._c360_change_hash IS NULL OR target._c360_change_hash <> source._c360_change_hash", set=update_cols)
        .whenNotMatchedInsertAll()
        .execute()
    )
    metrics = _last_operation_metrics(runner, table)
    return {
        "records_read": source.count(),
        "records_inserted": int(metrics.get("numTargetRowsInserted", 0)),
        "records_updated": int(metrics.get("numTargetRowsUpdated", 0)),
    }


def _ensure_hash_column(runner, table) -> None:
    columns = [row.asDict().get("col_name") for row in runner.sql(f"DESCRIBE TABLE {table.fqtn}").collect()]
    if "_c360_change_hash" not in {str(c).lower() for c in columns if c}:
        runner.sql(f"ALTER TABLE {table.fqtn} ADD COLUMNS (_c360_change_hash STRING)")





def optimize_table(runner, table, keys: list[str], config: dict) -> None:
    if not config.get("optimization", {}).get("optimize_after_merge", True):
        return
    z_keys = ", ".join(quote_identifier(k) for k in keys[: int(config.get("optimization", {}).get("zorder_key_limit", 4))])
    runner.sql(f"OPTIMIZE {table.fqtn}" + (f" ZORDER BY ({z_keys})" if z_keys else ""))


def vacuum_table(runner, table, config: dict) -> None:
    hours = int(config.get("optimization", {}).get("vacuum_retention_hours", 168))
    runner.sql(f"VACUUM {table.fqtn} RETAIN {hours} HOURS")


def _last_operation_metrics(runner, table) -> dict[str, str]:
    rows = runner.sql(f"DESCRIBE HISTORY {table.fqtn} LIMIT 1")
    if hasattr(rows, "collect"):
        collected = rows.collect()
        return collected[0].asDict().get("operationMetrics") if collected else {}
    return rows.iloc[0].get("operationMetrics", {}) if len(rows) else {}


def _is_empty(df) -> bool:
    if df is None:
        return True
    if hasattr(df, "isEmpty"):
        return bool(df.isEmpty())
    return len(df) == 0

