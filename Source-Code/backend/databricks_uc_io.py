"""Databricks Apps data access helpers.

This module is intentionally small at the call sites: legacy routes can keep
their existing CSV/JSON parsing while this adapter resolves those artifacts to
Unity Catalog tables or UC Volume files.
"""

from __future__ import annotations
try:
    from databricks.sdk.service import sql as dbsql
except Exception:  # pragma: no cover - optional outside Databricks runtime
    dbsql = None

import builtins
import csv
import io
import json
import os
import re
import threading
import time
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Mapping

import pandas as pd

class DatabricksDataAccessError(RuntimeError):
    """Raised when a required UC table or Volume artifact cannot be resolved."""


def _is_missing_table_error(exc: Exception) -> bool:
    text = str(exc)
    return (
        "TABLE_OR_VIEW_NOT_FOUND" in text
        or "cannot be found" in text
        or "RESOURCE_DOES_NOT_EXIST" in text
        or "does not exist" in text.lower()
        or "SQLSTATE: 42P01" in text
    )


def _is_missing_volume_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return (
        "resource_does_not_exist" in text
        or "not found" in text
        or "does not exist" in text
        or "status code 404" in text
    )


def _load_databricks_compat_config() -> dict[str, Any]:
    try:
        import yaml

        config_path = Path(__file__).resolve().parent.parent / "config" / "databricks.yml"
        loaded = yaml.safe_load(config_path.read_text(encoding="utf-8"))
        section = loaded.get("databricks_compat", {}) if isinstance(loaded, dict) else {}
        return section if isinstance(section, dict) else {}
    except Exception:
        return {}


_DATABRICKS_COMPAT_CONFIG = _load_databricks_compat_config()


FALLBACK_SOURCE_PREFIXES = {
    "media": ("med",),
    "sports": ("spt",),
    "automotive": ("aut", "auto"),
    "telecom": ("tel",),
}
FALLBACK_SOURCE_PREFIXES = {
    key: tuple(value)
    for key, value in _DATABRICKS_COMPAT_CONFIG.get("source_prefixes", FALLBACK_SOURCE_PREFIXES).items()
}
FALLBACK_OUTPUT_LAYERS = tuple(_DATABRICKS_COMPAT_CONFIG.get("output_layers", ("std", "slv", "gld", "brz")))
JSON_SUFFIXES = set(_DATABRICKS_COMPAT_CONFIG.get("json_suffixes", [".json"]))
CSV_SUFFIXES = set(_DATABRICKS_COMPAT_CONFIG.get("csv_suffixes", ["", ".csv"]))
FALLBACK_DATA_DIRECTORIES = set(_DATABRICKS_COMPAT_CONFIG.get("data_directories", [
    "generated_data",
    "preprocessed_data",
    "standardized_data",
    "matching_output",
    "clustering_output",
    "evaluation_output",
    "golden_records_output",
    "consent_data",
    "segmentation",
    "Segmentation".lower(),
]))
FALLBACK_DATA_DIRECTORIES.add("Segmentation".lower())
FALLBACK_KNOWN_DATA_FILES = set(_DATABRICKS_COMPAT_CONFIG.get("known_data_files", [
    "general_data",
    "golden_records",
    "candidate_pairs",
    "clustered_records",
    "all_standardized",
    "all_preprocessed",
    "customer_profile_export",
    "superseded_ids",
    "household_links",
    "activity_detail_fields",
    "blocking_config.json",
    "tag_mappings.json",
    "source_preferences.json",
    "data_source_classification.json",
    "golden_record_provenance.json",
    "evaluation_report.json",
    "cluster_summary.json",
    "golden_record_summary.json",
    "household_summary.json",
    "ground_truth.json",
    "copilot_segments.json",
]))


def _load_runtime_config() -> dict | None:
    try:
        from config_loader import load_config

        return load_config()
    except Exception:
        return None


def _configured_source_prefixes(config: dict | None) -> dict[str, tuple[str, ...]]:
    if not config:
        return FALLBACK_SOURCE_PREFIXES

    sources = config.get("sources", {}).get("supported", {})
    configured = {}
    for source_name, source_config in sources.items():
        prefixes = source_config.get("prefixes", ())
        if prefixes:
            configured[source_name] = tuple(prefixes)

    return configured or FALLBACK_SOURCE_PREFIXES


def _configured_output_layers(config: dict | None) -> tuple[str, ...]:
    if not config:
        return FALLBACK_OUTPUT_LAYERS

    layers = config.get("table_resolution", {}).get("output_layers", ())
    return tuple(layers) or FALLBACK_OUTPUT_LAYERS


def _configured_data_directories(config: dict | None) -> set[str]:
    directories = set(FALLBACK_DATA_DIRECTORIES)
    if not config:
        return directories

    configured = config.get("table_resolution", {}).get("virtual_data_directories", ())
    directories.update(str(directory).lower() for directory in configured)
    return directories


def _add_dataset_name(target: set[str], value: object) -> None:
    if isinstance(value, str) and value:
        target.add(value)


def _add_dataset_entry_names(target: set[str], key: str, entry: object) -> None:
    _add_dataset_name(target, key)
    if not isinstance(entry, dict):
        return

    _add_dataset_name(target, entry.get("table"))
    for alias in entry.get("aliases", ()):
        _add_dataset_name(target, alias)


def _add_volume_artifact_names(target: set[str], artifact: object) -> None:
    if isinstance(artifact, str):
        _add_dataset_name(target, Path(artifact).name)
        return

    if not isinstance(artifact, dict):
        return

    pattern = artifact.get("pattern") or artifact.get("path")
    if pattern:
        _add_dataset_name(target, Path(str(pattern)).name)
    _add_dataset_name(target, artifact.get("file"))


def _add_volume_artifact_relative_paths(target: set[str], artifact: object) -> None:
    values: list[object] = []
    if isinstance(artifact, str):
        values.append(artifact)
    elif isinstance(artifact, dict):
        values.extend([artifact.get("pattern"), artifact.get("path"), artifact.get("file")])

    for value in values:
        if not isinstance(value, str) or not value:
            continue
        if any(token in value for token in ("*", "{", "}")):
            continue
        target.add(value.replace("\\", "/").lstrip("/"))


def _iter_volume_artifacts(value: object):
    if isinstance(value, list):
        for item in value:
            yield from _iter_volume_artifacts(item)
    elif isinstance(value, dict):
        if any(key in value for key in ("pattern", "path", "file")):
            yield value
        else:
            for item in value.values():
                yield from _iter_volume_artifacts(item)
    elif isinstance(value, str):
        yield value


def _configured_known_data_files(config: dict | None) -> set[str]:
    known = set(FALLBACK_KNOWN_DATA_FILES)
    if not config:
        return known

    datasets = config.get("datasets", {})
    sources = config.get("sources", {}).get("supported", {})

    source_tables = datasets.get("marketing_sources", {}).get("tables", {})
    for key, entry in source_tables.items():
        if isinstance(entry, dict) and "tables" in entry:
            _add_dataset_name(known, key)
            for table_key, table_entry in entry.get("tables", {}).items():
                _add_dataset_entry_names(known, table_key, table_entry)
        elif isinstance(entry, dict) and "table" not in entry:
            _add_dataset_name(known, key)
            for table_key, table_entry in entry.items():
                _add_dataset_entry_names(known, table_key, table_entry)
        else:
            _add_dataset_entry_names(known, key, entry)

    cdp_datasets = datasets.get("marketing_cdp", {})
    for key, entry in cdp_datasets.get("source_scoped_tables", {}).items():
        _add_dataset_name(known, key)
        if isinstance(entry, dict):
            pattern = entry.get("table_pattern")
            if pattern:
                for source_name, source_config in sources.items():
                    prefixes = source_config.get("prefixes", ()) if isinstance(source_config, dict) else ()
                    prefix = prefixes[0] if prefixes else source_name
                    _add_dataset_name(known, pattern.format(source=source_name, prefix=prefix))
            for alias in entry.get("aliases", ()):
                _add_dataset_name(known, alias)

    for key, entry in cdp_datasets.get("generated_tables", {}).items():
        _add_dataset_entry_names(known, key, entry)

    for schema_name in ("marketing_copilot", "marketing_audit"):
        for key, entry in datasets.get(schema_name, {}).get("tables", {}).items():
            _add_dataset_entry_names(known, key, entry)

    for artifact in _iter_volume_artifacts(config.get("artifacts", {})):
        _add_volume_artifact_names(known, artifact)
    for section in ("events", "ajo"):
        for artifact in config.get(section, {}).values():
            if isinstance(artifact, list):
                for item in artifact:
                    _add_volume_artifact_names(known, item)
            else:
                _add_volume_artifact_names(known, artifact)

    return known


def _configured_volume_artifact_relative_paths(config: dict | None) -> set[str]:
    paths: set[str] = set()
    if not config:
        return paths

    for artifact in _iter_volume_artifacts(config.get("artifacts", {})):
        _add_volume_artifact_relative_paths(paths, artifact)

    return paths


_RUNTIME_CONFIG = _load_runtime_config()
SOURCE_PREFIXES = _configured_source_prefixes(_RUNTIME_CONFIG)
OUTPUT_LAYERS = _configured_output_layers(_RUNTIME_CONFIG)
DATA_DIRECTORIES = _configured_data_directories(_RUNTIME_CONFIG)
KNOWN_DATA_FILES = _configured_known_data_files(_RUNTIME_CONFIG)
VOLUME_ARTIFACT_RELATIVE_PATHS = _configured_volume_artifact_relative_paths(_RUNTIME_CONFIG)

SOURCE_SCOPED_CDP_TABLE_PATTERNS = {
    "all_preprocessed": "std_{prefix}_all_preprocessed",
    "all_standardized": "std_{prefix}_all_standardized",
    "enhanced_prepared_records": "std_{prefix}_enhanced_prepared_records",
    "candidate_pairs": "std_{prefix}_candidate_pairs",
    "clustered_records": "slv_{prefix}_clustered_records",
    "golden_records": "slv_{prefix}_golden_records",
    "superseded_ids": "slv_{prefix}_superseded_ids",
    "customer_profile_export": "slv_{prefix}_customer_profile_export",
    "household_links": "slv_{prefix}_household_links",
}

_ORIGINAL_OPEN = builtins.open
_ORIGINAL_EXISTS = Path.exists
_ORIGINAL_READ_TEXT = Path.read_text
_ORIGINAL_WRITE_TEXT = Path.write_text
_ORIGINAL_UNLINK = Path.unlink
_ORIGINAL_MKDIR = Path.mkdir
_ORIGINAL_GLOB = Path.glob
_ORIGINAL_RGLOB = Path.rglob
_ORIGINAL_ITERDIR = Path.iterdir
_ORIGINAL_IS_FILE = Path.is_file
_ORIGINAL_PANDAS_READ_CSV = pd.read_csv
_INSTALLED = False
_ROOTS: tuple[Path, ...] = ()
_APP_ROOT: Path | None = None
try:
    _SQL_MAX_CONCURRENCY = max(1, int(os.getenv("CODEX_SQL_MAX_CONCURRENCY", "4")))
except ValueError:
    _SQL_MAX_CONCURRENCY = 4
_SQL_EXECUTION_SEMAPHORE = threading.BoundedSemaphore(_SQL_MAX_CONCURRENCY)


@dataclass(frozen=True)
class TableRef:
    catalog: str
    schema: str
    name: str

    @property
    def fqdn(self) -> str:
        return ".".join(_quote_identifier(part) for part in (self.catalog, self.schema, self.name))


def uc_enabled() -> bool:
    return os.getenv("CODEX_DATA_SOURCE", "uc").strip().lower() == "uc"


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def _truthy_env_or_config(value: object) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _allow_broad_table_discovery() -> bool:
    raw = _env("CODEX_ALLOW_UC_TABLE_DISCOVERY").strip()
    if raw:
        return _truthy_env_or_config(raw)
    configured = (_RUNTIME_CONFIG or {}).get("databricks", {}).get("allow_table_discovery")
    return _truthy_env_or_config(configured)


def _catalog() -> str:
    value = _env("DATABRICKS_CATALOG").strip()
    if value:
        return value
    value = str((_RUNTIME_CONFIG or {}).get("databricks", {}).get("catalog", "")).strip()
    if not value:
        raise DatabricksDataAccessError("DATABRICKS_CATALOG or databricks.catalog is required when CODEX_DATA_SOURCE=uc.")
    return value


def _schemas() -> list[str]:
    raw = _env("DATABRICKS_TABLE_SCHEMAS").strip()
    schemas = [item.strip() for item in raw.split(",") if item.strip()]
    if schemas:
        return schemas
    configured = (_RUNTIME_CONFIG or {}).get("databricks", {}).get("schemas", {})
    if isinstance(configured, dict):
        schemas = [str(value).strip() for value in configured.values() if str(value).strip()]
    if not schemas:
        raise DatabricksDataAccessError("DATABRICKS_TABLE_SCHEMAS or databricks.schemas is required when CODEX_DATA_SOURCE=uc.")
    return schemas


def _schema_for(kind: str, fallback: str) -> str:
    configured = (_RUNTIME_CONFIG or {}).get("databricks", {}).get("schemas", {})
    if isinstance(configured, dict):
        value = str(configured.get(kind, "")).strip()
        if value:
            return value
    return fallback


def configured_warehouse_id() -> str:
    """Resolve the SQL warehouse from the environment or Databricks App config."""
    value = _env("DATABRICKS_WAREHOUSE_ID").strip()
    if value:
        return value

    runtime_path = str(Path(__file__).resolve()).replace("\\", "/")
    running_in_databricks = runtime_path.startswith("/app/python/source_code/") or any(
        _env(name).strip()
        for name in (
            "DATABRICKS_APP_PORT",
            "DATABRICKS_CLIENT_ID",
            "DATABRICKS_HOST",
            "DATABRICKS_RUNTIME_VERSION",
        )
    )
    if running_in_databricks:
        configured = (_RUNTIME_CONFIG or {}).get("databricks", {}).get("warehouse", {})
        if isinstance(configured, dict):
            value = str(configured.get("id") or "").strip()
    return value


def _warehouse_id() -> str:
    value = configured_warehouse_id()
    if not value:
        raise DatabricksDataAccessError(
            "No Databricks SQL warehouse is configured. Set DATABRICKS_WAREHOUSE_ID "
            "or configure databricks.warehouse.id for the Databricks App runtime."
        )
    return value


def _volume_dirs() -> list[str]:
    raw = _env("DATABRICKS_VOLUME_DIRS").strip()
    dirs = [item.rstrip("/") for item in raw.split(",") if item.strip()]
    if dirs:
        return dirs
    configured = (_RUNTIME_CONFIG or {}).get("databricks", {}).get("volumes", {})
    if isinstance(configured, dict):
        root = str(configured.get("root", "")).strip().rstrip("/")
        if root:
            dirs = [root]
    if not dirs:
        raise DatabricksDataAccessError("DATABRICKS_VOLUME_DIRS or databricks.volumes.root is required.")
    return dirs


def _output_volume_dir() -> str:
    value = _env("DATABRICKS_OUTPUT_VOLUME_DIR").strip().rstrip("/")
    if value:
        return value
    configured = (_RUNTIME_CONFIG or {}).get("databricks", {}).get("volumes", {})
    if isinstance(configured, dict):
        value = str(configured.get("output_root", "")).strip().rstrip("/")
        if value:
            return value
    dirs = _volume_dirs()
    return dirs[0]


PIPELINE_FULL_READ_DATASETS = {
    "all_preprocessed",
    "all_standardized",
    "enhanced_prepared_records",
    "candidate_pairs",
    "clustered_records",
    "golden_records",
    "superseded_ids",
    "household_links",
}
PIPELINE_FULL_READ_DIRECTORIES = {
    "preprocessed_data",
    "standardized_data",
    "matching_output",
    "clustering_output",
    "golden_records_output",
}


def _is_pipeline_full_read(path_or_name: object) -> bool:
    path = Path(str(path_or_name).replace("\\", "/"))
    parts = {part.lower() for part in path.parts}
    name = path.name.rsplit(".", 1)[0].lower()
    return name in PIPELINE_FULL_READ_DATASETS and bool(parts & PIPELINE_FULL_READ_DIRECTORIES)


def _pipeline_context_enabled() -> bool:
    """Return whether the current process is an identity batch worker."""
    return _truthy_env_or_config(_env("CODEX_IDENTITY_PIPELINE_CONTEXT"))


def _max_rows(path_or_name: object | None = None) -> int:
    pipeline_context = _pipeline_context_enabled()
    use_pipeline_limit = pipeline_context or (
        path_or_name is not None and _is_pipeline_full_read(path_or_name)
    )
    if use_pipeline_limit:
        raw = os.getenv("CODEX_PIPELINE_TABLE_READ_ROW_LIMIT", "1000000")
    else:
        raw = os.getenv("CODEX_TABLE_READ_ROW_LIMIT", "100000")
    try:
        return max(1, int(raw))
    except ValueError:
        return 1000000 if use_pipeline_limit else 100000


@lru_cache(maxsize=1)
def _workspace_client():
    try:
        from databricks.sdk import WorkspaceClient
    except Exception as exc:  # pragma: no cover - depends on deployment env
        raise DatabricksDataAccessError(
            "databricks-sdk is required for UC/Volume access. Install backend requirements."
        ) from exc
    return WorkspaceClient()


def _quote_identifier(value: str) -> str:
    escaped = value.replace("`", "``")
    return f"`{escaped}`"


def _sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"

def _statement_state_name(status) -> str:
    state = getattr(status, "state", "")
    value = getattr(state, "value", state)
    return str(value or "").rsplit(".", 1)[-1].upper()

def _statement_cache_bucket() -> int:
    try:
        ttl = int(os.getenv("CODEX_UC_SQL_CACHE_SECONDS", "300"))
    except ValueError:
        ttl = 300
    if ttl <= 0:
        return int(time.time() * 1000)
    return int(time.time() // ttl)


def _statement_rows(statement: str) -> tuple[list[str], list[list[object]]]:
    return _statement_rows_cached(statement, _statement_cache_bucket())


def _metadata_count_timeout_seconds() -> int:
    try:
        return max(1, int(os.getenv("CODEX_UC_METADATA_COUNT_TIMEOUT_SECONDS", "3")))
    except ValueError:
        return 3


def _metadata_batch_timeout_seconds() -> int:
    try:
        return max(1, int(os.getenv("CODEX_UC_METADATA_BATCH_TIMEOUT_SECONDS", "10")))
    except ValueError:
        return 10


def _cancel_statement_best_effort(client: object, statement_id: str | None) -> None:
    if not statement_id:
        return
    try:
        client.statement_execution.cancel_execution(statement_id=statement_id)
    except Exception:
        pass


def _statement_rows_with_timeout(statement: str, timeout: int) -> tuple[list[str], list[list[object]]]:
    return _statement_rows_timeout_cached(statement, _statement_cache_bucket(), max(1, int(timeout)))


@contextmanager
def _sql_execution_slot():
    """Bound concurrent warehouse statements without disabling API parallelism."""
    _SQL_EXECUTION_SEMAPHORE.acquire()
    try:
        yield
    finally:
        _SQL_EXECUTION_SEMAPHORE.release()


def clear_uc_metadata_caches() -> None:
    """Clear only lightweight metadata caches after an explicit source refresh."""
    _statement_rows_timeout_cached.cache_clear()
    _workspace_table_columns.cache_clear()
    table_columns.cache_clear()


def clear_uc_read_caches() -> None:
    """Invalidate app-process UC reads after a pipeline subprocess publishes data.

    Pipeline writers execute in child processes, so clearing their local
    functools caches does not invalidate the long-lived Flask worker. This
    public hook prevents a successful Save & Run from serving the previous
    page or row count until the normal SQL cache bucket expires.
    """
    _statement_rows_cached.cache_clear()
    clear_uc_metadata_caches()
    # JSON summaries and other compatibility artifacts are downloaded through
    # the Volume cache.  Pipeline workers run in a child process, so the Flask
    # worker must explicitly discard those bytes after Save & Run as well.
    _volume_download_cached.cache_clear()


def _execute_statement(statement: str, timeout: int | None = None) -> None:
    timeout = max(
        1,
        int(timeout if timeout is not None else os.getenv("CODEX_SQL_TIMEOUT_SECONDS", "120")),
    )
    with _sql_execution_slot():
        client = _workspace_client()
        response = client.statement_execution.execute_statement(
            warehouse_id=_warehouse_id(),
            statement=statement,
            wait_timeout="0s",
            disposition=dbsql.Disposition.INLINE if dbsql else None,
        )
        statement_id = getattr(response, "statement_id", None)
        status = getattr(response, "status", None)
        state = _statement_state_name(status)
        deadline = time.time() + timeout
        while statement_id and state in {"PENDING", "RUNNING"}:
            if time.time() >= deadline:
                _cancel_statement_best_effort(client, statement_id)
                raise DatabricksDataAccessError(
                    f"Databricks SQL statement timed out after {timeout} seconds. "
                    f"Statement ID: {statement_id}"
                )
            time.sleep(1)
            response = client.statement_execution.get_statement(statement_id=statement_id)
            status = getattr(response, "status", None)
            state = _statement_state_name(status)

        if state != "SUCCEEDED":
            error = getattr(status, "error", None)
            raise DatabricksDataAccessError(f"Databricks SQL statement failed: {error or state}")


def _response_columns(response: object) -> list[str]:
    manifest = getattr(response, "manifest", None)
    schema = getattr(manifest, "schema", None)
    columns_meta = getattr(schema, "columns", None) or []
    return [str(getattr(col, "name", None) or col.get("name")) for col in columns_meta]


def _object_value(obj: object, name: str, default=None):
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _statement_wait_for_success(client: object, response: object, timeout: int) -> object:
    statement_id = getattr(response, "statement_id", None)
    status = getattr(response, "status", None)
    state = _statement_state_name(status)
    deadline = time.time() + timeout
    while statement_id and state in {"PENDING", "RUNNING"}:
        if time.time() >= deadline:
            _cancel_statement_best_effort(client, statement_id)
            raise DatabricksDataAccessError(
                f"Databricks SQL statement timed out after {timeout} seconds. "
                f"Statement ID: {statement_id}"
            )
        time.sleep(1)
        response = client.statement_execution.get_statement(statement_id=statement_id)
        status = getattr(response, "status", None)
        state = _statement_state_name(status)

    if state != "SUCCEEDED":
        error = getattr(status, "error", None)
        raise DatabricksDataAccessError(f"Databricks SQL statement failed: {error or state}")
    return response


def _external_link_url(link: object) -> str | None:
    if isinstance(link, dict):
        return str(link.get("external_link") or link.get("url") or "") or None
    return (
        getattr(link, "external_link", None)
        or getattr(link, "url", None)
        or None
    )


def _result_rows(result: object | None) -> list[list[object]]:
    if result is None:
        return []
    result = _object_value(result, "result", None) or result
    data = _object_value(result, "data_array", None)
    if data is not None:
        return list(data)

    rows: list[list[object]] = []
    for link in _object_value(result, "external_links", None) or []:
        url = _external_link_url(link)
        if not url:
            continue
        with urllib.request.urlopen(url, timeout=max(30, int(os.getenv("CODEX_SQL_TIMEOUT_SECONDS", "120")))) as response:
            payload = response.read().decode("utf-8")
        if payload.strip():
            rows.extend(json.loads(payload))
    return rows


def _statement_rows_external(statement: str) -> tuple[list[str], list[list[object]]]:
    if dbsql is None:
        raise DatabricksDataAccessError("databricks-sdk SQL service enums are unavailable.")

    with _sql_execution_slot():
        client = _workspace_client()
        timeout = max(1, int(os.getenv("CODEX_SQL_TIMEOUT_SECONDS", "120")))
        response = client.statement_execution.execute_statement(
            warehouse_id=_warehouse_id(),
            statement=statement,
            wait_timeout="0s",
            disposition=dbsql.Disposition.EXTERNAL_LINKS,
            format=dbsql.Format.JSON_ARRAY,
        )
        response = _statement_wait_for_success(client, response, timeout)
        statement_id = getattr(response, "statement_id", None)
        columns = _response_columns(response)

        rows: list[list[object]] = []
        manifest = getattr(response, "manifest", None)
        total_chunk_count = _object_value(manifest, "total_chunk_count", None)
        if total_chunk_count:
            if not statement_id:
                raise DatabricksDataAccessError("Missing statement_id while fetching external result chunks.")
            for chunk_index in range(int(total_chunk_count)):
                result = (
                    getattr(response, "result", None)
                    if chunk_index == 0
                    else client.statement_execution.get_statement_result_chunk_n(
                        statement_id=statement_id,
                        chunk_index=chunk_index,
                    )
                )
                rows.extend(_result_rows(result))
        else:
            result = getattr(response, "result", None)
            while result is not None:
                rows.extend(_result_rows(result))
                result_payload = _object_value(result, "result", None) or result
                next_chunk_index = _object_value(result_payload, "next_chunk_index", None)
                if next_chunk_index is None:
                    break
                if not statement_id:
                    raise DatabricksDataAccessError("Missing statement_id while fetching external result chunks.")
                result = client.statement_execution.get_statement_result_chunk_n(
                    statement_id=statement_id,
                    chunk_index=int(next_chunk_index),
                )
        return columns, rows


def _inline_page_size() -> int:
    try:
        return max(100, int(os.getenv("CODEX_UC_INLINE_PAGE_SIZE", "5000")))
    except ValueError:
        return 5000


def _read_table_rows_paged_inline(
    fqdn: str,
    max_rows: int,
    projection: str = "*",
) -> tuple[list[str], list[list[object]]]:
    columns: list[str] = []
    rows: list[list[object]] = []
    offset = 0
    page_size = min(_inline_page_size(), max_rows)
    while offset < max_rows:
        limit = min(page_size, max_rows - offset)
        try:
            page_columns, page_rows = _statement_rows(
                f"SELECT {projection} FROM {fqdn} LIMIT {limit} OFFSET {offset}"
            )
        except DatabricksDataAccessError as exc:
            if "Inline byte limit exceeded" not in str(exc) or page_size <= 100:
                raise
            page_size = max(100, page_size // 2)
            continue

        if not columns:
            columns = page_columns
        rows.extend(page_rows)
        if len(page_rows) < limit:
            break
        offset += len(page_rows)
    return columns, rows


def _read_table_rows_large(
    fqdn: str,
    max_rows: int,
    projection: str = "*",
) -> tuple[list[str], list[list[object]]]:
    statement = f"SELECT {projection} FROM {fqdn} LIMIT {max_rows}"
    try:
        return _statement_rows_external(statement)
    except Exception as exc:
        print("[UC] external result fetch failed; falling back to inline paging:", exc)
        return _read_table_rows_paged_inline(fqdn, max_rows, projection=projection)


@lru_cache(maxsize=512)
def _statement_rows_cached(statement: str, _cache_bucket: int) -> tuple[list[str], list[list[object]]]:
    with _sql_execution_slot():
        client = _workspace_client()
        timeout = max(1, int(os.getenv("CODEX_SQL_TIMEOUT_SECONDS", "120")))
        response = client.statement_execution.execute_statement(
            warehouse_id=_warehouse_id(),
            statement=statement,
            wait_timeout="0s",
            disposition=dbsql.Disposition.INLINE if dbsql else None,
        )
        response = _statement_wait_for_success(client, response, timeout)

        manifest = getattr(response, "manifest", None)
        schema = getattr(manifest, "schema", None)
        columns_meta = getattr(schema, "columns", None) or []
        columns = [getattr(col, "name", None) or col.get("name") for col in columns_meta]

        result = getattr(response, "result", None)
        data = getattr(result, "data_array", None) if result else None
        rows = data or []
        return [str(col) for col in columns], rows


def _statement_rows_uncached(statement: str, timeout: int | None = None) -> tuple[list[str], list[list[object]]]:
    """Execute a small SELECT without the reporting cache.

    Authentication state changes on every login and logout.  Reusing the
    reporting cache for those reads could accept a stale session for several
    minutes, so the explicit existing-table API below uses this fresh path.
    """
    with _sql_execution_slot():
        client = _workspace_client()
        resolved_timeout = max(
            1,
            int(timeout if timeout is not None else os.getenv("CODEX_SQL_TIMEOUT_SECONDS", "120")),
        )
        response = client.statement_execution.execute_statement(
            warehouse_id=_warehouse_id(),
            statement=statement,
            wait_timeout="0s",
            disposition=dbsql.Disposition.INLINE if dbsql else None,
        )
        response = _statement_wait_for_success(client, response, resolved_timeout)

        manifest = getattr(response, "manifest", None)
        schema = getattr(manifest, "schema", None)
        columns_meta = getattr(schema, "columns", None) or []
        columns = [getattr(col, "name", None) or col.get("name") for col in columns_meta]

        result = getattr(response, "result", None)
        data = getattr(result, "data_array", None) if result else None
        rows = data or []
        return [str(col) for col in columns], rows


@lru_cache(maxsize=512)
def _statement_rows_timeout_cached(statement: str, _cache_bucket: int, timeout: int) -> tuple[list[str], list[list[object]]]:
    with _sql_execution_slot():
        client = _workspace_client()
        response = client.statement_execution.execute_statement(
            warehouse_id=_warehouse_id(),
            statement=statement,
            wait_timeout="0s",
            disposition=dbsql.Disposition.INLINE if dbsql else None,
        )
        response = _statement_wait_for_success(client, response, max(1, int(timeout)))

        manifest = getattr(response, "manifest", None)
        schema = getattr(manifest, "schema", None)
        columns_meta = getattr(schema, "columns", None) or []
        columns = [getattr(col, "name", None) or col.get("name") for col in columns_meta]

        result = getattr(response, "result", None)
        data = getattr(result, "data_array", None) if result else None
        rows = data or []
        return [str(col) for col in columns], rows


@lru_cache(maxsize=1)
def discover_tables() -> tuple[TableRef, ...]:
    if not _allow_broad_table_discovery():
        return tuple()
    tables: list[TableRef] = []
    catalog = _catalog()
    for schema in _schemas():
        try:
            columns, rows = _statement_rows(f"SHOW TABLES IN {_quote_identifier(catalog)}.{_quote_identifier(schema)}")
        except Exception as exc:
            print("[UC] discover_tables failed:", exc)
            continue
        lower_columns = [col.lower() for col in columns]
        name_idx = lower_columns.index("tablename") if "tablename" in lower_columns else len(columns) - 1
        for row in rows:
            if len(row) > name_idx and row[name_idx]:
                tables.append(TableRef(catalog=catalog, schema=schema, name=str(row[name_idx])))
    return tuple(tables)


def _normalize_name(value: str) -> str:
    name = Path(str(value).replace("\\", "/")).name
    stem = name.rsplit(".", 1)[0]
    return re.sub(r"[^a-z0-9]+", "_", stem.lower()).strip("_")


def _infer_source(path_or_name: str, explicit_source: str | None = None) -> str | None:
    if explicit_source:
        normalized = explicit_source.strip().lower()
        return "automotive" if normalized == "automotice" else normalized
    text = str(path_or_name).replace("\\", "/").lower()
    for source, prefixes in SOURCE_PREFIXES.items():
        if f"/{source}/" in text or source in text.split("/"):
            return source
        stem = _normalize_name(text)
        if any(stem.startswith(prefix + "_") for prefix in prefixes):
            return source
    return None


def _candidate_names(path_or_name: str, source: str | None = None) -> list[str]:
    stem = _normalize_name(path_or_name)
    names = {stem}
    source = _infer_source(path_or_name, source)
    prefixes = SOURCE_PREFIXES.get(source or "", ())
    for prefix in prefixes:
        if not stem.startswith(prefix + "_"):
            names.add(f"{prefix}_{stem}")
        for layer in OUTPUT_LAYERS:
            names.add(f"{layer}_{prefix}_{stem}")
            names.add(f"{prefix}_{layer}_{stem}")
    if source:
        source_token = "automotive" if source == "automotice" else source
        if not stem.startswith(source_token + "_"):
            names.add(f"{source_token}_{stem}")
        for layer in OUTPUT_LAYERS:
            names.add(f"{layer}_{source_token}_{stem}")
            names.add(f"{source_token}_{layer}_{stem}")
    for layer in OUTPUT_LAYERS:
        if not stem.startswith(layer + "_"):
            names.add(f"{layer}_{stem}")
    return sorted(names)


def _registry_dataset_ref(path_or_name: str, source: str | None = None):
    try:
        from data_registry import get_registry

        return get_registry(_RUNTIME_CONFIG).get(path_or_name, source=source, required=False)
    except Exception:
        return None


def _direct_source_scoped_cdp_ref(path_or_name: str, source: str | None = None) -> TableRef | None:
    dataset_name = _normalize_name(path_or_name)
    table_pattern = SOURCE_SCOPED_CDP_TABLE_PATTERNS.get(dataset_name)
    if not table_pattern:
        return None

    inferred_source = _infer_source(path_or_name, source)
    if not inferred_source:
        return None

    prefixes = SOURCE_PREFIXES.get(inferred_source, ())
    prefix = prefixes[0] if prefixes else inferred_source
    return TableRef(
        catalog=_catalog(),
        schema=_schema_for("cdp", ""),
        name=table_pattern.format(source=inferred_source, prefix=prefix),
    )


def _derived_cdp_ref(path_or_name: str, source: str | None = None) -> TableRef | None:
    path = Path(str(path_or_name).replace("\\", "/"))
    parts = {part.lower() for part in path.parts}
    stem = _normalize_name(path.name)
    cdp_config = (_RUNTIME_CONFIG or {}).get("datasets", {}).get("marketing_cdp", {})
    patterns = cdp_config.get("derived_table_patterns", {})
    if not isinstance(patterns, dict):
        return None

    kind = None
    source_table = None
    for candidate in ("preprocessed", "standardized"):
        marker = f"{candidate}_data"
        prefix = f"{candidate}_"
        if marker in parts and stem.startswith(prefix):
            kind = candidate
            source_table = stem[len(prefix):]
            break
        if stem.startswith(prefix):
            kind = candidate
            source_table = stem[len(prefix):]
            break
    if not kind or not source_table:
        return None

    table_pattern = str(patterns.get(kind) or "").strip()
    if not table_pattern:
        return None

    inferred_source = _infer_source(str(path_or_name), source)
    prefixes = SOURCE_PREFIXES.get(inferred_source or "", ())
    source_prefix = prefixes[0] if prefixes else (inferred_source or "")
    return TableRef(
        catalog=_catalog(),
        schema=str(cdp_config.get("schema") or _schema_for("cdp", "")),
        name=table_pattern.format(
            source_table=source_table,
            source=inferred_source or "",
            prefix=source_prefix,
        ),
    )


def _direct_resolution_schemas(path_or_name: str, source: str | None = None) -> list[str]:
    configured = (_RUNTIME_CONFIG or {}).get("databricks", {}).get("schemas", {})
    schema_map = configured if isinstance(configured, dict) else {}
    parts = {part.lower() for part in Path(str(path_or_name).replace("\\", "/")).parts}
    stem = _normalize_name(path_or_name)
    inferred_source = _infer_source(path_or_name, source)
    output_like = any(part in DATA_DIRECTORIES - {"generated_data"} for part in parts) or stem.startswith(
        tuple(f"{layer}_" for layer in OUTPUT_LAYERS)
    )
    source_like = bool(inferred_source) or "generated_data" in parts

    ordered: list[str] = []

    def add(value: object) -> None:
        text = str(value or "").strip()
        if text and text not in ordered:
            ordered.append(text)

    if output_like:
        add(schema_map.get("cdp"))
        add(schema_map.get("audit"))
        add(schema_map.get("copilot"))
    if source_like:
        add(schema_map.get("sources"))
    for key in ("cdp", "sources", "copilot", "audit"):
        add(schema_map.get(key))
    for schema in _schemas():
        add(schema)
    return ordered


@lru_cache(maxsize=4096)
def _direct_table_exists_cached(catalog: str, schema: str, name: str, _cache_bucket: int) -> bool:
    table = TableRef(catalog=catalog, schema=schema, name=name)
    try:
        _statement_rows(f"DESCRIBE TABLE {table.fqdn}")
        return True
    except Exception as exc:
        if _is_missing_table_error(exc) or "PERMISSION_DENIED" in str(exc):
            return False
        return False


def _direct_table_matches(path_or_name: str, targets: set[str], source: str | None = None) -> list[TableRef]:
    catalog = _catalog()
    matches: list[TableRef] = []
    seen: set[tuple[str, str, str]] = set()
    for schema in _direct_resolution_schemas(path_or_name, source=source):
        for target in sorted(targets):
            marker = (catalog, schema, target)
            if marker in seen:
                continue
            seen.add(marker)
            if _direct_table_exists_cached(catalog, schema, target, _statement_cache_bucket()):
                matches.append(TableRef(catalog=catalog, schema=schema, name=target))
    return matches


# Explicit overrides for tables that appear in multiple schemas.
# Key: normalized table stem (lowercase, no prefix/suffix).
# Value: (schema, table_name) — confirm correct schema with data owner before changing.
# Set via env var CODEX_TABLE_OVERRIDES as JSON: '{"app_events": ["marketing_cdp", "app_events"]}'
def _load_table_overrides() -> dict[str, tuple[str, str]]:
    # Env var takes highest priority: CODEX_TABLE_OVERRIDES='{"app_events": ["cdp_schema", "app_events"]}'
    raw = os.getenv("CODEX_TABLE_OVERRIDES", "")
    if raw:
        try:
            parsed = json.loads(raw)
            return {k: (v[0], v[1]) for k, v in parsed.items() if isinstance(v, list) and len(v) == 2}
        except Exception:
            pass
    # Fall back to config.yaml databricks.table_overrides — values are [schema_key, table_name]
    # where schema_key is resolved via _schema_for() (e.g. "cdp" → marketing_cdp).
    config_overrides = (_RUNTIME_CONFIG or {}).get("databricks", {}).get("table_overrides", {})
    if config_overrides:
        result = {}
        for stem, entry in config_overrides.items():
            if isinstance(entry, list) and len(entry) == 2:
                schema_key, table_name = entry
                result[str(stem)] = (_schema_for(schema_key, schema_key), str(table_name))
        return result
    return {}

_TABLE_OVERRIDES: dict[str, tuple[str, str]] = _load_table_overrides()


def resolve_table(path_or_name: str, source: str | None = None, required: bool = True) -> TableRef | None:
    # Check explicit overrides first — prevents ambiguous-match errors for known tables.
    stem = _normalize_name(Path(str(path_or_name).replace("\\", "/")).name)
    registry_ref = _registry_dataset_ref(path_or_name, source=source)
    inferred_source = _infer_source(path_or_name, source)

    # Source-scoped registry mappings are more specific than generic table
    # overrides. A legacy raw path such as generated_data/media/app_events.csv
    # must read marketing_sources.med_app_events, while the unscoped logical
    # name app_events can still use its downstream CDP override.
    if (
        registry_ref is not None
        and registry_ref.source is not None
        and registry_ref.source == inferred_source
    ):
        return TableRef(
            catalog=_catalog(),
            schema=registry_ref.schema,
            name=registry_ref.table,
        )

    if stem in _TABLE_OVERRIDES:
        schema_name, table_name = _TABLE_OVERRIDES[stem]
        return TableRef(catalog=_catalog(), schema=schema_name, name=table_name)

    if registry_ref is not None:
        return TableRef(catalog=_catalog(), schema=registry_ref.schema, name=registry_ref.table)
    direct_ref = _direct_source_scoped_cdp_ref(path_or_name, source=source)
    if direct_ref is not None:
        return direct_ref
    derived_ref = _derived_cdp_ref(path_or_name, source=source)
    if derived_ref is not None:
        return derived_ref
    targets = set(_candidate_names(path_or_name, source))
    matches = _direct_table_matches(path_or_name, targets, source=source)
    if not matches and _allow_broad_table_discovery():
        matches = [table for table in discover_tables() if _normalize_name(table.name) in targets]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        stem = _normalize_name(path_or_name)
        parts = {part.lower() for part in Path(str(path_or_name).replace("\\", "/")).parts}

        def rank(table: TableRef) -> tuple[int, str]:
            name = _normalize_name(table.name)
            score = 0
            if registry_ref is not None:
                if table.schema == registry_ref.schema:
                    score += 200
                if name == _normalize_name(registry_ref.table):
                    score += 200
            if name == stem:
                score += 100
            if inferred_source:
                prefixes = SOURCE_PREFIXES.get(inferred_source, ())
                source_token = "automotive" if inferred_source == "automotice" else inferred_source
                if name.startswith(tuple(prefix + "_" for prefix in prefixes)):
                    score += 80
                if name.startswith(source_token + "_"):
                    score += 70
            for layer in OUTPUT_LAYERS:
                if layer in parts and name.startswith(layer + "_"):
                    score += 60
                if layer in parts and inferred_source:
                    prefixes = SOURCE_PREFIXES.get(inferred_source, ())
                    if any(name.startswith(f"{layer}_{prefix}_") for prefix in prefixes):
                        score += 120
                    if name.startswith(f"{layer}_{inferred_source}_"):
                        score += 110
            if inferred_source and inferred_source in parts:
                score += 20
            return score, table.fqdn

        ranked = sorted(matches, key=rank, reverse=True)
        if rank(ranked[0])[0] > rank(ranked[1])[0]:
            return ranked[0]
        options = ", ".join(f"{m.catalog}.{m.schema}.{m.name}" for m in matches)
        raise DatabricksDataAccessError(f"Ambiguous UC table match for {path_or_name}: {options}")
    if required:
        raise DatabricksDataAccessError(f"No UC table found for {path_or_name}; tried {', '.join(sorted(targets))}.")
    return None


def read_table_df(
    path_or_name: str,
    source: str | None = None,
    required: bool = True,
    columns: Iterable[str] | None = None,
) -> pd.DataFrame:
    table = resolve_table(path_or_name, source=source, required=required)
    if table is None:
        return pd.DataFrame()

    selected_columns = [
        str(column)
        for column in (columns or [])
        if str(column or "").strip()
    ]
    projection = (
        ", ".join(_quote_identifier(column) for column in selected_columns)
        if selected_columns
        else "*"
    )
    max_rows = _max_rows(path_or_name)
    if _pipeline_context_enabled() or _is_pipeline_full_read(path_or_name):
        result_columns, rows = _read_table_rows_large(
            table.fqdn,
            max_rows,
            projection=projection,
        )
    else:
        result_columns, rows = _statement_rows(
            f"SELECT {projection} FROM {table.fqdn} LIMIT {max_rows}"
        )
    return pd.DataFrame(rows, columns=result_columns)


_PAGE_TOTAL_COLUMN = "__codex_total_rows"


def _coerce_page_total(value: object) -> int | None:
    try:
        total = int(float(str(value or "").strip()))
    except (TypeError, ValueError):
        return None
    return total if total >= 0 else None


def _reconcile_page_total(
    frame: pd.DataFrame,
    *,
    offset: int,
    count_statement: str,
    empty_columns: Iterable[str] | None = None,
) -> pd.DataFrame:
    """Keep a paged result and its filtered count internally consistent.

    The normal path uses the window count already returned with the page.  An
    exact scalar count is issued only when the page is empty, the count column
    is missing/ambiguous, or the reported count is smaller than the rows that
    are visibly present at this offset.  This protects the UI from stale or
    duplicate helper columns without adding a second query to healthy pages.
    """
    safe_offset = max(0, int(offset or 0))
    minimum_total = safe_offset + len(frame) if not frame.empty else 0
    reported_total = None

    if not frame.empty and _PAGE_TOTAL_COLUMN in frame.columns:
        total_values = frame.loc[:, _PAGE_TOTAL_COLUMN]
        # A source table from an older export can itself contain the reserved
        # helper name.  Duplicate labels are ambiguous and must not be trusted.
        if isinstance(total_values, pd.Series):
            parsed_values = {
                parsed
                for parsed in (
                    _coerce_page_total(value) for value in total_values.tolist()
                )
                if parsed is not None
            }
            if len(parsed_values) == 1:
                reported_total = next(iter(parsed_values))

    needs_exact_count = (
        safe_offset > 0
        if frame.empty
        else reported_total is None or reported_total < minimum_total
    )
    if needs_exact_count:
        try:
            _count_columns, count_rows = _statement_rows(count_statement)
            exact_total = (
                _coerce_page_total(count_rows[0][0])
                if count_rows and count_rows[0]
                else 0
            )
        except Exception:
            exact_total = None
        total = max(minimum_total, exact_total or 0)
    else:
        total = reported_total or 0

    if frame.empty:
        empty_frame = pd.DataFrame(
            columns=[
                *[
                    column
                    for column in (empty_columns or frame.columns)
                    if str(column).casefold() != _PAGE_TOTAL_COLUMN.casefold()
                ],
                _PAGE_TOTAL_COLUMN,
            ]
        )
        empty_frame.attrs["total_rows"] = total
        return empty_frame

    reconciled = frame.drop(columns=[_PAGE_TOTAL_COLUMN], errors="ignore").copy()
    reconciled[_PAGE_TOTAL_COLUMN] = total
    return reconciled


def read_table_page_df(
    path_or_name: str,
    source: str | None = None,
    limit: int = 50,
    offset: int = 0,
    search: str = "",
    search_columns: Iterable[str] | None = None,
    nonempty_columns: Iterable[str] | None = None,
    order_by: Iterable[tuple[str, str]] | None = None,
    required: bool = False,
) -> pd.DataFrame:
    """Read one bounded UC table page and include the filtered total.

    The ``__codex_total_rows`` window column lets API callers paginate without
    issuing a second full-table read.  Search is evaluated in Databricks SQL,
    so only the requested page is transferred to the App container.
    """
    table = resolve_table(path_or_name, source=source, required=required)
    if table is None:
        return pd.DataFrame()

    safe_limit = min(max(1, int(limit or 1)), 5000)
    safe_offset = max(0, int(offset or 0))
    available_columns = _bounded_table_columns(table)
    predicates: list[str] = []

    requested_nonempty_columns = [
        str(column)
        for column in (nonempty_columns or [])
        if str(column) in available_columns
    ]
    if requested_nonempty_columns:
        populated = " OR ".join(
            (
                "TRIM(COALESCE("
                f"CAST({_quote_identifier(column)} AS STRING), '')) <> ''"
            )
            for column in requested_nonempty_columns
        )
        predicates.append(f"({populated})")

    search_text = str(search or "").strip()
    if search_text:
        requested_columns = [
            str(column)
            for column in (search_columns or available_columns)
            if str(column) in available_columns
        ]
        if requested_columns:
            search_literal = _sql_literal(f"%{search_text.upper()}%")
            searchable = ", ".join(
                f"COALESCE(CAST({_quote_identifier(column)} AS STRING), '')"
                for column in requested_columns
            )
            predicates.append(
                f"UPPER(CONCAT_WS(' ', {searchable})) LIKE {search_literal}"
            )

    where_sql = f" WHERE {' AND '.join(predicates)}" if predicates else ""

    ordering: list[str] = []
    supported_order_modes = {
        "ASC",
        "DESC",
        "NUMERIC_ASC",
        "NUMERIC_DESC",
        "NONEMPTY_ASC",
        "NONEMPTY_DESC",
    }
    for raw_column, raw_mode in order_by or []:
        column = str(raw_column or "")
        mode = str(raw_mode or "ASC").strip().upper()
        if column not in available_columns or mode not in supported_order_modes:
            continue
        column_sql = _quote_identifier(column)
        direction = "DESC" if mode.endswith("DESC") else "ASC"
        if mode.startswith("NUMERIC_"):
            ordering.append(
                f"TRY_CAST({column_sql} AS DOUBLE) {direction} NULLS LAST"
            )
        elif mode.startswith("NONEMPTY_"):
            ordering.append(
                "CASE WHEN TRIM(COALESCE("
                f"CAST({column_sql} AS STRING), '')) <> '' "
                f"THEN 1 ELSE 0 END {direction}"
            )
        else:
            ordering.append(f"{column_sql} {direction} NULLS LAST")
    order_sql = f" ORDER BY {', '.join(ordering)}" if ordering else ""
    data_columns = [
        column
        for column in available_columns
        if str(column).casefold() != _PAGE_TOTAL_COLUMN.casefold()
    ]
    projection = ", ".join(_quote_identifier(column) for column in data_columns)
    if not projection:  # pragma: no cover - a resolved table always has columns
        projection = "*"
    statement = (
        f"SELECT {projection}, COUNT(*) OVER() AS {_PAGE_TOTAL_COLUMN} "
        f"FROM {table.fqdn}{where_sql}{order_sql} "
        f"LIMIT {safe_limit} OFFSET {safe_offset}"
    )
    columns, rows = _statement_rows(statement)
    frame = pd.DataFrame(rows, columns=columns)
    return _reconcile_page_total(
        frame,
        offset=safe_offset,
        count_statement=(
            f"SELECT COUNT(*) AS {_PAGE_TOTAL_COLUMN} "
            f"FROM {table.fqdn}{where_sql}"
        ),
        empty_columns=data_columns,
    )


_CUSTOMER_PROFILE_ATTRIBUTE_CANDIDATES: dict[str, tuple[str, ...]] = {
    "full_name": ("full_name", "profile_name", "name", "all_names"),
    "first_name": ("first_name", "given_name"),
    "last_name": ("last_name", "surname", "family_name"),
    "email": ("email", "contact_email", "all_emails"),
    "phone": ("phone", "contact_phone", "all_phones"),
    "address": ("address", "address_line1", "line1", "shipping_address"),
    "city": ("city", "primary_city", "shipping_city"),
    "state": (
        "state",
        "state_province",
        "primary_state_province",
        "state_of_residence",
        "shipping_state",
    ),
    "zip": ("zip", "postal_code", "shipping_zip"),
    "household_id": ("household_id",),
    "customer_id": ("customer_id",),
    "account_id": ("account_id", "ticket_account_id"),
    "loyalty_id": ("loyalty_id", "loyalty_account_id"),
    "date_of_birth": ("date_of_birth", "dob", "birth_date"),
    "subscription_tier": ("subscription_tier", "subscription_tier_code"),
    "membership_tier": ("membership_tier",),
}


def _casefolded_column_map(columns: Iterable[str]) -> dict[str, str]:
    return {
        str(column).strip().casefold(): str(column).strip()
        for column in columns
        if str(column or "").strip()
    }


def _aggregate_preferred_string(
    alias: str,
    columns: dict[str, str],
    candidates: Iterable[str],
) -> str:
    """Build a deterministic first-available aggregate for optional columns."""
    expressions = []
    for candidate in candidates:
        column = columns.get(str(candidate).casefold())
        if not column:
            continue
        column_sql = f"{alias}.{_quote_identifier(column)}"
        expressions.append(
            "MIN(NULLIF(TRIM(CAST(" + column_sql + " AS STRING)), ''))"
        )
    if not expressions:
        return "CAST(NULL AS STRING)"
    return expressions[0] if len(expressions) == 1 else f"COALESCE({', '.join(expressions)})"


def read_cluster_complete_customer_profile_page_df(
    clustered_path_or_name: str,
    golden_path_or_name: str,
    *,
    source: str,
    limit: int = 50,
    offset: int = 0,
    search: str = "",
) -> pd.DataFrame:
    """Page the complete identity universe without loading it into the app.

    The clustered table is the authoritative universe. One SQL aggregate is
    produced per cluster and left-joined to the governed golden table so a
    partially published golden snapshot cannot hide valid profiles. Missing
    golden rows receive the normal ``-CL-`` to ``-GR-`` identifier and are
    explicitly marked as limited. Only the requested page is transferred.
    """
    clustered = resolve_table(
        clustered_path_or_name,
        source=source,
        required=True,
    )
    golden = resolve_table(
        golden_path_or_name,
        source=source,
        required=False,
    )
    if clustered is None:  # pragma: no cover - required=True is authoritative
        return pd.DataFrame()

    safe_limit = min(max(1, int(limit or 1)), 5000)
    safe_offset = max(0, int(offset or 0))
    cluster_columns = _casefolded_column_map(_bounded_table_columns(clustered))
    cluster_id_column = cluster_columns.get("cluster_id")
    if not cluster_id_column:
        raise DatabricksDataAccessError(
            f"Clustered table {clustered.fqdn} does not contain cluster_id."
        )

    cluster_id_sql = f"c.{_quote_identifier(cluster_id_column)}"
    cluster_select = [
        f"CAST({cluster_id_sql} AS STRING) AS cluster_id",
        "COUNT(*) AS record_count",
    ]
    source_file_column = cluster_columns.get("source_file")
    if source_file_column:
        source_file_sql = f"c.{_quote_identifier(source_file_column)}"
        nonempty_source = (
            f"NULLIF(TRIM(CAST({source_file_sql} AS STRING)), '')"
        )
        cluster_select.extend(
            [
                f"COUNT(DISTINCT {nonempty_source}) AS source_count",
                "CONCAT_WS('|', ARRAY_SORT(COLLECT_SET("
                + nonempty_source
                + "))) AS source_files",
            ]
        )
    else:
        cluster_select.extend(
            [
                "CAST(0 AS BIGINT) AS source_count",
                "CAST('' AS STRING) AS source_files",
            ]
        )

    for output_name, candidates in _CUSTOMER_PROFILE_ATTRIBUTE_CANDIDATES.items():
        expression = _aggregate_preferred_string("c", cluster_columns, candidates)
        cluster_select.append(f"{expression} AS {_quote_identifier(output_name)}")

    cluster_where = (
        "TRIM(COALESCE(CAST("
        + cluster_id_sql
        + " AS STRING), '')) <> ''"
    )
    ctes = [
        "cluster_profiles AS (\n"
        "  SELECT\n    "
        + ",\n    ".join(cluster_select)
        + f"\n  FROM {clustered.fqdn} c"
        + f"\n  WHERE {cluster_where}"
        + f"\n  GROUP BY CAST({cluster_id_sql} AS STRING)\n)"
    ]

    golden_join = ""
    golden_columns: dict[str, str] = {}
    if golden is not None:
        golden_columns = _casefolded_column_map(_bounded_table_columns(golden))
    golden_cluster_id_column = golden_columns.get("cluster_id")
    if golden is not None and golden_cluster_id_column:
        golden_cluster_id_sql = f"g.{_quote_identifier(golden_cluster_id_column)}"
        golden_select = [
            f"CAST({golden_cluster_id_sql} AS STRING) AS cluster_id",
            _aggregate_preferred_string(
                "g",
                golden_columns,
                ("golden_id", "record_id"),
            )
            + " AS golden_id",
        ]
        for output_name, candidates in _CUSTOMER_PROFILE_ATTRIBUTE_CANDIDATES.items():
            expression = _aggregate_preferred_string("g", golden_columns, candidates)
            golden_select.append(f"{expression} AS {_quote_identifier(output_name)}")
        golden_where = (
            "TRIM(COALESCE(CAST("
            + golden_cluster_id_sql
            + " AS STRING), '')) <> ''"
        )
        ctes.append(
            "golden_profiles AS (\n"
            "  SELECT\n    "
            + ",\n    ".join(golden_select)
            + f"\n  FROM {golden.fqdn} g"
            + f"\n  WHERE {golden_where}"
            + f"\n  GROUP BY CAST({golden_cluster_id_sql} AS STRING)\n)"
        )
        golden_join = (
            "\n  LEFT JOIN golden_profiles g "
            "ON UPPER(g.cluster_id) = UPPER(c.cluster_id)"
        )

    has_golden_join = bool(golden_join)

    def governed_or_clustered(column: str) -> str:
        cluster_value = f"NULLIF(TRIM(CAST(c.{_quote_identifier(column)} AS STRING)), '')"
        if has_golden_join:
            golden_value = f"NULLIF(TRIM(CAST(g.{_quote_identifier(column)} AS STRING)), '')"
            return f"COALESCE({golden_value}, {cluster_value}, '')"
        return f"COALESCE({cluster_value}, '')"

    if has_golden_join:
        golden_id_expression = (
            "COALESCE(NULLIF(TRIM(CAST(g.golden_id AS STRING)), ''), "
            "REGEXP_REPLACE(c.cluster_id, '(?i)-CL-', '-GR-'))"
        )
        profile_scope_expression = (
            "CASE WHEN g.cluster_id IS NULL THEN 'cluster_singleton' "
            "ELSE 'golden_artifact' END"
        )
        limited_expression = "CAST(g.cluster_id IS NULL AS BOOLEAN)"
    else:
        golden_id_expression = "REGEXP_REPLACE(c.cluster_id, '(?i)-CL-', '-GR-')"
        profile_scope_expression = "CAST('cluster_singleton' AS STRING)"
        limited_expression = "CAST(TRUE AS BOOLEAN)"

    base_attribute_expressions = {
        name: governed_or_clustered(name)
        for name in _CUSTOMER_PROFILE_ATTRIBUTE_CANDIDATES
    }
    full_name_expression = (
        "COALESCE(NULLIF("
        + base_attribute_expressions["full_name"]
        + ", ''), NULLIF(TRIM(CONCAT_WS(' ', NULLIF("
        + base_attribute_expressions["first_name"]
        + ", ''), NULLIF("
        + base_attribute_expressions["last_name"]
        + ", ''))), ''), '')"
    )
    base_attribute_expressions["full_name"] = full_name_expression

    profile_select = [
        f"{golden_id_expression} AS golden_id",
        "c.cluster_id",
        *(
            f"{base_attribute_expressions[name]} AS {_quote_identifier(name)}"
            for name in _CUSTOMER_PROFILE_ATTRIBUTE_CANDIDATES
        ),
        "c.source_files",
        "c.record_count",
        "c.source_count",
        f"{profile_scope_expression} AS profile_scope",
        f"{limited_expression} AS limited_attributes",
    ]
    ctes.append(
        "profile_base AS (\n"
        "  SELECT\n    "
        + ",\n    ".join(profile_select)
        + "\n  FROM cluster_profiles c"
        + golden_join
        + "\n)"
    )

    search_text = str(search or "").strip()
    if search_text:
        search_columns = (
            "golden_id",
            "cluster_id",
            "full_name",
            "first_name",
            "last_name",
            "email",
            "phone",
            "customer_id",
            "account_id",
            "loyalty_id",
            "household_id",
        )
        searchable = ", ".join(
            f"NULLIF(TRIM(CAST({_quote_identifier(column)} AS STRING)), '')"
            for column in search_columns
        )
        search_predicate = (
            "INSTR(UPPER(CONCAT_WS(' ', "
            + searchable
            + ")), "
            + _sql_literal(search_text.upper())
            + ") > 0"
        )
        ctes.append(
            "filtered_profiles AS (SELECT * FROM profile_base WHERE "
            + search_predicate
            + ")"
        )
    else:
        ctes.append("filtered_profiles AS (SELECT * FROM profile_base)")

    output_columns = [
        "golden_id",
        "cluster_id",
        *_CUSTOMER_PROFILE_ATTRIBUTE_CANDIDATES.keys(),
        "source_files",
        "record_count",
        "source_count",
        "profile_scope",
        "limited_attributes",
    ]
    projection = ", ".join(_quote_identifier(column) for column in output_columns)
    order_sql = (
        "ORDER BY record_count DESC, "
        "CASE WHEN TRIM(COALESCE(full_name, '')) <> '' THEN 1 ELSE 0 END DESC, "
        "CASE WHEN TRIM(COALESCE(email, '')) <> '' THEN 1 ELSE 0 END DESC, "
        "CASE WHEN TRIM(COALESCE(phone, '')) <> '' THEN 1 ELSE 0 END DESC, "
        "golden_id ASC, cluster_id ASC"
    )
    with_sql = "WITH " + ",\n".join(ctes)
    statement = (
        with_sql
        + f"\nSELECT {projection}, COUNT(*) OVER() AS __codex_total_rows "
        "FROM filtered_profiles "
        + order_sql
        + f" LIMIT {safe_limit} OFFSET {safe_offset}"
    )
    result_columns, rows = _statement_rows(statement)
    frame = _reconcile_page_total(
        pd.DataFrame(rows, columns=result_columns),
        offset=safe_offset,
        count_statement=(
            with_sql
            + "\nSELECT COUNT(*) AS __codex_total_rows FROM filtered_profiles"
        ),
        empty_columns=output_columns,
    )
    if not frame.empty and "limited_attributes" in frame.columns:
        frame["limited_attributes"] = frame["limited_attributes"].map(
            lambda value: value is True
            or str(value or "").strip().lower() in {"1", "true", "yes", "y"}
        )
    return frame


def read_table_sample_df(
    path_or_name: str,
    source: str | None = None,
    limit: int = 1000,
    required: bool = False,
) -> pd.DataFrame:
    """Read a small warehouse-side sample without materializing a pipeline table."""
    table = resolve_table(path_or_name, source=source, required=required)
    if table is None:
        return pd.DataFrame()
    safe_limit = min(max(1, int(limit or 1)), 5000)
    columns, rows = _statement_rows(f"SELECT * FROM {table.fqdn} LIMIT {safe_limit}")
    return pd.DataFrame(rows, columns=columns)


def search_table_df(
    path_or_name: str,
    column: str,
    value: str,
    source: str | None = None,
    limit: int = 200,
    required: bool = False,
) -> pd.DataFrame:
    table = resolve_table(path_or_name, source=source, required=required)
    if table is None:
        return pd.DataFrame()

    safe_limit = max(1, int(limit or 1))
    column_sql = _quote_identifier(str(column))
    value_sql = _sql_literal(str(value or "").upper())
    statement = (
        f"SELECT * FROM {table.fqdn} "
        f"WHERE instr(upper(CAST({column_sql} AS STRING)), {value_sql}) > 0 "
        f"LIMIT {safe_limit}"
    )
    columns, rows = _statement_rows(statement)
    return pd.DataFrame(rows, columns=columns)


def read_table_where_in_df(
    path_or_name: str,
    columns: Iterable[str],
    values: Iterable[object],
    source: str | None = None,
    limit: int = 10000,
    required: bool = False,
) -> pd.DataFrame:
    table = resolve_table(path_or_name, source=source, required=required)
    if table is None:
        return pd.DataFrame()

    cleaned_values = [str(value) for value in values if str(value or "").strip()]
    cleaned_columns = [str(column) for column in columns if str(column or "").strip()]
    if not cleaned_values or not cleaned_columns:
        return pd.DataFrame()

    literals = ", ".join(_sql_literal(value.upper()) for value in sorted(set(cleaned_values)))
    predicates = [
        f"upper(CAST({_quote_identifier(column)} AS STRING)) IN ({literals})"
        for column in cleaned_columns
    ]
    safe_limit = max(1, int(limit or 1))
    statement = (
        f"SELECT * FROM {table.fqdn} "
        f"WHERE {' OR '.join(predicates)} "
        f"LIMIT {safe_limit}"
    )
    columns_out, rows = _statement_rows(statement)
    return pd.DataFrame(rows, columns=columns_out)

@lru_cache(maxsize=512)
def table_columns(path_or_name: str, source: str | None = None) -> list[str]:
    table = resolve_table(path_or_name, source=source, required=False)
    if table is None:
        return []
    try:
        columns, rows = _statement_rows(f"DESCRIBE TABLE {table.fqdn}")
    except Exception as exc:
        if _is_missing_table_error(exc):
            return []
        raise
    lower_columns = [col.lower() for col in columns]
    name_idx = lower_columns.index("col_name") if "col_name" in lower_columns else 0
    names = []
    for row in rows:
        if len(row) <= name_idx:
            continue
        name = str(row[name_idx] or "").strip()
        if name and not name.startswith("#"):
            names.append(name)
    return names


def _metadata_table_ref(
    path_or_name: str,
    source: str | None = None,
    catalog: str | None = None,
    schema: str | None = None,
) -> TableRef | None:
    if catalog and schema:
        name = Path(str(path_or_name).replace("\\", "/")).name
        return TableRef(catalog=str(catalog), schema=str(schema), name=name)
    return resolve_table(path_or_name, source=source, required=False)


@lru_cache(maxsize=512)
def _workspace_table_columns(table: TableRef) -> list[str]:
    client = _workspace_client()
    full_name = ".".join((table.catalog, table.schema, table.name))
    info = client.tables.get(full_name=full_name)
    columns = _object_value(info, "columns", []) or []
    names = []
    for column in columns:
        name = str(_object_value(column, "name", "") or "").strip()
        if name:
            names.append(name)
    return names


def _bounded_table_columns(table: TableRef) -> list[str]:
    # Unity Catalog metadata is independent of SQL warehouse start-up and is
    # already the compatibility layer's established schema path. Prefer it for
    # interactive paging so a cold warehouse cannot fail a request on the
    # 3-second lightweight-count timeout. Retain a bounded SQL fallback for
    # environments where table metadata is unavailable to the caller.
    try:
        columns = _workspace_table_columns(table)
        if columns:
            return columns
    except Exception:
        pass
    columns, _rows = _statement_rows_with_timeout(
        f"SELECT * FROM {table.fqdn} LIMIT 0",
        max(30, _metadata_batch_timeout_seconds()),
    )
    return columns


def _batch_table_counts(
    items: list[tuple[str, TableRef]],
    results: dict[str, dict[str, object]],
) -> None:
    if not items:
        return
    statement = " UNION ALL ".join(
        f"SELECT {_sql_literal(key)} AS request_key, COUNT(*) AS row_count FROM {table.fqdn}"
        for key, table in items
    )
    try:
        columns, rows = _statement_rows_with_timeout(statement, _metadata_batch_timeout_seconds())
    except Exception as exc:
        if _is_missing_table_error(exc) and len(items) > 1:
            midpoint = len(items) // 2
            _batch_table_counts(items[:midpoint], results)
            _batch_table_counts(items[midpoint:], results)
        elif _is_missing_table_error(exc) and len(items) == 1:
            results[items[0][0]]["exists"] = False
        else:
            for key, _table in items:
                results[key]["count_error"] = str(exc)
        return

    lower_columns = [str(column).lower() for column in columns]
    key_index = lower_columns.index("request_key") if "request_key" in lower_columns else 0
    count_index = lower_columns.index("row_count") if "row_count" in lower_columns else 1
    for row in rows:
        if len(row) <= max(key_index, count_index):
            continue
        key = str(row[key_index])
        try:
            results[key]["row_count"] = int(row[count_index] or 0)
        except (KeyError, TypeError, ValueError):
            continue


def tables_fast_metadata(
    requests: Iterable[dict[str, object]],
    *,
    include_row_counts: bool = True,
) -> dict[str, dict[str, object]]:
    """Return metadata for several configured tables.

    Callers that only need UC existence and schema checks can skip the shared
    SQL count query. Source-listing callers retain row counts by default.
    """
    request_list = [dict(request or {}) for request in requests]
    normalized = []
    for index, item in enumerate(request_list):
        key = str(item.get("key") or index)
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        table = _metadata_table_ref(
            name,
            source=str(item.get("source") or "") or None,
            catalog=str(item.get("catalog") or "") or None,
            schema=str(item.get("schema") or "") or None,
        )
        normalized.append((key, table))

    request_columns = {
        str(request.get("key") or index): list(request.get("columns") or [])
        for index, request in enumerate(request_list)
    }
    results = {
        key: {
            "exists": False if table is None else None,
            "row_count": None,
            "columns": request_columns.get(key, []),
        }
        for key, table in normalized
    }

    workers = max(1, min(int(os.getenv("CODEX_UC_METADATA_WORKERS", "4")), 8))
    table_items = [(key, table) for key, table in normalized if table is not None]
    # Confirm table existence and columns through the UC Catalog API first.
    # This path does not depend on SQL warehouse readiness, so a cold
    # warehouse cannot turn every configured registry candidate into a
    # phantom zero-row source.
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(_workspace_table_columns, table): (key, table)
            for key, table in table_items
        }
        for future in as_completed(futures):
            key, _table = futures[future]
            try:
                catalog_columns = future.result()
                results[key]["exists"] = True
                if not results[key]["columns"]:
                    results[key]["columns"] = catalog_columns
            except Exception as exc:
                if _is_missing_table_error(exc):
                    results[key]["exists"] = False
                else:
                    results[key]["exists"] = None
                    results[key]["catalog_error"] = str(exc)

    if include_row_counts:
        count_items = [
            (key, table)
            for key, table in table_items
            if results[key].get("exists") is True
        ]
        _batch_table_counts(count_items, results)
    return results


def table_fast_metadata(
    path_or_name: str,
    source: str | None = None,
    catalog: str | None = None,
    schema: str | None = None,
) -> dict[str, object]:
    """Return lightweight UC table metadata without scanning table contents."""
    table = _metadata_table_ref(path_or_name, source=source, catalog=catalog, schema=schema)
    if table is None:
        return {"exists": False, "row_count": None, "columns": []}

    row_count = None
    try:
        columns, rows = _statement_rows_with_timeout(
            f"DESCRIBE DETAIL {table.fqdn}",
            _metadata_count_timeout_seconds(),
        )
        lower_columns = [col.lower() for col in columns]
        if "numrows" in lower_columns and rows:
            value = rows[0][lower_columns.index("numrows")]
            if value is not None:
                row_count = int(value or 0)
    except Exception as exc:
        if _is_missing_table_error(exc):
            return {"exists": False, "row_count": None, "columns": []}

    try:
        table_columns = _bounded_table_columns(table)
    except Exception as exc:
        if _is_missing_table_error(exc):
            return {"exists": False, "row_count": None, "columns": []}
        table_columns = []

    if (row_count is None or row_count <= 0) and os.getenv("CODEX_UC_FAST_METADATA_COUNT_FALLBACK", "1").strip().lower() not in {"0", "false", "no"}:
        try:
            count_columns, count_rows = _statement_rows_with_timeout(
                f"SELECT COUNT(*) AS row_count FROM {table.fqdn}",
                _metadata_count_timeout_seconds(),
            )
            if count_rows and count_rows[0]:
                row_count = int(count_rows[0][0] or 0)
        except Exception as exc:
            if _is_missing_table_error(exc):
                return {"exists": False, "row_count": None, "columns": []}

    return {
        "exists": True,
        "row_count": row_count,
        "columns": table_columns,
    }


def _table_column_names(table: TableRef) -> list[str]:
    try:
        columns, rows = _statement_rows(f"DESCRIBE TABLE {table.fqdn}")
    except Exception as exc:
        if _is_missing_table_error(exc):
            return []
        raise
    lower_columns = [col.lower() for col in columns]
    name_idx = lower_columns.index("col_name") if "col_name" in lower_columns else 0
    names = []
    for row in rows:
        if len(row) <= name_idx:
            continue
        name = str(row[name_idx] or "").strip()
        if name and not name.startswith("#"):
            names.append(name)
    return names


def _table_column_types(table: TableRef) -> dict[str, str]:
    try:
        columns, rows = _statement_rows(f"DESCRIBE TABLE {table.fqdn}")
    except Exception as exc:
        if _is_missing_table_error(exc):
            return {}
        raise
    lower_columns = [col.lower() for col in columns]
    name_idx = lower_columns.index("col_name") if "col_name" in lower_columns else 0
    type_idx = lower_columns.index("data_type") if "data_type" in lower_columns else None
    if type_idx is None:
        return {}
    types: dict[str, str] = {}
    for row in rows:
        if len(row) <= max(name_idx, type_idx):
            continue
        name = str(row[name_idx] or "").strip()
        data_type = str(row[type_idx] or "").strip()
        if name and data_type and not name.startswith("#"):
            types[name.lower()] = data_type
    return types


def table_row_count(path_or_name: str, source: str | None = None) -> int:
    table = resolve_table(path_or_name, source=source, required=False)
    if table is None:
        return 0
    try:
        columns, rows = _statement_rows(f"DESCRIBE DETAIL {table.fqdn}")
        lower_columns = [col.lower() for col in columns]
        if "numrows" in lower_columns and rows:
            value = rows[0][lower_columns.index("numrows")]
            if value is not None:
                return int(value or 0)
    except Exception as exc:
        if _is_missing_table_error(exc):
            return 0
        pass
    try:
        columns, rows = _statement_rows(f"SELECT COUNT(*) AS row_count FROM {table.fqdn}")
    except Exception as exc:
        if _is_missing_table_error(exc):
            return 0
        raise
    if not rows or not rows[0]:
        return 0
    try:
        return int(rows[0][0] or 0)
    except (TypeError, ValueError):
        return 0


@lru_cache(maxsize=512)
def _table_exists_cached(fqdn: str, _cache_bucket: int) -> bool:
    try:
        _statement_rows(f"DESCRIBE TABLE {fqdn}")
        return True
    except Exception as exc:
        if _is_missing_table_error(exc):
            return False
        raise


def table_exists(path_or_name: str, source: str | None = None) -> bool:
    table = resolve_table(path_or_name, source=source, required=False)
    if table is None:
        return False
    return _table_exists_cached(table.fqdn, _statement_cache_bucket())


def read_table_csv_text(path_or_name: str, source: str | None = None, required: bool = True) -> str:
    frame = read_table_df(path_or_name, source=source or _infer_source(path_or_name), required=required)
    return frame.to_csv(index=False)


def _resolve_table_for_write(path_or_name: str, source: str | None = None) -> TableRef:
    source = source or _infer_source(path_or_name)
    registry_ref = _registry_dataset_ref(path_or_name, source=source)
    if registry_ref is not None:
        return TableRef(catalog=_catalog(), schema=registry_ref.schema, name=registry_ref.table)
    derived_ref = _derived_cdp_ref(path_or_name, source=source)
    if derived_ref is not None:
        return derived_ref
    table = resolve_table(path_or_name, source=source, required=False)
    if table is not None:
        return table
    raise DatabricksDataAccessError(f"Unknown writable logical dataset: {path_or_name}")


def _active_spark_session():
    try:
        from pyspark.sql import SparkSession
    except Exception:
        return None
    try:
        return SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
    except Exception:
        return None


def _sql_type_for_series(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "BOOLEAN"
    if pd.api.types.is_integer_dtype(series):
        return "BIGINT"
    if pd.api.types.is_float_dtype(series):
        return "DOUBLE"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "TIMESTAMP"
    return "STRING"


def _is_string_sql_type(data_type: str | None) -> bool:
    normalized = str(data_type or "").strip().lower()
    return not normalized or any(token in normalized for token in ("string", "varchar", "char"))


def _sql_literal_value(value: Any, target_type: str | None = None) -> str:
    if value is None or pd.isna(value):
        return "NULL"
    text_value = str(value).strip() if isinstance(value, str) else None
    if target_type and not _is_string_sql_type(target_type):
        if text_value == "":
            return "NULL"
        normalized_type = target_type.strip()
        if normalized_type.lower() == "boolean":
            normalized_value = str(value).strip().lower()
            if normalized_value in {"true", "t", "1", "yes", "y"}:
                return "TRUE"
            if normalized_value in {"false", "f", "0", "no", "n"}:
                return "FALSE"
            return "NULL"
        return f"try_cast({_sql_literal(str(value))} AS {normalized_type})"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    if hasattr(value, "isoformat"):
        return _sql_literal(str(value.isoformat()))
    return _sql_literal(str(value))


def _create_table_statement(table: TableRef, frame: pd.DataFrame, if_not_exists: bool = True) -> str:
    if frame.empty and not list(frame.columns):
        raise DatabricksDataAccessError(f"Cannot create {table.fqdn} from an empty dataframe with no columns.")
    existence = "IF NOT EXISTS " if if_not_exists else ""
    columns = [
        f"{_quote_identifier(str(column))} {_sql_type_for_series(frame[column])}"
        for column in frame.columns
    ]
    return f"CREATE TABLE {existence}{table.fqdn} ({', '.join(columns)}) USING DELTA"


def _positive_int_env(name: str, default: int | None = None) -> int | None:
    raw_value = os.getenv(name)
    if raw_value is None or str(raw_value).strip() == "":
        return default
    try:
        return max(1, int(str(raw_value).strip()))
    except ValueError:
        return default


def _sql_write_batch_size(frame: pd.DataFrame) -> int:
    configured = _positive_int_env("CODEX_SQL_WRITE_BATCH_SIZE")
    if configured is not None:
        return configured

    frame_columns = getattr(frame, "columns", [])
    column_count = max(1, len(frame_columns))
    if column_count >= 80:
        return 20
    if column_count >= 40:
        return 50
    return 100


def _sql_insert_max_chars() -> int:
    return _positive_int_env("CODEX_SQL_MAX_INSERT_CHARS", 150_000) or 150_000


def _insert_dataframe_sql(table: TableRef, frame: pd.DataFrame, batch_size: int) -> None:
    if frame.empty:
        return
    frame_columns = [str(column) for column in frame.columns]
    table_types = _table_column_types(table)
    columns = ", ".join(_quote_identifier(column) for column in frame_columns)
    statement_prefix = f"INSERT INTO {table.fqdn} ({columns}) VALUES "
    max_statement_chars = max(len(statement_prefix) + 1, _sql_insert_max_chars())
    rows = frame.where(pd.notna(frame), None).itertuples(index=False, name=None)
    batch = []
    batch_chars = len(statement_prefix)
    for row in rows:
        values = [
            _sql_literal_value(value, table_types.get(column.lower()))
            for column, value in zip(frame_columns, row)
        ]
        row_sql = "(" + ", ".join(values) + ")"
        separator_chars = 2 if batch else 0
        if batch and (
            len(batch) >= batch_size
            or batch_chars + separator_chars + len(row_sql) > max_statement_chars
        ):
            _execute_statement(statement_prefix + ", ".join(batch))
            batch = []
            batch_chars = len(statement_prefix)
            separator_chars = 0
        batch.append(row_sql)
        batch_chars += separator_chars + len(row_sql)
    if batch:
        _execute_statement(statement_prefix + ", ".join(batch))


def _configured_existing_table(logical_name: str) -> tuple[TableRef, list[str]]:
    """Resolve an explicitly registered dataset and require its UC table.

    This intentionally bypasses overrides and broad discovery.  Security and
    audit tables must resolve only through ``backend/config.yaml`` so a
    similarly named table in another schema can never be selected by accident.
    """
    if not uc_enabled():
        raise DatabricksDataAccessError("Existing-table access requires CODEX_DATA_SOURCE=uc.")

    normalized_name = str(logical_name or "").strip()
    if not normalized_name:
        raise DatabricksDataAccessError("A configured logical table name is required.")

    registry_ref = _registry_dataset_ref(normalized_name)
    if registry_ref is None:
        raise DatabricksDataAccessError(
            f"Unknown configured logical dataset: {normalized_name}"
        )

    table = TableRef(
        catalog=_catalog(),
        schema=str(registry_ref.schema),
        name=str(registry_ref.table),
    )
    columns = _table_column_names(table)
    if not columns:
        raise DatabricksDataAccessError(
            f"Required UC table does not exist or has no readable schema: {table.fqdn}"
        )
    return table, columns


def _canonical_existing_columns(
    table: TableRef,
    existing_columns: Iterable[str],
    requested_columns: Iterable[str],
    *,
    purpose: str,
) -> list[str]:
    existing = [str(column) for column in existing_columns]
    by_normalized = {column.casefold(): column for column in existing}
    requested = [str(column or "").strip() for column in requested_columns]

    if any(not column for column in requested):
        raise DatabricksDataAccessError(
            f"Blank column names are not allowed for {purpose} on {table.fqdn}."
        )
    normalized = [column.casefold() for column in requested]
    if len(normalized) != len(set(normalized)):
        raise DatabricksDataAccessError(
            f"Duplicate column names are not allowed for {purpose} on {table.fqdn}."
        )

    unknown = [column for column in requested if column.casefold() not in by_normalized]
    if unknown:
        raise DatabricksDataAccessError(
            f"Unknown column(s) for {table.fqdn}: {', '.join(unknown)}"
        )
    return [by_normalized[column.casefold()] for column in requested]


def read_existing_table_df(
    logical_name: str,
    *,
    columns: Iterable[str] | None = None,
    filters: Mapping[str, Any] | None = None,
    limit: int | None = None,
) -> pd.DataFrame:
    """Read a configured, pre-created UC table using exact-equality filters.

    The function is designed for security-sensitive, low-volume state such as
    users and session events.  It never discovers, creates, or alters a table,
    validates every projected/filter column against ``DESCRIBE TABLE``, and
    bypasses the reporting cache so authentication decisions use current data.
    """
    table, existing_columns = _configured_existing_table(logical_name)

    selected = (
        _canonical_existing_columns(
            table,
            existing_columns,
            columns,
            purpose="read",
        )
        if columns is not None
        else list(existing_columns)
    )
    if not selected:
        raise DatabricksDataAccessError(
            f"At least one column is required when reading {table.fqdn}."
        )

    if filters is not None and not isinstance(filters, Mapping):
        raise TypeError("read_existing_table_df filters must be a mapping of column names to values.")
    filter_items = list((filters or {}).items())
    filter_columns = _canonical_existing_columns(
        table,
        existing_columns,
        (column for column, _value in filter_items),
        purpose="filter",
    )
    column_types = _table_column_types(table) if filter_items else {}
    predicates: list[str] = []
    for canonical_column, (_requested_column, value) in zip(filter_columns, filter_items):
        quoted = _quote_identifier(canonical_column)
        if value is None or (not isinstance(value, (list, tuple, set, dict)) and pd.isna(value)):
            predicates.append(f"{quoted} IS NULL")
        else:
            if isinstance(value, (list, tuple, set, dict)):
                raise TypeError(
                    "read_existing_table_df supports scalar exact-equality filter values only."
                )
            predicates.append(
                f"{quoted} = {_sql_literal_value(value, column_types.get(canonical_column.casefold()))}"
            )

    default_limit = _max_rows(logical_name)
    if limit is None:
        safe_limit = default_limit
    else:
        if isinstance(limit, bool):
            raise TypeError("read_existing_table_df limit must be a positive integer.")
        try:
            safe_limit = int(limit)
        except (TypeError, ValueError) as exc:
            raise TypeError("read_existing_table_df limit must be a positive integer.") from exc
        if safe_limit < 1:
            raise ValueError("read_existing_table_df limit must be at least 1.")
        if safe_limit > default_limit:
            raise ValueError(
                f"read_existing_table_df limit cannot exceed the configured maximum of {default_limit}."
            )

    projection = ", ".join(_quote_identifier(column) for column in selected)
    statement = f"SELECT {projection} FROM {table.fqdn}"
    if predicates:
        statement += " WHERE " + " AND ".join(predicates)
    statement += f" LIMIT {safe_limit}"

    result_columns, rows = _statement_rows_uncached(statement)
    return pd.DataFrame(rows, columns=result_columns)


def append_existing_table_df(logical_name: str, frame: pd.DataFrame) -> TableRef:
    """Append to a configured, pre-created UC table without schema mutation.

    The dataframe must contain the table's complete column set.  This strict
    contract prevents authentication/audit events from being silently written
    with missing fields when application and table schemas drift.
    """
    if not isinstance(frame, pd.DataFrame):
        raise TypeError("append_existing_table_df expects a pandas DataFrame.")

    table, existing_columns = _configured_existing_table(logical_name)
    frame_columns = _canonical_existing_columns(
        table,
        existing_columns,
        frame.columns,
        purpose="append",
    )
    expected = {column.casefold() for column in existing_columns}
    provided = {column.casefold() for column in frame_columns}
    if provided != expected:
        missing = [column for column in existing_columns if column.casefold() not in provided]
        unexpected = [column for column in frame_columns if column.casefold() not in expected]
        details = []
        if missing:
            details.append("missing: " + ", ".join(missing))
        if unexpected:
            details.append("unexpected: " + ", ".join(unexpected))
        raise DatabricksDataAccessError(
            f"Append schema mismatch for {table.fqdn} ({'; '.join(details)})."
        )

    normalized_frame = frame.copy()
    normalized_frame.columns = frame_columns
    normalized_frame = normalized_frame.loc[:, existing_columns]
    _insert_dataframe_sql(
        table,
        normalized_frame,
        batch_size=_sql_write_batch_size(normalized_frame),
    )
    _statement_rows_cached.cache_clear()
    _statement_rows_timeout_cached.cache_clear()
    return table


def _add_missing_table_columns_sql(table: TableRef, frame: pd.DataFrame) -> None:
    existing = {name.lower() for name in _table_column_names(table)}
    missing = [
        column
        for column in frame.columns
        if str(column).lower() not in existing
    ]
    if not missing:
        return
    column_defs = ", ".join(
        f"{_quote_identifier(str(column))} {_sql_type_for_series(frame[column])}"
        for column in missing
    )
    _execute_statement(f"ALTER TABLE {table.fqdn} ADD COLUMNS ({column_defs})")
    _statement_rows_cached.cache_clear()
    _table_exists_cached.cache_clear()


def _overwrite_existing_table_sql(table: TableRef, frame: pd.DataFrame, batch_size: int) -> None:
    _add_missing_table_columns_sql(table, frame)
    _execute_statement(f"DELETE FROM {table.fqdn}")
    _insert_dataframe_sql(table, frame, batch_size=batch_size)


def _write_table_df_sql(table: TableRef, frame: pd.DataFrame, mode: str, batch_size: int) -> None:
    if mode == "overwrite":
        if _table_exists_cached(table.fqdn, _statement_cache_bucket()):
            _overwrite_existing_table_sql(table, frame, batch_size=batch_size)
            return
        _execute_statement(_create_table_statement(table, frame, if_not_exists=False))
    elif mode == "append":
        _execute_statement(_create_table_statement(table, frame, if_not_exists=True))
        _add_missing_table_columns_sql(table, frame)
    else:
        raise DatabricksDataAccessError(f"Unsupported UC table write mode: {mode}")
    _insert_dataframe_sql(table, frame, batch_size=batch_size)


def write_table_df(path_or_name: str, frame: pd.DataFrame, source: str | None = None, mode: str = "overwrite") -> TableRef:
    """Write a pandas dataframe to a UC table resolved from backend/config.yaml.

    Spark is used when available. Databricks SQL is used as a fallback for
    smaller dataframes so Databricks Apps can still persist structured outputs
    without hardcoded table names.
    """
    if not uc_enabled():
        raise DatabricksDataAccessError("write_table_df requires CODEX_DATA_SOURCE=uc.")
    if not isinstance(frame, pd.DataFrame):
        raise TypeError("write_table_df expects a pandas DataFrame.")

    normalized_mode = str(mode or "overwrite").strip().lower()
    table = _resolve_table_for_write(path_or_name, source=source)
    spark = _active_spark_session()
    if spark is not None:
        spark.createDataFrame(frame).write.mode(normalized_mode).saveAsTable(table.fqdn)
    else:
        batch_size = _sql_write_batch_size(frame)
        _write_table_df_sql(table, frame, normalized_mode, batch_size=batch_size)

    discover_tables.cache_clear()
    _statement_rows_cached.cache_clear()
    return table


def _csv_header(local_file_path: str | os.PathLike[str], encoding: str) -> list[str]:
    with _ORIGINAL_OPEN(local_file_path, "r", encoding=encoding, newline="") as stream:
        header = next(csv.reader(stream), None)
    if not header:
        raise DatabricksDataAccessError(
            f"Cannot publish CSV {local_file_path}: the file does not contain a header."
        )

    columns = [str(column).lstrip("\ufeff") for column in header]
    normalized = [column.strip().lower() for column in columns]
    if any(not column for column in normalized):
        raise DatabricksDataAccessError(
            f"Cannot publish CSV {local_file_path}: every column must have a name."
        )
    if len(set(normalized)) != len(normalized):
        raise DatabricksDataAccessError(
            f"Cannot publish CSV {local_file_path}: duplicate column names are not supported."
        )
    return columns


def _csv_data_row_count(local_file_path: str | os.PathLike[str], encoding: str) -> int:
    """Count logical CSV records without loading the pipeline artifact into memory."""
    with _ORIGINAL_OPEN(local_file_path, "r", encoding=encoding, newline="") as stream:
        reader = csv.reader(stream)
        next(reader, None)
        # csv.reader preserves quoted multi-line records. Completely blank physical
        # lines are ignored by Spark's CSV reader and must not inflate this count.
        return sum(1 for row in reader if row)


def _validated_sql_count(
    statement: str,
    *,
    timeout: int,
    description: str,
) -> int:
    _columns, rows = _statement_rows_with_timeout(statement, timeout)
    if not rows or not rows[0]:
        raise DatabricksDataAccessError(
            f"Cannot validate {description}: Databricks SQL returned no count row."
        )
    try:
        return int(rows[0][0] or 0)
    except (TypeError, ValueError) as exc:
        raise DatabricksDataAccessError(
            f"Cannot validate {description}: invalid row count {rows[0][0]!r}."
        ) from exc


def write_table_csv_file(
    path_or_name: str,
    local_file_path: str | os.PathLike[str],
    source: str | None = None,
    mode: str = "overwrite",
    encoding: str = "utf-8-sig",
) -> TableRef:
    """Atomically publish a pipeline CSV to a Unity Catalog Delta table.

    The CSV is staged in the configured UC Volume and ingested with one
    CREATE OR REPLACE TABLE AS SELECT statement. This avoids hundreds of
    small INSERT statements and keeps the previous table available if the
    upload or replacement fails.
    """
    if not uc_enabled():
        raise DatabricksDataAccessError("write_table_csv_file requires CODEX_DATA_SOURCE=uc.")
    normalized_mode = str(mode or "overwrite").strip().lower()
    if normalized_mode != "overwrite":
        raise DatabricksDataAccessError(
            "Bulk CSV publication currently supports overwrite mode only."
        )

    local_path = Path(local_file_path)
    if not _ORIGINAL_EXISTS(local_path):
        raise FileNotFoundError(str(local_path))

    table = _resolve_table_for_write(path_or_name, source=source)
    columns = _csv_header(local_path, encoding=encoding)
    expected_rows = _csv_data_row_count(local_path, encoding=encoding)
    safe_table_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", table.name).strip("_") or "table"
    stage_token = uuid.uuid4().hex
    stage_path = (
        f"{_output_volume_dir()}/"
        # Databricks file sources ignore basenames beginning with '_' or '.'.
        # A hidden stage name makes read_files return zero rows without failing.
        f"codex_stage_{safe_table_name}_{stage_token}.csv"
    )
    client = _workspace_client()
    bulk_timeout = _positive_int_env(
        "CODEX_SQL_BULK_WRITE_TIMEOUT_SECONDS",
        900,
    ) or 900

    try:
        with _ORIGINAL_OPEN(local_path, "rb") as stream:
            client.files.upload(stage_path, stream, overwrite=True)

        schema_ddl = ", ".join(
            f"{_quote_identifier(column)} STRING"
            for column in columns
        )
        projection = ", ".join(_quote_identifier(column) for column in columns)
        read_files_sql = (
            "read_files("
            f"{_sql_literal(stage_path)}, "
            "format => 'csv', "
            f"schema => {_sql_literal(schema_ddl)}, "
            "header => true, "
            "multiLine => true, "
            "mode => 'FAILFAST'"
            ")"
        )
        staged_rows = _validated_sql_count(
            f"SELECT COUNT(*) AS row_count FROM {read_files_sql}",
            timeout=bulk_timeout,
            description=f"staged CSV for {table.fqdn}",
        )
        if staged_rows != expected_rows:
            raise DatabricksDataAccessError(
                f"Refusing to replace {table.fqdn}: local CSV contains {expected_rows:,} "
                f"records but Databricks staged {staged_rows:,}."
            )

        statement = (
            f"CREATE OR REPLACE TABLE {table.fqdn} USING DELTA AS "
            f"SELECT {projection} FROM {read_files_sql}"
        )
        _execute_statement(statement, timeout=bulk_timeout)

        # Use a unique SQL comment so the short-lived metadata cache cannot return
        # the pre-replacement count for this validation query.
        published_rows = _validated_sql_count(
            f"SELECT COUNT(*) AS row_count FROM {table.fqdn} "
            f"/* codex_bulk_validation_{stage_token} */",
            timeout=bulk_timeout,
            description=f"published table {table.fqdn}",
        )
        if published_rows != expected_rows:
            raise DatabricksDataAccessError(
                f"Publication validation failed for {table.fqdn}: expected "
                f"{expected_rows:,} records but found {published_rows:,}."
            )
    finally:
        try:
            client.files.delete(stage_path)
        except Exception as exc:
            if not _is_missing_volume_error(exc):
                print(f"[UC] staged pipeline CSV cleanup failed for {stage_path}: {exc}")

    discover_tables.cache_clear()
    _statement_rows_cached.cache_clear()
    _statement_rows_timeout_cached.cache_clear()
    _table_exists_cached.cache_clear()
    _workspace_table_columns.cache_clear()
    table_columns.cache_clear()
    return table


def _relative_artifact(path_or_name: str) -> str:
    path = Path(path_or_name)
    if path.is_absolute():
        for root in sorted(_ROOTS, key=lambda item: len(str(item)), reverse=True):
            try:
                return path.resolve().relative_to(root.resolve()).as_posix()
            except ValueError:
                continue
    return str(path_or_name).replace("\\", "/").lstrip("/")


def _is_configured_volume_artifact(path_or_name: object) -> bool:
    rel = _relative_artifact(str(path_or_name)).rstrip("/")
    return any(
        configured == rel
        or configured.endswith(f"/{rel}")
        or rel.endswith(f"/{configured}")
        for configured in VOLUME_ARTIFACT_RELATIVE_PATHS
    )


def _volume_candidates(path_or_name: str, for_write: bool = False) -> list[str]:
    normalized = str(path_or_name).replace("\\", "/")
    if normalized.startswith("/Volumes/"):
        return [normalized]
    rel = _relative_artifact(path_or_name)
    bases = [_output_volume_dir()] if for_write else _volume_dirs()
    rels = [rel]
    for configured_rel in sorted(VOLUME_ARTIFACT_RELATIVE_PATHS):
        if configured_rel == rel or configured_rel.endswith(f"/{rel}") or rel.endswith(f"/{configured_rel}"):
            rels.insert(0, configured_rel)
    rels = list(dict.fromkeys(rels))
    candidates = [f"{base}/{candidate_rel}" for base in bases for candidate_rel in rels]

    source = _infer_source(path_or_name)
    suffix = Path(path_or_name).suffix.lower()
    if suffix == ".json" and source:
        stem = _normalize_name(path_or_name)
        prefixes = SOURCE_PREFIXES.get(source, ())
        flattened = []
        for prefix in prefixes:
            flattened.extend([
                f"{prefix}_{stem}.json",
                f"vol_{prefix}_{stem}.json",
            ])
        source_token = "automotive" if source == "automotice" else source
        flattened.extend([
            f"{source_token}_{stem}.json",
            f"vol_{source_token}_{stem}.json",
        ])
        for base in bases:
            candidates.extend(f"{base}/{name}" for name in flattened)

    return list(dict.fromkeys(candidates))


def _volume_cache_bucket() -> int:
    try:
        ttl = int(os.getenv("CODEX_UC_VOLUME_CACHE_SECONDS", "300"))
    except ValueError:
        ttl = 300
    if ttl <= 0:
        return int(time.time() * 1000)
    return int(time.time() // ttl)


def _volume_download(path: str) -> bytes:
    return _volume_download_cached(path, _volume_cache_bucket())


@lru_cache(maxsize=256)
def _volume_download_cached(path: str, _cache_bucket: int) -> bytes:
    response = _workspace_client().files.download(path)
    contents = getattr(response, "contents", response)
    return contents.read()


def volume_exists(path_or_name: str) -> bool:
    last_nonmissing_error = None
    for candidate in _volume_candidates(path_or_name):
        try:
            _volume_download(candidate)
            return True
        except Exception as exc:
            if not _is_missing_volume_error(exc):
                last_nonmissing_error = exc
    if last_nonmissing_error is not None:
        raise DatabricksDataAccessError(
            f"Unable to access UC Volume artifact {path_or_name}: {last_nonmissing_error}"
        ) from last_nonmissing_error
    return False


def read_volume_text(path_or_name: str, encoding: str = "utf-8", required: bool = True) -> str:
    last_error = None
    for candidate in _volume_candidates(path_or_name):
        try:
            return _volume_download(candidate).decode(encoding)
        except Exception as exc:
            last_error = exc
    if required:
        raise DatabricksDataAccessError(f"No UC Volume artifact found for {path_or_name}: {last_error}")
    return ""


def write_volume_text(path_or_name: str, text: str, encoding: str = "utf-8") -> int:
    target = _volume_candidates(path_or_name, for_write=True)[0]
    client = _workspace_client()
    payload = io.BytesIO(text.encode(encoding))
    client.files.upload(target, payload, overwrite=True)
    _volume_download_cached.cache_clear()
    return len(text)


def delete_volume_file(path_or_name: str, missing_ok: bool = False) -> None:
    client = _workspace_client()
    deleted = False
    last_error = None
    last_nonmissing_error = None
    for candidate in _volume_candidates(path_or_name):
        try:
            client.files.delete(candidate)
            deleted = True
        except Exception as exc:
            last_error = exc
            if not _is_missing_volume_error(exc):
                last_nonmissing_error = exc
    _volume_download_cached.cache_clear()
    if not deleted and last_nonmissing_error is not None:
        raise DatabricksDataAccessError(
            f"Unable to delete UC Volume artifact {path_or_name}: {last_nonmissing_error}"
        ) from last_nonmissing_error
    if not deleted and not missing_ok:
        raise FileNotFoundError(f"No UC Volume artifact found for {path_or_name}: {last_error}")


def list_volume_json(path_or_dir: str) -> list[Path]:
    rel = _relative_artifact(path_or_dir).rstrip("/")
    paths: list[Path] = []
    last_nonmissing_error = None
    for base in _volume_dirs():
        volume_dir = f"{base}/{rel}"
        try:
            entries = _workspace_client().files.list_directory_contents(volume_dir)
            for entry in entries:
                path = str(getattr(entry, "path", ""))
                if path.lower().endswith(".json"):
                    paths.append(Path(path))
        except Exception as exc:
            if not _is_missing_volume_error(exc):
                last_nonmissing_error = exc
    if not paths and last_nonmissing_error is not None:
        raise DatabricksDataAccessError(
            f"Unable to list UC Volume directory {path_or_dir}: {last_nonmissing_error}"
        ) from last_nonmissing_error
    return sorted(paths, key=lambda p: p.name)


def _table_paths_for_dir(directory: Path) -> list[Path]:
    parts = {part.lower() for part in directory.parts}
    paths: list[Path] = []
    for table in discover_tables():
        table_name = _normalize_name(table.name)
        if "enrichment" in parts and not table_name.startswith(("2p_", "3p_", "ml_")):
            continue
        paths.append(directory / f"{table.name}")
    return paths


def _is_known_extensionless_table_name(name: str) -> bool:
    normalized = _normalize_name(name)
    if not normalized:
        return False
    known = {_normalize_name(item) for item in KNOWN_DATA_FILES}
    known.discard("")
    if normalized in known:
        return True

    prefixes = {prefix for values in SOURCE_PREFIXES.values() for prefix in values}
    prefixes.update(SOURCE_PREFIXES.keys())
    candidates = {normalized}
    for layer in OUTPUT_LAYERS:
        if normalized.startswith(f"{layer}_"):
            candidates.add(normalized[len(layer) + 1:])
    for candidate in list(candidates):
        for prefix in prefixes:
            if candidate.startswith(f"{prefix}_"):
                candidates.add(candidate[len(prefix) + 1:])
    return bool(candidates & known)


def _is_data_artifact(path_or_name: object) -> bool:
    path = Path(path_or_name)
    if _is_configured_volume_artifact(path):
        return True
    suffix = path.suffix.lower()
    parts = [part.lower() for part in path.parts]
    name = path.name.lower()
    is_known_data_dir = any(part in DATA_DIRECTORIES for part in parts) or (
        "data" in parts and {"journeys", "customjourneys", "customsegments"}.intersection(parts)
    )
    if not suffix:
        return is_known_data_dir or _is_known_extensionless_table_name(name)
    if suffix not in CSV_SUFFIXES | JSON_SUFFIXES:
        return False
    if name in KNOWN_DATA_FILES:
        return True
    if is_known_data_dir:
        return True
    if "data" in parts and suffix == ".json" and {"journeys", "customjourneys", "customsegments"}.intersection(parts):
        return True
    return False


def _is_virtual_data_dir(path_or_name: object) -> bool:
    path = Path(path_or_name)
    if path.suffix:
        return False
    parts = [part.lower() for part in path.parts]
    name = path.name.lower()
    source_names = set(SOURCE_PREFIXES)
    virtual_names = DATA_DIRECTORIES | source_names | {
        "enrichment",
        "enriched",
        "ai_segments",
    }
    if name in virtual_names:
        return True
    if "data" in parts and name in {"journeys", "customjourneys", "customsegments"}:
        return True
    return False


def _is_extensionless_table_artifact(path_or_name: object) -> bool:
    path = Path(path_or_name)
    if path.suffix or _is_virtual_data_dir(path):
        return False
    parts = [part.lower() for part in path.parts]
    name = path.name.lower()
    return _is_known_extensionless_table_name(name) or any(part in DATA_DIRECTORIES for part in parts)

def _is_table_artifact(path_or_name: object) -> bool:
    path = Path(path_or_name)
    if _is_configured_volume_artifact(path):
        return False
    if _is_virtual_data_dir(path):
        return False
    if path.suffix.lower() == ".csv":
        path = path.with_suffix("")
    return _is_extensionless_table_artifact(path)


def _open_compat(file, mode="r", buffering=-1, encoding=None, errors=None, newline=None, closefd=True, opener=None):
    if not uc_enabled() or not _is_data_artifact(file):
        return _ORIGINAL_OPEN(file, mode, buffering, encoding, errors, newline, closefd, opener)
    suffix = Path(file).suffix.lower()
    is_volume_artifact = _is_configured_volume_artifact(file)
    text_mode = "b" not in mode
    if any(flag in mode for flag in ("w", "a", "x")):
        if not is_volume_artifact and suffix in CSV_SUFFIXES and _is_table_artifact(file):
            write_mode = "append" if "a" in mode else "overwrite"
            return _TableWriteBuffer(file, encoding or "utf-8", mode=write_mode)
        return _VolumeWriteBuffer(file, encoding or "utf-8")
    if not is_volume_artifact and suffix in CSV_SUFFIXES:
        text = read_table_csv_text(str(file), source=_infer_source(str(file)), required=True)
    else:
        text = read_volume_text(str(file), encoding=encoding or "utf-8", required=True)
    if text_mode:
        return io.StringIO(text, newline=newline)
    return io.BytesIO(text.encode(encoding or "utf-8"))


class _VolumeWriteBuffer(io.StringIO):
    def __init__(self, path, encoding: str):
        super().__init__()
        self._path = path
        self._encoding = encoding

    def close(self) -> None:
        if not self.closed:
            write_volume_text(str(self._path), self.getvalue(), encoding=self._encoding)
        super().close()


class _TableWriteBuffer(io.StringIO):
    def __init__(self, path, encoding: str, mode: str = "overwrite"):
        super().__init__()
        self._path = path
        self._encoding = encoding
        self._mode = mode

    def close(self) -> None:
        if not self.closed:
            text = self.getvalue()
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
            frame = pd.DataFrame(rows, columns=reader.fieldnames or None)
            write_table_df(str(self._path), frame, source=_infer_source(str(self._path)), mode=self._mode)
        super().close()


def _exists_compat(self: Path) -> bool:
    if not uc_enabled() or not _is_data_artifact(self):
        return _ORIGINAL_EXISTS(self)
    if _is_configured_volume_artifact(self):
        return volume_exists(str(self))
    suffix = self.suffix.lower()
    if suffix in CSV_SUFFIXES:
        if _is_virtual_data_dir(self):
            return True
        if self.name == "":
            return True
        if _is_table_artifact(self):
            try:
                return table_exists(str(self))
            except Exception as exc:
                if _is_missing_table_error(exc):
                    return False
                raise
        if any(part.lower() in DATA_DIRECTORIES for part in self.parts):
            return False

        return False
    
    if suffix in JSON_SUFFIXES:
        return volume_exists(str(self))
    return False


def _is_file_compat(self: Path) -> bool:
    if uc_enabled() and _is_data_artifact(self):
        if _is_virtual_data_dir(self):
            return False
        if _is_table_artifact(self):
            return _exists_compat(self)
        if self.suffix.lower() in JSON_SUFFIXES:
            return _exists_compat(self)
        return _exists_compat(self)
    return _ORIGINAL_IS_FILE(self)


def _read_text_compat(self: Path, encoding=None, errors=None) -> str:
    if not uc_enabled() or not _is_data_artifact(self):
        return _ORIGINAL_READ_TEXT(self, encoding=encoding, errors=errors)
    if _is_configured_volume_artifact(self) or self.suffix.lower() in JSON_SUFFIXES:
        return read_volume_text(str(self), encoding=encoding or "utf-8", required=True)
    return read_table_csv_text(str(self), source=_infer_source(str(self)), required=True)


def _write_text_compat(self: Path, data: str, encoding=None, errors=None, newline=None) -> int:
    if not uc_enabled() or not _is_data_artifact(self):
        return _ORIGINAL_WRITE_TEXT(self, data, encoding=encoding, errors=errors, newline=newline)
    return write_volume_text(str(self), data, encoding=encoding or "utf-8")


def _unlink_compat(self: Path, missing_ok: bool = False) -> None:
    if not uc_enabled() or not _is_data_artifact(self):
        return _ORIGINAL_UNLINK(self, missing_ok=missing_ok)
    if _is_configured_volume_artifact(self) or self.suffix.lower() in JSON_SUFFIXES:
        delete_volume_file(str(self), missing_ok=missing_ok)
        return
    return _ORIGINAL_UNLINK(self, missing_ok=missing_ok)


def _mkdir_compat(
    self: Path,
    mode: int = 0o777,
    parents: bool = False,
    exist_ok: bool = False,
) -> None:
    if uc_enabled() and _is_virtual_data_dir(self):
        return None
    return _ORIGINAL_MKDIR(
        self,
        mode=mode,
        parents=parents,
        exist_ok=exist_ok,
    )


def _is_table_glob_pattern(pattern: str) -> bool:
    probe = Path(str(pattern).replace("\\", "/").replace("*", "x").replace("?", "x")).name
    return bool(probe) and Path(probe).suffix == ""


def _table_glob_prefix(pattern: str) -> str:
    name = Path(str(pattern).replace("\\", "/")).name
    return name.replace("*", "").replace("?", "").lower()


def _glob_compat(self: Path, pattern: str, *args, **kwargs) -> Iterable[Path]:
    if not uc_enabled() or not _is_data_artifact(self / pattern):
        return _ORIGINAL_GLOB(self, pattern, *args, **kwargs)
    if pattern.lower().endswith(".json"):
        return iter(list_volume_json(str(self)))
    if _is_table_glob_pattern(pattern):
        prefix = _table_glob_prefix(pattern)
        paths = []
        for table in discover_tables():
            if table.name.lower().startswith(prefix.lower()):
                paths.append(self / f"{table.name}")
        return iter(paths)
    return iter(())


def _rglob_compat(self: Path, pattern: str, *args, **kwargs) -> Iterable[Path]:
    if not uc_enabled() or not _is_data_artifact(self):
        return _ORIGINAL_RGLOB(self, pattern, *args, **kwargs)
    if pattern.lower().endswith(".json"):
        return _glob_compat(self, pattern, *args, **kwargs)
    if _is_table_glob_pattern(pattern):
        return _glob_compat(self, pattern, *args, **kwargs)
    return iter(())


def _iterdir_compat(self: Path) -> Iterable[Path]:
    if not uc_enabled() or not _is_data_artifact(self):
        return _ORIGINAL_ITERDIR(self)
    paths = _table_paths_for_dir(self)
    paths.extend(list_volume_json(str(self)))
    return iter(paths)


def install_databricks_compat(app_root: Path, extra_roots: Iterable[Path] = ()) -> None:
    global _INSTALLED, _ROOTS, _APP_ROOT
    if _INSTALLED:
        return
    _APP_ROOT = app_root.resolve()
    roots = [_APP_ROOT, *[Path(root).resolve() for root in extra_roots]]
    _ROOTS = tuple(dict.fromkeys(roots))
    builtins.open = _open_compat
    Path.exists = _exists_compat
    Path.is_file = _is_file_compat
    Path.read_text = _read_text_compat
    Path.write_text = _write_text_compat
    Path.unlink = _unlink_compat
    Path.mkdir = _mkdir_compat
    Path.glob = _glob_compat
    Path.rglob = _rglob_compat
    Path.iterdir = _iterdir_compat
    pd.read_csv = pandas_read_csv
    _INSTALLED = True


def pandas_read_csv(path_or_buffer, *args, **kwargs) -> pd.DataFrame:
    if uc_enabled() and isinstance(path_or_buffer, (str, os.PathLike)) and _is_data_artifact(path_or_buffer):
        path_text = str(path_or_buffer)
        source = _infer_source(path_text)
        usecols = kwargs.get("usecols")
        selected_columns = None
        if kwargs.get("nrows") == 0 or usecols is not None:
            table = resolve_table(path_text, source=source, required=True)
            columns = _workspace_table_columns(table)
            if callable(usecols):
                selected_columns = [
                    column for column in columns if usecols(column)
                ]
            elif usecols is not None:
                requested = {str(column) for column in usecols}
                missing = requested.difference(columns)
                if missing:
                    raise ValueError(
                        "Usecols do not match columns, columns expected but not found: "
                        f"{sorted(missing)}"
                    )
                selected_columns = [
                    column for column in columns if column in requested
                ]
            else:
                selected_columns = columns
        if kwargs.get("nrows") == 0:
            return pd.DataFrame(columns=selected_columns or [])
        return read_table_df(
            path_text,
            source=source,
            required=True,
            columns=selected_columns,
        )
    return _ORIGINAL_PANDAS_READ_CSV(path_or_buffer, *args, **kwargs)


def json_load(path_or_name: str, default=None):
    text = read_volume_text(path_or_name, required=False)
    if not text.strip():
        return default
    return json.loads(text)


def csv_dict_rows(path_or_name: str, source: str | None = None, required: bool = False) -> list[dict]:
    text = read_table_csv_text(path_or_name, source=source, required=required)
    if not text.strip():
        return []
    return list(csv.DictReader(io.StringIO(text)))
