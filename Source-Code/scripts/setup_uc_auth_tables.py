"""Create and seed the governed Unity Catalog authentication tables.

The command is dry-run by default.  Pass ``--apply`` to execute DDL/MERGE
statements.  Seed passwords are read from per-role environment variables or a
masked one-time prompt; plaintext passwords are never accepted as arguments or
written to disk.
"""

from __future__ import annotations

import argparse
import getpass
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Iterable

from werkzeug.security import generate_password_hash


IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@dataclass(frozen=True)
class SeedUser:
    id: str
    username: str
    full_name: str
    email: str
    role: str
    role_label: str


DEMO_USERS = (
    SeedUser("1", "platform.admin", "Platform Administrator", "platform.admin@exl.com", "PLATFORM_ADMIN", "MarTech Product Owner (Platform Admin)"),
    SeedUser("2", "data.engineer", "Data Engineer", "data.engineer@exl.com", "DATA_IDENTITY_OPERATOR", "Data Engineer (Data & Identity Operator)"),
    SeedUser("3", "planner", "Planner", "planner@exl.com", "PLANNER", "Planning Specialist / Strategist (Planner)"),
    SeedUser("4", "campaign.producer", "Campaign Producer", "campaign.producer@exl.com", "CAMPAIGN_PRODUCER", "Campaign Producer (Campaign Builder / Operator)"),
    SeedUser("5", "production.lead", "Production Lead", "production.lead@exl.com", "PRODUCTION_LEAD", "Production Lead (Approver / Release Manager)"),
    SeedUser("6", "production.specialist", "Production Specialist", "production.specialist@exl.com", "PRODUCTION_SPECIALIST", "Production Specialist (Activation Executor)"),
    SeedUser("7", "insights.manager", "Insights Manager", "insights.manager@exl.com", "INSIGHTS_MANAGER", "Insights Manager (Measurement)"),
)


TABLE_COLUMNS = {
    "users": (
        "id", "username", "full_name", "email", "role", "role_label",
        "password_hash", "is_active", "created_at_utc", "updated_at_utc",
    ),
    "auth_sessions": (
        "event_id", "jti", "user_id", "username", "email", "role",
        "role_label", "status", "event_at_utc", "expires_at_utc",
        "ip_address", "app_name",
    ),
    "auth_logs": (
        "event_id", "event", "timestamp_utc", "user_id", "username",
        "email", "role", "role_label", "ip_address", "jti", "app_name",
    ),
}


def quote_identifier(value: str) -> str:
    if not IDENTIFIER_RE.fullmatch(str(value or "")):
        raise ValueError(f"Invalid Unity Catalog identifier: {value!r}")
    return f"`{value}`"


def table_name(catalog: str, schema: str, table: str) -> str:
    return ".".join(quote_identifier(part) for part in (catalog, schema, table))


def sql_literal(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def create_table_statements(catalog: str, schema: str) -> tuple[str, ...]:
    users = table_name(catalog, schema, "users")
    sessions = table_name(catalog, schema, "auth_sessions")
    logs = table_name(catalog, schema, "auth_logs")
    return (
        f"""CREATE TABLE IF NOT EXISTS {users} (
  id STRING NOT NULL,
  username STRING NOT NULL,
  full_name STRING,
  email STRING NOT NULL,
  role STRING NOT NULL,
  role_label STRING,
  password_hash STRING NOT NULL,
  is_active BOOLEAN NOT NULL,
  created_at_utc TIMESTAMP NOT NULL,
  updated_at_utc TIMESTAMP NOT NULL
) USING DELTA COMMENT 'Application users with one-way password hashes'""",
        f"""CREATE TABLE IF NOT EXISTS {sessions} (
  event_id STRING NOT NULL,
  jti STRING NOT NULL,
  user_id STRING NOT NULL,
  username STRING NOT NULL,
  email STRING NOT NULL,
  role STRING NOT NULL,
  role_label STRING,
  status STRING NOT NULL,
  event_at_utc TIMESTAMP NOT NULL,
  expires_at_utc TIMESTAMP NOT NULL,
  ip_address STRING,
  app_name STRING NOT NULL
) USING DELTA COMMENT 'Append-only application authentication session events'""",
        f"""CREATE TABLE IF NOT EXISTS {logs} (
  event_id STRING NOT NULL,
  event STRING NOT NULL,
  timestamp_utc TIMESTAMP NOT NULL,
  user_id STRING NOT NULL,
  username STRING NOT NULL,
  email STRING NOT NULL,
  role STRING NOT NULL,
  role_label STRING,
  ip_address STRING,
  jti STRING,
  app_name STRING NOT NULL
) USING DELTA COMMENT 'Append-only application authentication audit events'""",
    )


def user_merge_statement(catalog: str, schema: str, user: SeedUser, password_hash: str) -> str:
    target = table_name(catalog, schema, "users")
    values = {
        "id": user.id,
        "username": user.username.lower(),
        "full_name": user.full_name,
        "email": user.email.lower(),
        "role": user.role,
        "role_label": user.role_label,
        "password_hash": password_hash,
    }
    source = ",\n    ".join(
        f"{sql_literal(value)} AS {quote_identifier(column)}"
        for column, value in values.items()
    )
    return f"""MERGE INTO {target} AS target
USING (
  SELECT
    {source},
    TRUE AS `is_active`,
    current_timestamp() AS `created_at_utc`,
    current_timestamp() AS `updated_at_utc`
) AS source
ON lower(target.email) = lower(source.email)
WHEN MATCHED THEN UPDATE SET
  target.id = source.id,
  target.username = source.username,
  target.full_name = source.full_name,
  target.role = source.role,
  target.role_label = source.role_label,
  target.password_hash = source.password_hash,
  target.is_active = TRUE,
  target.updated_at_utc = current_timestamp()
WHEN NOT MATCHED THEN INSERT (
  id, username, full_name, email, role, role_label, password_hash,
  is_active, created_at_utc, updated_at_utc
) VALUES (
  source.id, source.username, source.full_name, source.email, source.role,
  source.role_label, source.password_hash, TRUE, current_timestamp(), current_timestamp()
)"""


def password_environment_name(user: SeedUser) -> str:
    return f"AUTH_SEED_{user.role}_PASSWORD"


def choose_users(requested: Iterable[str], seed_all: bool) -> list[SeedUser]:
    if seed_all:
        return list(DEMO_USERS)
    lookup = {
        key.casefold(): user
        for user in DEMO_USERS
        for key in (user.email, user.username, user.role)
    }
    selected: list[SeedUser] = []
    for value in requested:
        user = lookup.get(str(value).strip().casefold())
        if user is None:
            raise ValueError(f"Unknown demo user selector: {value}")
        if user not in selected:
            selected.append(user)
    return selected


def read_seed_password(user: SeedUser, non_interactive: bool, minimum_length: int) -> str:
    variable = password_environment_name(user)
    password = os.getenv(variable, "")
    if not password and not non_interactive:
        password = getpass.getpass(f"One-time password for {user.email}: ")
        confirmation = getpass.getpass(f"Confirm password for {user.email}: ")
        if password != confirmation:
            raise ValueError(f"Passwords do not match for {user.email}.")
    if not password:
        raise ValueError(f"Set {variable} or omit --non-interactive to use a masked prompt.")
    if len(password) < minimum_length:
        raise ValueError(f"Password for {user.email} must be at least {minimum_length} characters.")
    return password


class StatementExecutor:
    def __init__(self, *, warehouse_id: str, profile: str | None, host: str | None, timeout: int):
        try:
            from databricks.sdk import WorkspaceClient
            from databricks.sdk.service import sql as dbsql
        except ImportError as exc:
            raise RuntimeError("Install databricks-sdk before running this setup command.") from exc

        kwargs = {}
        if profile:
            kwargs["profile"] = profile
        if host:
            kwargs["host"] = host
        self.client = WorkspaceClient(**kwargs)
        self.dbsql = dbsql
        self.warehouse_id = warehouse_id
        self.timeout = max(1, timeout)

    def execute(self, statement: str) -> tuple[list[str], list[list[object]]]:
        response = self.client.statement_execution.execute_statement(
            warehouse_id=self.warehouse_id,
            statement=statement,
            wait_timeout="0s",
            disposition=self.dbsql.Disposition.INLINE,
        )
        deadline = time.time() + self.timeout
        state = str(getattr(getattr(response, "status", None), "state", "")).rsplit(".", 1)[-1]
        while getattr(response, "statement_id", None) and state.upper() in {"PENDING", "RUNNING"}:
            if time.time() >= deadline:
                self.client.statement_execution.cancel_execution(statement_id=response.statement_id)
                raise TimeoutError(f"SQL statement timed out after {self.timeout} seconds.")
            time.sleep(1)
            response = self.client.statement_execution.get_statement(statement_id=response.statement_id)
            state = str(getattr(getattr(response, "status", None), "state", "")).rsplit(".", 1)[-1]
        if state.upper() != "SUCCEEDED":
            error = getattr(getattr(response, "status", None), "error", None)
            raise RuntimeError(f"Databricks SQL statement failed: {error or state}")
        manifest = getattr(response, "manifest", None)
        columns_meta = getattr(getattr(manifest, "schema", None), "columns", None) or []
        columns = [str(getattr(column, "name", "")) for column in columns_meta]
        rows = getattr(getattr(response, "result", None), "data_array", None) or []
        return columns, rows


def verify_table_schema(executor: StatementExecutor, catalog: str, schema: str, table: str) -> None:
    columns, rows = executor.execute(f"DESCRIBE TABLE {table_name(catalog, schema, table)}")
    name_index = [column.casefold() for column in columns].index("col_name")
    actual = [
        str(row[name_index])
        for row in rows
        if len(row) > name_index and row[name_index] and not str(row[name_index]).startswith("#")
    ]
    expected = list(TABLE_COLUMNS[table])
    if [column.casefold() for column in actual] != [column.casefold() for column in expected]:
        raise RuntimeError(
            f"Schema mismatch for {catalog}.{schema}.{table}; expected {expected}, found {actual}. "
            "The setup command will not alter an existing table."
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", default=os.getenv("DATABRICKS_CATALOG", "cmegtmdev"))
    parser.add_argument("--schema", default="marketing_audit")
    parser.add_argument("--warehouse-id", default=os.getenv("DATABRICKS_WAREHOUSE_ID", ""))
    parser.add_argument("--profile", default=os.getenv("DATABRICKS_CONFIG_PROFILE", ""))
    parser.add_argument("--host", default=os.getenv("DATABRICKS_HOST", ""))
    parser.add_argument("--seed-user", action="append", default=[], help="Email, username, or role; repeat as needed")
    parser.add_argument("--seed-all-demo-users", action="store_true")
    parser.add_argument("--non-interactive", action="store_true")
    parser.add_argument("--minimum-password-length", type=int, default=12)
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--apply", action="store_true", help="Execute changes; without this flag the command is a dry run")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    users = choose_users(args.seed_user, args.seed_all_demo_users)
    statements = create_table_statements(args.catalog, args.schema)

    if not args.apply:
        print("DRY RUN: no Databricks changes were made.")
        print(f"Would create/validate: {', '.join(TABLE_COLUMNS)} in {args.catalog}.{args.schema}")
        print("Would seed/update: " + (", ".join(user.email for user in users) if users else "no users"))
        print("Re-run with --apply after reviewing the target and seed selection.")
        return 0
    if not args.warehouse_id:
        raise ValueError("--warehouse-id or DATABRICKS_WAREHOUSE_ID is required with --apply.")

    executor = StatementExecutor(
        warehouse_id=args.warehouse_id,
        profile=args.profile or None,
        host=args.host or None,
        timeout=args.timeout,
    )
    for statement in statements:
        executor.execute(statement)
    for table in TABLE_COLUMNS:
        verify_table_schema(executor, args.catalog, args.schema, table)

    for user in users:
        password = read_seed_password(user, args.non_interactive, args.minimum_password_length)
        password_hash = generate_password_hash(password, method="scrypt")
        del password
        executor.execute(user_merge_statement(args.catalog, args.schema, user, password_hash))

    print(f"Authentication tables are ready in {args.catalog}.{args.schema}.")
    print(f"Seeded/updated {len(users)} user(s); no plaintext passwords were persisted.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, TimeoutError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
