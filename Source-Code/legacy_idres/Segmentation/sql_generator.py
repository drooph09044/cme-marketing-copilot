"""
sql_generator.py
Converts rule tree to SQL VIEW.
Saved with segment JSON for future Databricks use.
Not executed now — pandas handles execution.
"""


class SQLGenerator:

    ALIASES = {
        "customer_profile":    "cp",
        "streaming_activity":  "sa",
        "app_events":          "ae",
        "email_engagement":    "ee",
        "subscription_billing":"sb",
        "customer_support":    "cs",
    }

    SOURCE_FILES = {
        "streaming_activity":   "streaming_activity.csv",
        "app_events":           "app_events.csv",
        "email_engagement":     "email_engagement.csv",
        "subscription_billing": "subscription_billing.csv",
        "customer_support":     "customer_support.csv",
    }

    def generate(self, segment: dict) -> str:
        domain = segment.get("domain")
        if domain == "automotive" or self._looks_automotive(segment.get("root", {})):
            return self._generate_automotive(segment)

        sid    = segment.get("segment_id", "segment")
        root   = segment.get("root", {})
        tables = self._get_tables(root)
        tables.discard("customer_profile")

        # Split normal vs NOT_IN tables
        not_in_tables  = self._get_not_in_tables(root)
        normal_tables  = tables - not_in_tables

        joins      = self._build_joins(normal_tables)
        where      = self._build_where(root)
        not_in_sql = self._build_not_in(root, not_in_tables)

        full_where = where
        if not_in_sql:
            full_where = f"{where}\n{not_in_sql}"

        return f"""CREATE OR REPLACE VIEW segment_{sid} AS
SELECT DISTINCT
    cp.golden_id,
    cp.email,
    cp.full_name,
    cp.ltv_tier,
    cp.recency_tier,
    cp.engagement_tier,
    cp.primary_affinity,
    cp.subscription_tier
FROM customer_profile_export cp
{joins}
WHERE {full_where}""".strip()

    def _looks_automotive(self, root: dict) -> bool:
        auto_tables = {
            "customers",
            "households",
            "service_orders",
            "service_line_items",
            "telematics_monthly_summary",
            "connected_services_subscriptions",
            "vehicles",
            "vehicle_ownership",
        }
        return bool(self._get_tables(root) & auto_tables)

    def _generate_automotive(self, segment: dict) -> str:
        sid = segment.get("segment_id", "segment")
        root = segment.get("root", {})
        where = self._build_auto_where(root)
        return f"""CREATE OR REPLACE VIEW segment_{sid} AS
SELECT DISTINCT
    c.customer_id,
    c.email,
    c.first_name,
    c.last_name
FROM customers c
WHERE {where}""".strip()

    def _build_auto_where(self, node: dict) -> str:
        if not node:
            return "1=1"
        if "conditions" in node:
            op = node.get("operator", "AND").upper()
            parts = []
            for c in node.get("conditions", []):
                p = self._build_auto_where(c)
                if p and p != "1=1":
                    parts.append(f"({p})")
            if not parts:
                return "1=1"
            if op == "NOT":
                return f"NOT ({parts[0]})"
            return f" {op} ".join(parts)
        if "attribute" in node:
            return self._auto_leaf_sql(node)
        return "1=1"

    def _auto_leaf_sql(self, node: dict) -> str:
        table = node.get("table", "customers")
        attr = node.get("attribute", "")
        op = node.get("operator", "EQ").upper()
        value = node.get("value")

        if table == "customers":
            col = f"c.{attr}"
            return self._auto_col_expr(col, op, value)

        if table == "households":
            col = f"h.{attr}"
            expr = self._auto_col_expr(col, op, value)
            return (
                "EXISTS (\n"
                "    SELECT 1\n"
                "    FROM households h\n"
                "    WHERE h.household_id = c.household_id\n"
                f"    AND {expr}\n"
                ")"
            )

        if table == "service_orders":
            col = f"so.{attr}"
            check_op = op
            if op == "NOT_IN_LAST":
                check_op = "IN_LAST"
            elif op == "NOT_IN":
                check_op = "IN_LAST"
            elif op == "NEQ":
                check_op = "EQ"
            expr = self._auto_col_expr(col, check_op, value)
            exists_kw = "NOT EXISTS" if op in ("NOT_IN", "NOT_IN_LAST", "NEQ") else "EXISTS"
            return (
                f"{exists_kw} (\n"
                "    SELECT 1\n"
                "    FROM service_orders so\n"
                "    WHERE so.customer_id = c.customer_id\n"
                f"    AND {expr}\n"
                ")"
            )

        if table == "service_line_items":
            col = f"sli.{attr}"
            check_op = "EQ" if op in ("NOT_IN", "NEQ") else op
            if op == "NOT_IN_LAST":
                check_op = "IN_LAST"
            expr = self._auto_col_expr(col, check_op, value)
            exists_kw = "NOT EXISTS" if op in ("NOT_IN", "NOT_IN_LAST", "NEQ") else "EXISTS"
            return (
                f"{exists_kw} (\n"
                "    SELECT 1\n"
                "    FROM service_line_items sli\n"
                "    JOIN service_orders so\n"
                "      ON so.service_order_id = sli.service_order_id\n"
                "    WHERE so.customer_id = c.customer_id\n"
                f"    AND {expr}\n"
                ")"
            )

        col = f"t.{attr}"
        check_op = "EQ" if op in ("NOT_IN", "NEQ") else op
        if op == "NOT_IN_LAST":
            check_op = "IN_LAST"
        expr = self._auto_col_expr(col, check_op, value)
        exists_kw = "NOT EXISTS" if op in ("NOT_IN", "NOT_IN_LAST", "NEQ") else "EXISTS"
        return (
            f"{exists_kw} (\n"
            "    SELECT 1\n"
            f"    FROM {table} t\n"
            "    WHERE t.customer_id = c.customer_id\n"
            f"    AND {expr}\n"
            ")"
        )

    def _auto_col_expr(self, col: str, op: str, value) -> str:
        if op == "EQ":
            if isinstance(value, list):
                vals = ", ".join(f"'{str(v).lower()}'" for v in value)
                return f"LOWER(CAST({col} AS VARCHAR)) IN ({vals})"
            return f"LOWER(CAST({col} AS VARCHAR)) = '{str(value).lower()}'"
        if op == "NEQ":
            return f"LOWER(CAST({col} AS VARCHAR)) != '{str(value).lower()}'"
        if op == "IN":
            vals = value if isinstance(value, list) else [value]
            quoted = ", ".join(f"'{str(v).lower()}'" for v in vals)
            return f"LOWER(CAST({col} AS VARCHAR)) IN ({quoted})"
        if op == "CONTAINS":
            return f"LOWER(CAST({col} AS VARCHAR)) LIKE '%{str(value).lower()}%'"
        if op == "GT":
            return f"CAST({col} AS FLOAT) > {value}"
        if op == "GTE":
            return f"CAST({col} AS FLOAT) >= {value}"
        if op == "LT":
            return f"CAST({col} AS FLOAT) < {value}"
        if op == "LTE":
            return f"CAST({col} AS FLOAT) <= {value}"
        if op in ("IN_LAST", "NOT_IN"):
            return f"{col} >= DATEADD(day, -{value}, GETDATE())"
        if op == "NOT_IN_LAST":
            return f"({col} < DATEADD(day, -{value}, GETDATE()) OR {col} IS NULL)"
        if op == "BEFORE":
            return f"{col} < '{value}'"
        if op == "AFTER":
            return f"{col} > '{value}'"
        return "1=1"

    def _build_joins(self, tables: set) -> str:
        if not tables:
            return ""
        joins = []
        for table in sorted(tables):
            alias    = self.ALIASES.get(table, table[:2])
            src_file = self.SOURCE_FILES.get(table, "")
            joins.append(
                f"JOIN superseded_ids bt_{alias}\n"
                f"    ON bt_{alias}.golden_id = cp.golden_id\n"
                f"    AND bt_{alias}.source_file = '{src_file}'\n"
                f"JOIN {table} {alias}\n"
                f"    ON {alias}.record_id = bt_{alias}.record_id"
            )
        return "\n".join(joins)

    def _build_not_in(
        self, root: dict, not_in_tables: set
    ) -> str:
        parts = []
        for table in not_in_tables:
            alias    = self.ALIASES.get(table, table[:2])
            src_file = self.SOURCE_FILES.get(table, "")
            conds    = self._get_not_in_conds(root, table)
            if not conds:
                continue
            where_parts = [self._leaf_sql(c) for c in conds]
            where_str   = " AND ".join(where_parts)
            parts.append(
                f"AND cp.golden_id NOT IN (\n"
                f"    SELECT DISTINCT bt.golden_id\n"
                f"    FROM superseded_ids bt\n"
                f"    JOIN {table} {alias}\n"
                f"        ON {alias}.record_id = bt.record_id\n"
                f"    WHERE bt.source_file = '{src_file}'\n"
                f"    AND {where_str}\n"
                f")"
            )
        return "\n".join(parts)

    def _build_where(self, node: dict) -> str:
        if not node:
            return "1=1"
        if "conditions" in node:
            return self._group_sql(node)
        if "attribute" in node:
            if node.get("operator", "").upper() == "NOT_IN":
                return "1=1"
            return self._leaf_sql(node)
        return "1=1"

    def _group_sql(self, node: dict) -> str:
        op    = node.get("operator", "AND").upper()
        parts = []
        for c in node.get("conditions", []):
            p = self._build_where(c)
            if p and p != "1=1":
                parts.append(f"({p})")
        if not parts:
            return "1=1"
        if op == "NOT":
            return f"NOT ({parts[0]})"
        return f" {op} ".join(parts)

    def _leaf_sql(self, node: dict) -> str:
        attr  = node.get("attribute", "")
        op    = node.get("operator", "EQ").upper()
        value = node.get("value")
        table = node.get("table", "customer_profile")
        alias = self.ALIASES.get(table, "cp")
        col   = f"{alias}.{attr}"

        if op == "EQ":
            return (
                f"LOWER(CAST({col} AS VARCHAR)) "
                f"= '{str(value).lower()}'"
            )
        elif op == "NEQ":
            return (
                f"LOWER(CAST({col} AS VARCHAR)) "
                f"!= '{str(value).lower()}'"
            )
        elif op == "IN":
            vals   = value if isinstance(value, list) else [value]
            quoted = ", ".join(f"'{str(v).lower()}'" for v in vals)
            return (
                f"LOWER(CAST({col} AS VARCHAR)) IN ({quoted})"
            )
        elif op == "CONTAINS":
            return (
                f"LOWER(CAST({col} AS VARCHAR)) "
                f"LIKE '%{str(value).lower()}%'"
            )
        elif op == "GT":
            return f"CAST({col} AS FLOAT) > {value}"
        elif op == "GTE":
            return f"CAST({col} AS FLOAT) >= {value}"
        elif op == "LT":
            return f"CAST({col} AS FLOAT) < {value}"
        elif op == "LTE":
            return f"CAST({col} AS FLOAT) <= {value}"
        elif op in ("IN_LAST", "NOT_IN"):
            return (
                f"{col} >= "
                f"DATEADD(day, -{value}, GETDATE())"
            )
        elif op == "NOT_IN_LAST":
            return (
                f"({col} < DATEADD(day, -{value}, GETDATE()) "
                f"OR {col} IS NULL)"
            )
        elif op == "BEFORE":
            return f"{col} < '{value}'"
        elif op == "AFTER":
            return f"{col} > '{value}'"
        return "1=1"

    def _get_tables(self, node: dict) -> set:
        tables = set()
        if not node:
            return tables
        if "table" in node:
            tables.add(node["table"])
        for c in node.get("conditions", []):
            tables |= self._get_tables(c)
        return tables

    def _get_not_in_tables(self, node: dict) -> set:
        tables = set()
        if not node:
            return tables
        if (
            "table" in node
            and node.get("operator", "").upper() == "NOT_IN"
        ):
            tables.add(node["table"])
        for c in node.get("conditions", []):
            tables |= self._get_not_in_tables(c)
        return tables

    def _get_not_in_conds(
        self, node: dict, table: str
    ) -> list:
        conds = []
        if not node:
            return conds
        if (
            "attribute" in node
            and node.get("table") == table
            and node.get("operator", "").upper() == "NOT_IN"
        ):
            conds.append(node)
        for c in node.get("conditions", []):
            conds.extend(self._get_not_in_conds(c, table))
        return conds
