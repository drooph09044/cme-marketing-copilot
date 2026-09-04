from __future__ import annotations


def refresh_identity_graph(runner, classified_tables, generated_by_table: list[tuple[object, object]], config: dict) -> dict[str, int]:
    identity_tables = [t for t in classified_tables if t.category in {"identity", "relationship"}]
    if not identity_tables:
        return {"identity_tables_found": 0, "identity_rows_created": 0}
    created = 0
    skipped = 0
    for table in identity_tables:
        if not table.primary_keys:
            skipped += 1
            print(f"[identity_graph] skipping {table.raw_name}: no primary keys discovered")
            continue
        source_frames = [df for source_table, df in generated_by_table if source_table.domain == table.domain and not _is_empty(df)]
        for frame in source_frames:
            rows = _identity_rows_for_table(runner, table, frame)
            if rows is not None and not _is_empty(rows):
                from generic_upsert_engine import delta_merge

                delta_merge(runner, table, rows, table.primary_keys, schema_evolution=config.get("generation", {}).get("schema_evolution", True))
                created += rows.count() if hasattr(rows, "count") else len(rows)
    return {"identity_tables_found": len(identity_tables), "identity_rows_created": created, "identity_tables_skipped": skipped}


def _identity_rows_for_table(runner, identity_table, generated_customer_df):
    target_cols = [c["column_name"] for c in identity_table.columns]
    source_cols = set(generated_customer_df.columns)
    select_exprs = []
    if runner.spark is None:
        return None
    from pyspark.sql import functions as F

    for col in target_cols:
        low = col.lower()
        if col in source_cols:
            select_exprs.append(F.col(col).alias(col))
        elif "node_type" in low or "identity_type" in low:
            select_exprs.append(F.lit("customer").alias(col))
        elif "created" in low or "updated" in low:
            select_exprs.append(F.current_timestamp().alias(col))
        elif low.endswith("_id") or low == "id":
            key_source = next((c for c in generated_customer_df.columns if c.lower().endswith("_id")), generated_customer_df.columns[0])
            select_exprs.append(F.sha2(F.concat_ws("||", F.lit(identity_table.raw_name), F.col(key_source).cast("string")), 256).alias(col))
        else:
            select_exprs.append(F.lit(None).alias(col))
    return generated_customer_df.select(*select_exprs)


def _is_empty(df) -> bool:
    if df is None:
        return True
    if hasattr(df, "isEmpty"):
        return bool(df.isEmpty())
    return len(df) == 0
 
