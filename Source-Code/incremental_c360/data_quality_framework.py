from __future__ import annotations

from datetime import datetime, timezone


def validate_dataframe(df, table, run_id: str, batch_id: str) -> list[dict]:
    results = []
    for rule_name, status, failed_count, message in [
        _key_null_check(df, table),
        _duplicate_key_check(df, table),
        _schema_check(df, table),
    ]:
        results.append({
            "run_id": run_id,
            "batch_id": batch_id,
            "domain_name": table.domain,
            "dataset_name": table.raw_name,
            "rule_name": rule_name,
            "status": status,
            "failed_count": int(failed_count),
            "message": message,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        })
    return results


def assert_quality(results: list[dict], config: dict) -> None:
    failing = [r for r in results if r["status"] == "FAIL"]
    if failing:
        names = ", ".join(f"{r['dataset_name']}:{r['rule_name']}" for r in failing)
        raise ValueError(f"Data quality validation failed: {names}")


def _key_null_check(df, table):
    if not table.primary_keys:
        return ("primary_key_present", "FAIL", 1, "No primary or candidate key discovered.")
    if hasattr(df, "filter"):
        from pyspark.sql import functions as F

        failed = df.filter(" OR ".join(f"`{k}` IS NULL" for k in table.primary_keys)).count()
    else:
        failed = int(df[table.primary_keys].isna().any(axis=1).sum())
    return ("primary_key_not_null", "PASS" if failed == 0 else "FAIL", failed, "Primary key columns must be populated.")


def _duplicate_key_check(df, table):
    if not table.primary_keys:
        return ("duplicate_key_check", "FAIL", 1, "No key available for duplicate check.")
    if hasattr(df, "groupBy"):
        from pyspark.sql import functions as F

        failed = df.groupBy(*table.primary_keys).count().filter(F.col("count") > 1).count()
    else:
        failed = int(df.duplicated(subset=table.primary_keys).sum())
    return ("duplicate_key_check", "PASS" if failed == 0 else "FAIL", failed, "Generated batch must not contain duplicate keys.")


def _schema_check(df, table):
    actual = set(df.columns)
    expected = {c["column_name"] for c in table.columns}
    missing = expected - actual
    return ("schema_compatibility", "PASS" if not missing else "FAIL", len(missing), "Missing columns: " + ", ".join(sorted(missing)))

