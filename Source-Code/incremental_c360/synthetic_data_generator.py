from __future__ import annotations

import hashlib
import random
import uuid
from datetime import date, datetime
from typing import Any

from faker import Faker


fake = Faker()


def generate_domain_changes(runner, table, profile: dict[str, Any], run_date: date, run_id: str, config: dict, insert_count_override: int | None = None):
    domain_config = config["domains"][table.domain]
    insert_count = int(domain_config.get("daily_insert_count", 0) if insert_count_override is None else insert_count_override)
    update_percentage = float(domain_config.get("update_percentage", 0))
    seed = int(config.get("environment", {}).get("random_seed", 0)) + int(run_date.strftime("%Y%m%d"))
    random.seed(seed)
    fake.seed_instance(seed)

    base_df = runner.table(table.fqtn)
    generated_inserts = _build_inserts(runner, table, base_df, insert_count, run_date, run_id)
    updates = _build_updates(runner, table, base_df, update_percentage, run_date, run_id, config)
    return generated_inserts, updates


def _build_inserts(runner, table, base_df, count: int, run_date: date, run_id: str):
    if count <= 0 or table.category not in {"master", "transaction"}:
        return _empty_like(runner, base_df)
    eligible_base = _eligible_source_rows(base_df, table.primary_keys)
    if hasattr(eligible_base, "orderBy"):
        from pyspark.sql import functions as F

        template = eligible_base.orderBy(F.rand()).limit(count)
        rows = [row.asDict(recursive=True) for row in template.collect()]
    else:
        rows = eligible_base.sample(n=min(count, len(eligible_base)), replace=True).to_dict("records")
    generated = [_mutate_insert_row(row, table, run_date, run_id, i) for i, row in enumerate(rows)]
    while len(generated) < count and generated:
        generated.append(_mutate_insert_row(generated[-1].copy(), table, run_date, run_id, len(generated)))
    if not generated:
        return _empty_like(runner, base_df)
    return runner.create_dataframe(generated[:count], schema=getattr(base_df, "schema", None))


def _build_updates(runner, table, base_df, pct: float, run_date: date, run_id: str, config: dict):
    if pct <= 0 or table.category not in {"master", "transaction", "metric"}:
        return _empty_like(runner, base_df)
    key_expr = _key_expression(table.primary_keys)
    limit_fraction = max(0.0, min(1.0, pct / 100.0))
    eligible_base = _eligible_source_rows(base_df, table.primary_keys)
    if hasattr(eligible_base, "withColumn"):
        from pyspark.sql import functions as F

        ranked = eligible_base.withColumn(
            "_selection_hash",
            F.sha2(F.concat_ws("||", key_expr, F.lit(str(run_date)), F.lit(str(config.get("environment", {}).get("random_seed", 0)))), 256),
        )
        total = eligible_base.count()
        take = int(total * limit_fraction)
        if take <= 0:
            return _empty_like(runner, base_df)
        rows = [row.asDict(recursive=True) for row in ranked.orderBy("_selection_hash").limit(take).drop("_selection_hash").collect()]
    else:
        rows = eligible_base.to_dict("records")
        rows.sort(key=lambda row: hashlib.sha256((str(run_date) + repr([row.get(k) for k in table.primary_keys])).encode()).hexdigest())
        rows = rows[: int(len(rows) * limit_fraction)]
    updated = [_mutate_update_row(row, table.domain, run_date, run_id) for row in rows]
    if not updated:
        return _empty_like(runner, base_df)
    return runner.create_dataframe(updated, schema=getattr(base_df, "schema", None))


def _key_expression(keys: list[str]):
    from pyspark.sql import functions as F

    if not keys:
        return F.monotonically_increasing_id().cast("string")
    return F.concat_ws("||", *[F.col(k).cast("string") for k in keys])


def _eligible_source_rows(base_df, keys: list[str]):
    """Keep only rows with usable, unique keys for generated changes."""
    if not keys:
        return base_df
    if hasattr(base_df, "dropDuplicates"):
        from functools import reduce
        from operator import and_

        from pyspark.sql import functions as F

        non_null = reduce(and_, (F.col(key).isNotNull() for key in keys))
        return base_df.filter(non_null).dropDuplicates(keys)
    if hasattr(base_df, "dropna") and hasattr(base_df, "drop_duplicates"):
        return base_df.dropna(subset=keys).drop_duplicates(subset=keys)
    return base_df


def _empty_like(runner, base_df):
    """Return an empty frame without round-tripping an empty local collection."""
    if hasattr(base_df, "limit"):
        return base_df.limit(0)
    return runner.create_dataframe([], schema=getattr(base_df, "schema", None))


def _mutate_insert_row(row: dict[str, Any], table, run_date: date, run_id: str, offset: int) -> dict[str, Any]:
    for key in table.primary_keys:
        value = row.get(key)
        if value is None or isinstance(value, str):
            row[key] = f"GEN-{table.domain.upper()}-{run_date.strftime('%Y%m%d')}-{offset:08d}"
        elif isinstance(value, int):
            row[key] = abs(hash((table.raw_name, run_date, offset))) % 900000000000 + 100000000000
    row = _domain_mutations(row, table.domain, is_insert=True)
    _set_audit(row, run_date, run_id, is_insert=True)
    return row


def _mutate_update_row(row: dict[str, Any], domain: str, run_date: date, run_id: str) -> dict[str, Any]:
    row = _domain_mutations(row, domain, is_insert=False)
    _set_audit(row, run_date, run_id, is_insert=False)
    return row


def _domain_mutations(row: dict[str, Any], domain: str, is_insert: bool) -> dict[str, Any]:
    lower = {k.lower(): k for k in row.keys()}
    if domain == "media":
        _set_if_present(row, lower, ["subscription_status", "plan_type"], random.choice(["active", "trial", "premium", "bundle"]))
        _bump_numeric(row, lower, ["watch_minutes", "view_count", "engagement_score"], 1, 240)
        _set_if_present(row, lower, ["preferred_genre", "content_preference"], random.choice(["sports", "drama", "news", "comedy", "documentary"]))
        _set_if_present(row, lower, ["resolution", "stream_quality"], random.choice(["HD", "FHD", "4K"]))
    elif domain == "sports":
        _bump_numeric(row, lower, ["fan_score", "engagement_score", "fantasy_points"], 1, 75)
        _set_if_present(row, lower, ["favorite_team", "team"], random.choice(["Eagles", "Warriors", "Giants", "Rangers", "United"]))
        _set_if_present(row, lower, ["merch_segment", "ticket_intent"], random.choice(["high", "medium", "low"]))
    elif domain == "automotive":
        _bump_numeric(row, lower, ["odometer", "mileage", "service_score"], 10, 500)
        _set_if_present(row, lower, ["service_status", "maintenance_status"], random.choice(["scheduled", "due_soon", "completed"]))
        _set_if_present(row, lower, ["vehicle_usage_segment"], random.choice(["commuter", "family", "fleet", "premium"]))
    if is_insert:
        _set_identity_fields(row, lower)
    return row


def _set_identity_fields(row: dict[str, Any], lower: dict[str, str]) -> None:
    if "email" in lower:
        row[lower["email"]] = fake.email()
    if "phone" in lower:
        row[lower["phone"]] = fake.phone_number()
    if "device_id" in lower:
        row[lower["device_id"]] = str(uuid.uuid4())


def _set_if_present(row: dict[str, Any], lower: dict[str, str], names: list[str], value: Any) -> None:
    for name in names:
        if name in lower:
            row[lower[name]] = value


def _bump_numeric(row: dict[str, Any], lower: dict[str, str], names: list[str], low: int, high: int) -> None:
    for name in names:
        if name in lower:
            current = row.get(lower[name]) or 0
            try:
                row[lower[name]] = current + random.randint(low, high)
            except TypeError:
                row[lower[name]] = random.randint(low, high)


def _set_audit(row: dict[str, Any], run_date: date, run_id: str, is_insert: bool) -> None:
    event_timestamp = datetime.combine(run_date, datetime.min.time())
    for key in list(row.keys()):
        low = key.lower()
        if low in {"updated_at", "updated_ts", "modified_at", "last_modified_date", "last_update_date"}:
            row[key] = _audit_datetime_value(row.get(key), event_timestamp)
        if is_insert and low in {"created_at", "created_ts", "create_date", "created_date"}:
            row[key] = _audit_datetime_value(row.get(key), event_timestamp)
        if low == "run_id":
            row[key] = run_id
        if low == "batch_id":
            row[key] = f"{run_date:%Y%m%d}-{run_id[:8]}"


def _audit_datetime_value(existing_value: Any, event_timestamp: datetime) -> Any:
    """Keep audit values compatible with the source table's inferred Spark type."""
    if isinstance(existing_value, datetime):
        return event_timestamp
    if isinstance(existing_value, date):
        return event_timestamp.date()
    return event_timestamp.isoformat()

