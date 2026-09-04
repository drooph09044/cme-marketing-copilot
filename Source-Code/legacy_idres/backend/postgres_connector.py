from dataclasses import dataclass
from typing import Any

import psycopg


class PostgresConnectorError(Exception):
    pass


@dataclass
class PostgresConfig:
    host: str
    port: int
    database: str
    username: str
    password: str
    sslmode: str = "prefer"


def _required(value: Any, field_name: str) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        raise PostgresConnectorError(f"Missing required field: {field_name}")
    return cleaned


def config_from_payload(payload: dict[str, Any] | None) -> PostgresConfig:
    body = payload or {}
    return PostgresConfig(
        host=_required(body.get("host"), "host"),
        port=int(body.get("port") or 5432),
        database=_required(body.get("database"), "database"),
        username=_required(body.get("username"), "username"),
        password=_required(body.get("password"), "password"),
        sslmode=str(body.get("sslmode") or "prefer").strip() or "prefer",
    )


def quote_ident(value: str) -> str:
    cleaned = _required(value, "identifier")
    return '"' + cleaned.replace('"', '""') + '"'


def _connect(config: PostgresConfig):
    try:
        return psycopg.connect(
            host=config.host,
            port=config.port,
            dbname=config.database,
            user=config.username,
            password=config.password,
            sslmode=config.sslmode,
        )
    except Exception as exc:
        raise PostgresConnectorError(f"Unable to connect to PostgreSQL: {exc}") from exc


def _run_query(config: PostgresConfig, statement: str, params: tuple[Any, ...] | None = None) -> tuple[list[str], list[tuple[Any, ...]]]:
    try:
        with _connect(config) as connection:
            with connection.cursor() as cursor:
                cursor.execute(statement, params or ())
                rows = cursor.fetchall()
                columns = [desc.name for desc in (cursor.description or [])]
                return columns, rows
    except PostgresConnectorError:
        raise
    except Exception as exc:
        raise PostgresConnectorError(f"PostgreSQL query failed: {exc}") from exc


def test_connection(config: PostgresConfig) -> dict[str, Any]:
    columns, rows = _run_query(config, "SELECT current_database() AS database_name")
    return {"database": rows[0][0] if rows else config.database, "columns": columns}


def list_schemas(config: PostgresConfig) -> list[str]:
    _, rows = _run_query(
        config,
        """
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
        ORDER BY schema_name
        """,
    )
    return [str(row[0]) for row in rows]


def list_tables(config: PostgresConfig, schema: str) -> list[dict[str, str]]:
    _, rows = _run_query(
        config,
        """
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = %s
        ORDER BY table_name
        """,
        (schema,),
    )
    return [{"name": str(row[0]), "type": str(row[1])} for row in rows]


def preview_table(config: PostgresConfig, schema: str, table: str, limit: int = 10) -> tuple[list[str], list[dict[str, Any]]]:
    statement = f"SELECT * FROM {quote_ident(schema)}.{quote_ident(table)} LIMIT %s"
    columns, rows = _run_query(config, statement, (max(1, min(int(limit), 200)),))
    return columns, [dict(zip(columns, row)) for row in rows]


def fetch_table_rows(config: PostgresConfig, schema: str, table: str, limit: int | None = None) -> tuple[list[str], list[dict[str, Any]]]:
    statement = f"SELECT * FROM {quote_ident(schema)}.{quote_ident(table)}"
    params: tuple[Any, ...] = ()
    if limit is not None:
        statement += " LIMIT %s"
        params = (max(1, int(limit)),)
    columns, rows = _run_query(config, statement, params)
    return columns, [dict(zip(columns, row)) for row in rows]
