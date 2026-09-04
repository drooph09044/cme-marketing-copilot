from __future__ import annotations

from typing import Any


def profile_table(runner, table, config: dict) -> dict[str, Any]:
    df = runner.table(table.fqtn)
    max_rows = int(config.get("generation", {}).get("max_profile_rows_per_table", 100000))
    if hasattr(df, "limit"):
        sampled = df.limit(max_rows)
        row_count = df.count()
    else:
        sampled = df.head(max_rows)
        row_count = len(df)

    profiles = []
    for column in table.columns:
        name = column["column_name"]
        data_type = str(column.get("data_type") or column.get("full_data_type") or "").lower()
        profiles.append(_profile_column(sampled, name, data_type))

    return {
        "table": table.raw_name,
        "domain": table.domain,
        "category": table.category,
        "row_count": row_count,
        "keys": table.primary_keys,
        "columns": profiles,
    }


def profile_tables(runner, tables, config: dict) -> dict[str, dict[str, Any]]:
    profiles = {}
    total = len(tables)
    for index, table in enumerate(tables, start=1):
        print(f"[profile {index}/{total}] {table.raw_name}")
        try:
            profiles[table.raw_name] = profile_table(runner, table, config)
        except Exception as exc:
            raise RuntimeError(f"Profiling failed for {table.raw_name}: {exc}") from exc
    return profiles


def _profile_column(df, column: str, data_type: str) -> dict[str, Any]:
    if hasattr(df, "select"):
        from pyspark.sql import functions as F

        stats = df.select(
            F.count(F.lit(1)).alias("rows"),
            F.sum(F.when(F.col(column).isNull(), 1).otherwise(0)).alias("nulls"),
            F.approx_count_distinct(F.col(column)).alias("distinct_count"),
            F.min(F.col(column)).cast("string").alias("min_value"),
            F.max(F.col(column)).cast("string").alias("max_value"),
        ).collect()[0].asDict()
        top_values = [
            {"value": str(row[0]), "count": int(row[1])}
            for row in df.groupBy(column).count().orderBy(F.desc("count")).limit(10).collect()
        ]
    else:
        series = df[column] if column in df else []
        total = int(len(series))
        nulls = int(series.isna().sum()) if total else 0
        stats = {
            "rows": total,
            "nulls": nulls,
            "distinct_count": int(series.nunique(dropna=True)) if total else 0,
            "min_value": str(series.min()) if total and not series.dropna().empty else None,
            "max_value": str(series.max()) if total and not series.dropna().empty else None,
        }
        top_values = [{"value": str(k), "count": int(v)} for k, v in series.value_counts(dropna=True).head(10).items()]
    stats["data_type"] = data_type
    stats["top_values"] = top_values
    return {"column": column, **stats}

