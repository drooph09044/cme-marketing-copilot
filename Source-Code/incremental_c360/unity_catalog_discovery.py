from __future__ import annotations

from collections import defaultdict
from typing import Any

from metadata_manager import TableMetadata, matches_any


def _rows(frame) -> list[dict[str, Any]]:
    if hasattr(frame, "collect"):
        return [row.asDict(recursive=True) for row in frame.collect()]
    return frame.to_dict("records")


def discover_unity_catalog_tables(runner, config: dict[str, Any]) -> list[TableMetadata]:
    dbx = config.get("databricks") or {}
    catalog_patterns = dbx.get("catalog_include_patterns") or ["*"]
    schema_patterns = dbx.get("schema_include_patterns") or ["*"]
    table_patterns = dbx.get("table_include_patterns") or ["*"]
    exclude_patterns = dbx.get("table_exclude_patterns") or []

    table_rows = _rows(runner.sql(
        """
        SELECT table_catalog, table_schema, table_name, table_type, comment
        FROM system.information_schema.tables
        WHERE table_type IN ('BASE TABLE', 'MANAGED', 'EXTERNAL')
        """
    ))
    selected = []
    for row in table_rows:
        catalog = row.get("table_catalog")
        schema = row.get("table_schema")
        table = row.get("table_name")
        full = f"{catalog}.{schema}.{table}"
        if not matches_any(catalog, catalog_patterns):
            continue
        if not matches_any(schema, schema_patterns):
            continue
        if not matches_any(table, table_patterns):
            continue
        if matches_any(full, exclude_patterns):
            continue
        selected.append(row)

    if not selected:
        return []

    keys = {(r["table_catalog"], r["table_schema"], r["table_name"]) for r in selected}
    columns_by_table = defaultdict(list)
    for row in _rows(runner.sql(
        """
        SELECT table_catalog, table_schema, table_name, column_name, ordinal_position,
               data_type, full_data_type, is_nullable, comment
        FROM system.information_schema.columns
        """
    )):
        key = (row.get("table_catalog"), row.get("table_schema"), row.get("table_name"))
        if key in keys:
            columns_by_table[key].append(row)

    pk_by_table = _discover_primary_keys(runner, keys)
    rel_by_table = _discover_relationships(runner, keys)

    metadata = []
    for row in selected:
        key = (row["table_catalog"], row["table_schema"], row["table_name"])
        columns = sorted(columns_by_table[key], key=lambda item: item.get("ordinal_position") or 0)
        column_names = [c["column_name"] for c in columns]
        primary_keys = pk_by_table.get(key) or infer_candidate_key(column_names)
        metadata.append(TableMetadata(
            catalog=row["table_catalog"],
            schema=row["table_schema"],
            table=row["table_name"],
            table_type=row.get("table_type") or "BASE TABLE",
            comment=row.get("comment"),
            columns=columns,
            primary_keys=primary_keys,
            candidate_keys=[primary_keys] if primary_keys else [],
            created_columns=[c for c in column_names if c.lower() in {"created_at", "created_ts", "create_date", "created_date", "ingest_ts"}],
            updated_columns=[c for c in column_names if c.lower() in {"updated_at", "updated_ts", "modified_at", "last_modified_date", "last_update_date"}],
            audit_columns=[c for c in column_names if any(token in c.lower() for token in ("audit", "run_id", "batch_id", "source_system"))],
            watermark_columns=[c for c in column_names if any(token in c.lower() for token in ("updated", "modified", "event_ts", "event_time", "ingest"))],
            relationships=rel_by_table.get(key, []),
        ))
    return metadata


def infer_candidate_key(column_names: list[str]) -> list[str]:
    lower = {c.lower(): c for c in column_names}
    for candidate in ("id", "record_id"):
        if candidate in lower:
            return [lower[candidate]]
    ids = [c for c in column_names if c.lower().endswith("_id")]
    # Multiple *_id columns do not imply a composite key. In many source
    # datasets the later IDs are nullable foreign keys (for example,
    # linked_fan_account_id), and generic customer_id is often a foreign key
    # on fact tables. Without a declared Unity Catalog constraint, use the
    # first ordinal record identifier as the candidate key.
    return ids[:1]


def _discover_primary_keys(runner, keys: set[tuple[str, str, str]]) -> dict[tuple[str, str, str], list[str]]:
    primary = defaultdict(list)
    try:
        rows = _rows(runner.sql(
            """
            SELECT k.table_catalog, k.table_schema, k.table_name, k.column_name, k.ordinal_position
            FROM system.information_schema.key_column_usage k
            JOIN system.information_schema.table_constraints c
              ON k.constraint_catalog = c.constraint_catalog
             AND k.constraint_schema = c.constraint_schema
             AND k.constraint_name = c.constraint_name
            WHERE c.constraint_type = 'PRIMARY KEY'
            """
        ))
    except Exception:
        return {}
    for row in sorted(rows, key=lambda r: r.get("ordinal_position") or 0):
        key = (row.get("table_catalog"), row.get("table_schema"), row.get("table_name"))
        if key in keys:
            primary[key].append(row.get("column_name"))
    return dict(primary)


def _discover_relationships(runner, keys: set[tuple[str, str, str]]) -> dict[tuple[str, str, str], list[dict[str, Any]]]:
    relationships = defaultdict(list)
    try:
        rows = _rows(runner.sql(
            """
            SELECT constraint_catalog, constraint_schema, constraint_name, table_catalog,
                   table_schema, table_name, column_name
            FROM system.information_schema.key_column_usage
            """
        ))
    except Exception:
        return {}
    for row in rows:
        key = (row.get("table_catalog"), row.get("table_schema"), row.get("table_name"))
        if key in keys:
            relationships[key].append(row)
    return dict(relationships)

