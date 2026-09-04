from dataclasses import dataclass
import threading
import time
from typing import Any

from databricks import sql


class DatabricksConnectorError(Exception):
    pass


_METADATA_CACHE: dict[tuple[str, str, str], tuple[float, tuple[list[str], list[tuple[Any, ...]]]]] = {}
_METADATA_CACHE_LOCK = threading.Lock()
_METADATA_CACHE_SECONDS = 300


@dataclass
class DatabricksConfig:
    server_hostname: str
    http_path: str
    pat_token: str


def _normalize_required(value: str, field_name: str) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        raise DatabricksConnectorError(f"Missing required field: {field_name}")
    if field_name == "server_hostname":
        cleaned = cleaned.removeprefix("https://").removeprefix("http://").rstrip("/")
    return cleaned


def _normalize_identifier(value: str, field_name: str) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        raise DatabricksConnectorError(f"Missing required field: {field_name}")
    return cleaned


def config_from_payload(payload: dict[str, Any] | None) -> DatabricksConfig:
    body = payload or {}
    if str(body.get("connection_mode") or "").strip().lower() == "runtime":
        try:
            from databricks.sdk import WorkspaceClient
            from databricks_uc_io import configured_warehouse_id

            client = WorkspaceClient()
            warehouse_id = configured_warehouse_id()
            if not warehouse_id:
                raise DatabricksConnectorError(
                    "No Databricks SQL warehouse is configured for the App runtime."
                )
            headers = client.config.authenticate()
            authorization = str(headers.get("Authorization") or "")
            token = authorization.removeprefix("Bearer ").strip()
            if not token:
                raise DatabricksConnectorError(
                    "The Databricks App identity did not provide an OAuth access token."
                )
            return DatabricksConfig(
                server_hostname=_normalize_required(client.config.host, "server_hostname"),
                http_path=f"/sql/1.0/warehouses/{warehouse_id}",
                pat_token=token,
            )
        except DatabricksConnectorError:
            raise
        except Exception as exc:
            raise DatabricksConnectorError(
                f"Unable to initialize the Databricks App runtime connection: {exc}"
            ) from exc
    return DatabricksConfig(
        server_hostname=_normalize_required(body.get("server_hostname") or body.get("workspace_url"), "server_hostname"),
        http_path=_normalize_required(body.get("http_path"), "http_path"),
        pat_token=_normalize_required(body.get("pat_token"), "pat_token"),
    )


def quote_ident(value: str) -> str:
    cleaned = _normalize_identifier(value, "identifier")
    return f"`{cleaned.replace('`', '``')}`"


def _connect(config: DatabricksConfig):
    try:
        return sql.connect(
            server_hostname=config.server_hostname,
            http_path=config.http_path,
            access_token=config.pat_token,
            user_agent_entry="cdp-copilot-databricks",
        )
    except Exception as exc:
        raise DatabricksConnectorError(f"Unable to connect to Databricks: {exc}") from exc


def _run_query(config: DatabricksConfig, statement: str, parameters: list[Any] | None = None) -> tuple[list[str], list[tuple[Any, ...]]]:
    try:
        with _connect(config) as connection:
            with connection.cursor() as cursor:
                if parameters:
                    cursor.execute(statement, parameters=parameters)
                else:
                    cursor.execute(statement)
                rows = cursor.fetchall()
                columns = [desc[0] for desc in (cursor.description or [])]
                return columns, rows
    except DatabricksConnectorError:
        raise
    except Exception as exc:
        raise DatabricksConnectorError(f"Databricks query failed: {exc}") from exc


def _run_metadata_query(
    config: DatabricksConfig,
    statement: str,
) -> tuple[list[str], list[tuple[Any, ...]]]:
    key = (config.server_hostname.lower(), config.http_path.lower(), statement)
    now = time.monotonic()
    with _METADATA_CACHE_LOCK:
        cached = _METADATA_CACHE.get(key)
        if cached and now - cached[0] < _METADATA_CACHE_SECONDS:
            columns, rows = cached[1]
            return list(columns), list(rows)
    result = _run_query(config, statement)
    with _METADATA_CACHE_LOCK:
        _METADATA_CACHE[key] = (now, result)
        if len(_METADATA_CACHE) > 128:
            oldest = sorted(_METADATA_CACHE, key=lambda item: _METADATA_CACHE[item][0])[:32]
            for old_key in oldest:
                _METADATA_CACHE.pop(old_key, None)
    return result


def list_catalogs(config: DatabricksConfig) -> list[str]:
    columns, rows = _run_metadata_query(config, "SHOW CATALOGS")
    idx = columns.index("catalog") if "catalog" in columns else 0
    return [str(row[idx]) for row in rows if len(row) > idx and row[idx] is not None]


def list_schemas(config: DatabricksConfig, catalog: str) -> list[str]:
    columns, rows = _run_metadata_query(config, f"SHOW SCHEMAS IN {quote_ident(catalog)}")
    candidates = ["databaseName", "namespace", "schemaName"]
    idx = next((columns.index(name) for name in candidates if name in columns), 0)
    return [str(row[idx]) for row in rows if len(row) > idx and row[idx] is not None]


def list_tables(config: DatabricksConfig, catalog: str, schema: str) -> list[dict[str, str]]:
    columns, rows = _run_metadata_query(
        config,
        f"SHOW TABLES IN {quote_ident(catalog)}.{quote_ident(schema)}",
    )
    name_idx = columns.index("tableName") if "tableName" in columns else 1 if len(columns) > 1 else 0
    temp_idx = columns.index("isTemporary") if "isTemporary" in columns else None
    tables = []
    for row in rows:
        name = str(row[name_idx]) if len(row) > name_idx else ""
        if not name:
            continue
        is_temp = bool(row[temp_idx]) if temp_idx is not None and len(row) > temp_idx else False
        tables.append({"name": name, "type": "TEMP" if is_temp else "TABLE"})
    return tables


def preview_table(config: DatabricksConfig, catalog: str, schema: str, table: str, limit: int = 50) -> tuple[list[str], list[dict[str, Any]]]:
    limited = max(1, min(int(limit), 200))
    statement = f"SELECT * FROM {quote_ident(catalog)}.{quote_ident(schema)}.{quote_ident(table)} LIMIT ?"
    columns, rows = _run_query(config, statement, [limited])
    return columns, [dict(zip(columns, row)) for row in rows]


def fetch_table_rows(
    config: DatabricksConfig,
    catalog: str,
    schema: str,
    table: str,
    limit: int | None = None,
) -> tuple[list[str], list[dict[str, Any]]]:
    statement = f"SELECT * FROM {quote_ident(catalog)}.{quote_ident(schema)}.{quote_ident(table)}"
    parameters = None
    if limit is not None:
        statement += " LIMIT ?"
        parameters = [max(1, int(limit))]
    columns, rows = _run_query(config, statement, parameters)
    return columns, [dict(zip(columns, row)) for row in rows]


def table_summary(
    config: DatabricksConfig,
    catalog: str,
    schema: str,
    table: str,
) -> tuple[list[str], int]:
    """Return source columns and row count without downloading the table."""
    marker = "__codex_row_count"
    statement = (
        f"SELECT *, COUNT(*) OVER() AS {quote_ident(marker)} "
        f"FROM {quote_ident(catalog)}.{quote_ident(schema)}.{quote_ident(table)} LIMIT 1"
    )
    columns, rows = _run_query(config, statement)
    lower_columns = [str(column).lower() for column in columns]
    count_index = lower_columns.index(marker) if marker in lower_columns else None
    output_columns = [
        column
        for index, column in enumerate(columns)
        if count_index is None or index != count_index
    ]
    row_count = int(rows[0][count_index] or 0) if rows and count_index is not None else 0
    return output_columns, row_count
