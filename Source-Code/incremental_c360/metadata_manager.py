from __future__ import annotations

import fnmatch
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class TableMetadata:
    catalog: str
    schema: str
    table: str
    table_type: str
    comment: str | None
    columns: list[dict[str, Any]]
    primary_keys: list[str]
    candidate_keys: list[list[str]]
    created_columns: list[str]
    updated_columns: list[str]
    audit_columns: list[str]
    watermark_columns: list[str]
    relationships: list[dict[str, Any]]
    domain: str | None = None
    category: str | None = None

    @property
    def fqtn(self) -> str:
        return ".".join(quote_identifier(part) for part in (self.catalog, self.schema, self.table))

    @property
    def raw_name(self) -> str:
        return f"{self.catalog}.{self.schema}.{self.table}"


def quote_identifier(value: str) -> str:
    return "`" + value.replace("`", "``") + "`"


def load_config(path: str | Path | None = None) -> dict[str, Any]:
    config_path = Path(path) if path else Path(__file__).with_name("config.yaml")
    with config_path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def active_domains(config: dict[str, Any]) -> list[str]:
    return [
        name
        for name, domain_config in (config.get("domains") or {}).items()
        if bool(domain_config.get("enabled", False))
    ]


def matches_any(value: str, patterns: list[str] | tuple[str, ...] | None) -> bool:
    if not patterns:
        return True
    text = value.lower()
    return any(fnmatch.fnmatch(text, str(pattern).lower()) for pattern in patterns)


class SqlRunner:
    """Small SQL facade shared by Databricks notebooks and local runs."""

    def __init__(self, config: dict[str, Any], spark_session=None):
        self.config = config
        self._spark = spark_session
        self._spark_checked = spark_session is not None
        self._spark_init_error: Exception | None = None
        self._connection = None

    @property
    def spark(self):
        if self._spark is not None:
            return self._spark
        if self._spark_checked:
            return None
        self._spark_checked = True
        try:
            from pyspark.sql import SparkSession

            active_session = SparkSession.getActiveSession()
            self._spark = active_session if active_session is not None else SparkSession.builder.getOrCreate()
        except Exception as exc:
            self._spark_init_error = exc
            self._spark = None
        return self._spark

    def sql(self, statement: str):
        spark = self.spark
        if spark is not None:
            return spark.sql(statement)
        if self._is_databricks_mode():
            detail = (
                f" Spark initialization error: {type(self._spark_init_error).__name__}: "
                f"{self._spark_init_error}"
                if self._spark_init_error is not None
                else " No active Spark session was visible to this Python process."
            )
            raise RuntimeError(
                "Databricks mode requires a Spark-enabled Databricks cluster or job cluster. "
                "Run main.py as a Databricks Python file task on cluster compute, not from a SQL warehouse "
                "or through `%sh python main.py`, because those launch a separate process. "
                "For local execution, set environment.mode=local and provide DATABRICKS_HOST, "
                f"DATABRICKS_TOKEN, and DATABRICKS_WAREHOUSE_ID.{detail}"
            )
        cursor = self._cursor()
        cursor.execute(statement)
        rows = cursor.fetchall()
        cols = [desc[0] for desc in cursor.description] if cursor.description else []
        import pandas as pd

        return pd.DataFrame(rows, columns=cols)

    def table(self, fqtn: str):
        spark = self.spark
        if spark is None:
            return self.sql(f"SELECT * FROM {fqtn}")
        return spark.table(fqtn)

    def create_dataframe(self, rows: list[dict[str, Any]], schema=None):
        spark = self.spark
        if spark is not None:
            return spark.createDataFrame(rows, schema=schema)
        import pandas as pd

        return pd.DataFrame(rows)

    def _cursor(self):
        if self._connection is None:
            from databricks import sql as dbsql

            dbx = self.config.get("databricks") or {}
            host = os.getenv(dbx.get("host_env", "DATABRICKS_HOST"), "").replace("https://", "")
            token = os.getenv(dbx.get("token_env", "DATABRICKS_TOKEN"), "")
            warehouse_id = os.getenv(dbx.get("warehouse_id_env", "DATABRICKS_WAREHOUSE_ID"), "")
            if not host or not token or not warehouse_id:
                raise RuntimeError("Local mode requires DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_WAREHOUSE_ID.")
            self._connection = dbsql.connect(server_hostname=host, http_path=f"/sql/1.0/warehouses/{warehouse_id}", access_token=token)
        return self._connection.cursor()

    def _is_databricks_mode(self) -> bool:
        mode = str((self.config.get("environment") or {}).get("mode", "")).strip().lower()
        return mode == "databricks" or bool(os.getenv("DATABRICKS_RUNTIME_VERSION"))


def ensure_metadata_schema(runner: SqlRunner, config: dict[str, Any]) -> None:
    schema = config.get("databricks", {}).get("metadata_schema", "c360_ops")
    catalogs = runner.sql("SHOW CATALOGS")
    if hasattr(catalogs, "collect"):
        first_catalog = catalogs.collect()[0][0]
    else:
        first_catalog = catalogs.iloc[0, 0]
    runner.sql(f"CREATE SCHEMA IF NOT EXISTS {quote_identifier(first_catalog)}.{quote_identifier(schema)}")


def metadata_table_name(config: dict[str, Any], logical_name: str) -> str:
    audit = config.get("audit") or {}
    generation = config.get("generation") or {}
    dbx = config.get("databricks") or {}
    catalog = (
        os.getenv("DATABRICKS_CATALOG", "").strip()
        or os.getenv("C360_CATALOG", "").strip()
        or str(dbx.get("catalog", "")).strip()
    )
    schema = dbx.get("metadata_schema", "c360_ops")
    table = audit.get(logical_name) or generation.get(logical_name) or logical_name
    if not catalog:
        raise RuntimeError(
            "Catalog is required. Set databricks.catalog in config.yaml or set "
            "DATABRICKS_CATALOG/C360_CATALOG. Expected for this environment: cmegtmdev."
        )
    return ".".join(quote_identifier(part) for part in (catalog, schema, table))

