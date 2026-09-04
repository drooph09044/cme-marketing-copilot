"""
automotive_rule_engine.py
Executes rule tree on automotive CSVs.
Anchor: customers.csv — all results from real customers only.

CSV rule:
- customer_id, first_name, last_name always
- ONLY include condition attribute columns shown as evidence
- Exclusion conditions (NOT_IN, NEQ) do the filtering but add NO columns
- One row per customer always
"""

import segmentation_uc_bootstrap  # noqa: F401
import pandas as pd
from pathlib import Path

_THIS_DIR = Path(__file__).resolve().parent
_AUTO_DIR = _THIS_DIR / "automotive"

TABLE_PATHS = {
    "customers":                        _AUTO_DIR / "customers.csv",
    "households":                       _AUTO_DIR / "households.csv",
    "connected_services_subscriptions": _AUTO_DIR / "connected_services_subscriptions.csv",
    "service_orders":                   _AUTO_DIR / "service_orders.csv",
    "service_line_items":               _AUTO_DIR / "service_line_items.csv",
    "telematics_monthly_summary":       _AUTO_DIR / "telematics_monthly_summary.csv",
    "vehicles":                         _AUTO_DIR / "vehicles.csv",
    "vehicle_ownership":                _AUTO_DIR / "vehicle_ownership.csv",
}

HOUSEHOLD_TABLE    = "households"
SERVICE_LINE_TABLE = "service_line_items"
TELEMATICS_TABLE   = "telematics_monthly_summary"
VEHICLES_TABLE     = "vehicles"
OWNERSHIP_TABLE    = "vehicle_ownership"

RELATIONAL_PATTERNS = {
    "mileage_without_recent_service_type": {
        "metric_tables": {TELEMATICS_TABLE, VEHICLES_TABLE},
        "service_table": SERVICE_LINE_TABLE,
        "service_attrs": {"service_category", "description"},
        "service_exclusion_ops": {"NOT_IN", "NOT_IN_LAST", "NEQ"},
    },
    "service_type_not_in_last_window": {
        "service_table": SERVICE_LINE_TABLE,
        "service_attrs": {"service_category", "description"},
        "date_table": "service_orders",
        "date_attrs": {"closed_date", "opened_date"},
        "date_ops": {"NOT_IN_LAST", "NOT_IN"},
    },
}

_cache = {}


def _load(table: str) -> pd.DataFrame:
    if table not in _cache:
        path = TABLE_PATHS.get(table)
        if not path or not path.exists():
            print(f"[AutoEngine] WARNING: {table} not found")
            return pd.DataFrame()
        df = pd.read_csv(path, low_memory=False)
        # Force numeric on known numeric columns
        if table == TELEMATICS_TABLE:
            for col in ["odometer_end", "odometer_start", "miles_driven",
                        "trip_count", "avg_trip_miles", "safety_score"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
        _cache[table] = df
        print(f"[AutoEngine] Loaded {table}: {len(_cache[table])} rows")
    return _cache[table].copy()


def clear_cache():
    global _cache
    _cache = {}


def _is_exclusion(cond):
    """
    Exclusion operators:
    - NOT_IN_LAST / NOT_IN with numeric value = date based
    - NOT_IN with string value = string based
    - NEQ = string based
    All go to exclude_sets, none add evidence columns to CSV.
    """
    op  = cond.get("operator", "").upper()
    val = cond.get("value")
    if op == "NEQ":
        return True
    if op in ("NOT_IN", "NOT_IN_LAST"):
        return True
    return False


def _apply_conditions(conditions, df, op="AND"):
    if not conditions:
        return pd.Series([True] * len(df), index=df.index)
    masks  = [_eval_condition(c, df) for c in conditions]
    result = masks[0]
    for m in masks[1:]:
        result = result & m if op == "AND" else result | m
    return result


def _eval_condition(cond, df):
    attr  = cond.get("attribute", "")
    op    = cond.get("operator", "EQ").upper()
    value = cond.get("value")
    false = pd.Series([False] * len(df), index=df.index)

    if attr not in df.columns:
        print(f"[AutoEngine] Column '{attr}' not found")
        return false

    col = df[attr]
    try:
        if op in ("IN_LAST", "NOT_IN_LAST", "NOT_IN", "BEFORE", "AFTER"):
            try:
                days   = int(float(value))
                dates  = pd.to_datetime(col, errors="coerce")
                cutoff = pd.Timestamp.now() - pd.Timedelta(days=days)
                if op == "IN_LAST":
                    return dates >= cutoff
                elif op in ("NOT_IN_LAST", "NOT_IN"):
                    return dates >= cutoff
                elif op == "BEFORE":
                    return dates < pd.Timestamp(str(value))
                elif op == "AFTER":
                    return dates > pd.Timestamp(str(value))
            except (TypeError, ValueError):
                # String value — find exact match
                vals = value if isinstance(value, list) else [value]
                return col.astype(str).str.strip().str.lower().isin(
                    [str(v).lower().strip() for v in vals]
                )
        elif op == "EQ":
            if isinstance(value, list):
                return col.astype(str).str.strip().str.lower().isin(
                    [str(v).lower().strip() for v in value]
                )
            return (
                col.astype(str).str.strip().str.lower()
                == str(value).lower().strip()
            )
        elif op == "NEQ":
            # For exclusion — find rows that MATCH (to get cids to exclude)
            return (
                col.astype(str).str.strip().str.lower()
                == str(value).lower().strip()
            )
        elif op == "IN":
            vals = value if isinstance(value, list) else [value]
            return col.astype(str).str.strip().str.lower().isin(
                [str(v).lower().strip() for v in vals]
            )
        elif op == "CONTAINS":
            return col.astype(str).str.lower().str.contains(
                str(value).lower(), na=False
            )
        elif op == "GT":
            return pd.to_numeric(col, errors="coerce") > float(value)
        elif op == "GTE":
            return pd.to_numeric(col, errors="coerce") >= float(value)
        elif op == "LT":
            return pd.to_numeric(col, errors="coerce") < float(value)
        elif op == "LTE":
            return pd.to_numeric(col, errors="coerce") <= float(value)
        else:
            print(f"[AutoEngine] Unknown op: {op}")
            return false
    except Exception as e:
        print(f"[AutoEngine] Error {attr} {op} {value}: {e}")
        return false


def _get_tables(node):
    tables = set()
    if not node:
        return tables
    if "table" in node:
        tables.add(node["table"])
    for c in node.get("conditions", []):
        tables |= _get_tables(c)
    return tables


def _get_all_conditions(node, table):
    conds = []
    if not node:
        return conds
    if "attribute" in node and node.get("table") == table:
        conds.append(node)
    for c in node.get("conditions", []):
        conds.extend(_get_all_conditions(c, table))
    return conds


def _split_conditions(node, table):
    all_conds = _get_all_conditions(node, table)
    include   = [c for c in all_conds if not _is_exclusion(c)]
    exclude   = [c for c in all_conds if _is_exclusion(c)]
    return include, exclude


def _value_list(value):
    return value if isinstance(value, list) else [value]


def _value_label(value):
    if isinstance(value, list):
        return "_".join(str(v).lower() for v in value)
    return str(value).lower()


def _safe_col_part(value):
    return "".join(ch if ch.isalnum() else "_" for ch in value).strip("_")


def _first_mileage_threshold(root):
    for table in [TELEMATICS_TABLE, VEHICLES_TABLE]:
        for cond in _get_all_conditions(root, table):
            if cond.get("attribute") not in ("odometer_end", "current_mileage"):
                continue
            if cond.get("operator", "").upper() in ("GT", "GTE"):
                try:
                    return float(cond.get("value"))
                except (TypeError, ValueError):
                    pass
    return None


def _has_pattern(root, pattern_key):
    cfg = RELATIONAL_PATTERNS[pattern_key]
    if pattern_key == "mileage_without_recent_service_type":
        has_metric = _first_mileage_threshold(root) is not None
        has_service_exclusion = any(
            c.get("attribute") in cfg["service_attrs"]
            and c.get("operator", "").upper() in cfg["service_exclusion_ops"]
            for c in _get_all_conditions(root, cfg["service_table"])
        )
        return has_metric and has_service_exclusion

    if pattern_key == "service_type_not_in_last_window":
        has_service = any(
            c.get("attribute") in cfg["service_attrs"]
            for c in _get_all_conditions(root, cfg["service_table"])
        )
        has_date_window = any(
            c.get("attribute") in cfg["date_attrs"]
            and c.get("operator", "").upper() in cfg["date_ops"]
            for c in _get_all_conditions(root, cfg["date_table"])
        ) or any(
            c.get("lookback_days") is not None
            for c in _get_all_conditions(root, cfg["service_table"])
        )
        return has_service and has_date_window
    return False


def _service_line_conditions(root):
    return [
        c for c in _get_all_conditions(root, SERVICE_LINE_TABLE)
        if c.get("attribute") in ("service_category", "description")
    ]


def _service_order_date_condition(root):
    for cond in _get_all_conditions(root, "service_orders"):
        if (
            cond.get("attribute") in ("closed_date", "opened_date")
            and cond.get("operator", "").upper() in ("NOT_IN_LAST", "NOT_IN")
        ):
            return cond
    return None


def _has_attribute_condition(root, table, attribute):
    for cond in _get_all_conditions(root, table):
        if cond.get("attribute") == attribute:
            return True
    return False


def _current_mileage():
    frames = []

    tel = _load(TELEMATICS_TABLE)
    if not tel.empty and {"customer_id", "odometer_end"}.issubset(tel.columns):
        tel["odometer_end"] = pd.to_numeric(tel["odometer_end"], errors="coerce")
        frames.append(
            tel.groupby("customer_id", as_index=False)["odometer_end"]
            .max()
            .rename(columns={"odometer_end": "current_mileage"})
        )

    vehicles = _load(VEHICLES_TABLE)
    ownership = _load(OWNERSHIP_TABLE)
    if (
        not vehicles.empty
        and not ownership.empty
        and {"vehicle_id", "current_mileage"}.issubset(vehicles.columns)
        and {"vehicle_id", "customer_id"}.issubset(ownership.columns)
    ):
        v = ownership.merge(
            vehicles[["vehicle_id", "current_mileage"]],
            on="vehicle_id",
            how="inner",
        )
        v["current_mileage"] = pd.to_numeric(v["current_mileage"], errors="coerce")
        frames.append(
            v.groupby("customer_id", as_index=False)["current_mileage"].max()
        )

    if not frames:
        return pd.DataFrame(columns=["customer_id", "current_mileage"])

    out = pd.concat(frames, ignore_index=True)
    return out.groupby("customer_id", as_index=False)["current_mileage"].max()


def _ownership_start_dates():
    ownership = _load(OWNERSHIP_TABLE)
    if ownership.empty or "customer_id" not in ownership.columns:
        return pd.DataFrame(columns=["customer_id", "ownership_start_date"])

    own = ownership.copy()
    if "start_date" in own.columns:
        own["start_date"] = pd.to_datetime(own["start_date"], errors="coerce")
    if "is_current_owner" in own.columns:
        own["is_current_owner"] = (
            own["is_current_owner"].astype(str).str.lower() == "true"
        )
        own = own[own["is_current_owner"]].copy()

    if own.empty:
        return pd.DataFrame(columns=["customer_id", "ownership_start_date"])

    out = (
        own.sort_values(["customer_id", "start_date"])
        .groupby("customer_id", as_index=False)
        .tail(1)[["customer_id", "start_date"]]
        .rename(columns={"start_date": "ownership_start_date"})
    )
    return out


def _ownership_baseline_odometer():
    tel = _load(TELEMATICS_TABLE)
    own = _load(OWNERSHIP_TABLE)
    if tel.empty or own.empty:
        return pd.DataFrame(
            columns=["customer_id", "ownership_start_month", "ownership_start_odometer"]
        )
    need_tel = {"customer_id", "vehicle_id", "month_start", "odometer_start"}
    need_own = {"customer_id", "vehicle_id", "start_date"}
    if not need_tel.issubset(tel.columns) or not need_own.issubset(own.columns):
        return pd.DataFrame(
            columns=["customer_id", "ownership_start_month", "ownership_start_odometer"]
        )

    t = tel.copy()
    t["month_start"] = pd.to_datetime(t["month_start"], errors="coerce")
    t["odometer_start"] = pd.to_numeric(t["odometer_start"], errors="coerce")

    o = own.copy()
    o["start_date"] = pd.to_datetime(o["start_date"], errors="coerce")
    if "is_current_owner" in o.columns:
        o["is_current_owner"] = (
            o["is_current_owner"].astype(str).str.lower() == "true"
        )
        o = o[o["is_current_owner"]].copy()

    joined = t.merge(
        o[["customer_id", "vehicle_id", "start_date"]],
        on=["customer_id", "vehicle_id"],
        how="inner",
    )
    joined = joined[joined["month_start"] >= joined["start_date"]].copy()
    if joined.empty:
        return pd.DataFrame(
            columns=["customer_id", "ownership_start_month", "ownership_start_odometer"]
        )

    first_month = (
        joined.sort_values(["customer_id", "month_start"])
        .groupby("customer_id", as_index=False)
        .head(1)[["customer_id", "month_start", "odometer_start"]]
        .rename(
            columns={
                "month_start": "ownership_start_month",
                "odometer_start": "ownership_start_odometer",
            }
        )
    )
    return first_month


def _service_events(line_conditions):
    lines = _load(SERVICE_LINE_TABLE)
    orders = _load("service_orders")
    if lines.empty or orders.empty:
        return pd.DataFrame()

    mask = _apply_conditions(line_conditions, lines, "AND")
    matched = lines[mask].copy()
    if matched.empty:
        return matched

    order_cols = [
        c for c in [
            "service_order_id",
            "customer_id",
            "vehicle_id",
            "closed_date",
            "opened_date",
            "odometer",
        ]
        if c in orders.columns
    ]
    events = matched.merge(orders[order_cols], on="service_order_id", how="inner")
    if "closed_date" in events.columns:
        events["closed_date"] = pd.to_datetime(events["closed_date"], errors="coerce")
    if "odometer" in events.columns:
        events["odometer"] = pd.to_numeric(events["odometer"], errors="coerce")
    return events


def _latest_service_evidence(events, service_label):
    if events.empty or "customer_id" not in events.columns:
        return pd.DataFrame(columns=["customer_id"])

    sort_cols = [c for c in ["closed_date", "odometer"] if c in events.columns]
    latest = events.sort_values(sort_cols).groupby("customer_id", as_index=False).tail(1)
    keep = ["customer_id"]
    rename = {}
    for col in ["closed_date", "odometer"]:
        if col in latest.columns:
            keep.append(col)
            rename[col] = f"service_orders_{col}"
    for col in ["service_category", "description"]:
        if col in latest.columns:
            keep.append(col)
            rename[col] = f"service_line_items_{col}"
    return latest[keep].rename(columns=rename)


def _correlated_mileage_service_gap(root, all_customer_ids):
    cfg = RELATIONAL_PATTERNS["mileage_without_recent_service_type"]
    threshold = _first_mileage_threshold(root)
    if threshold is None:
        return None

    service_conds = [
        c for c in _service_line_conditions(root)
        if (
            c.get("attribute") in cfg["service_attrs"]
            and c.get("operator", "").upper() in cfg["service_exclusion_ops"]
        )
    ]
    if not service_conds:
        return None

    conds_as_match = []
    labels = []
    for cond in service_conds:
        labels.extend(str(v) for v in _value_list(cond.get("value")))
        conds_as_match.append({**cond, "operator": "EQ"})

    events = _service_events(conds_as_match)
    mileage = _current_mileage()
    if mileage.empty:
        return None

    service_label = _safe_col_part("_".join(labels) or "service")
    latest = _latest_service_evidence(events, service_label)
    own_start = _ownership_start_dates()
    own_base = _ownership_baseline_odometer()
    work = mileage.merge(own_start, on="customer_id", how="left")
    work = work.merge(own_base, on="customer_id", how="left")
    work = work.merge(latest, on="customer_id", how="left")

    odom_col = "service_orders_odometer"
    miles_since_col = f"calculated_miles_since_last_{service_label}_service"
    work[miles_since_col] = (
        work["current_mileage"] - work[odom_col]
        if odom_col in work.columns
        else pd.NA
    )
    work["calculated_miles_since_ownership_start"] = (
        work["current_mileage"] - work["ownership_start_odometer"]
        if "ownership_start_odometer" in work.columns
        else pd.NA
    )

    no_prior_service = work[odom_col].isna() if odom_col in work.columns else True
    enough_since_service = (
        work[miles_since_col] > threshold
        if odom_col in work.columns
        else True
    )
    matched = work[
        (work["current_mileage"] > threshold)
        & (no_prior_service | enough_since_service)
    ].copy()

    cids = set(matched["customer_id"].tolist()) & all_customer_ids
    evidence_cols = [
        c for c in [
            "customer_id",
            "current_mileage",
            "ownership_start_date",
            "ownership_start_month",
            "ownership_start_odometer",
            "calculated_miles_since_ownership_start",
            "service_orders_closed_date",
            "service_orders_odometer",
            "service_line_items_service_category",
            "service_line_items_description",
            miles_since_col,
        ]
        if c in matched.columns
    ]
    evidence = matched[evidence_cols].copy()
    evidence.rename(columns={"current_mileage": "computed_current_mileage"}, inplace=True)
    return {
        "customer_ids": cids,
        "evidence_df": evidence,
        "skip_tables": set(cfg["metric_tables"]) | {cfg["service_table"]},
    }


def _correlated_service_not_in_last(root, all_customer_ids):
    cfg = RELATIONAL_PATTERNS["service_type_not_in_last_window"]
    date_cond = _service_order_date_condition(root)
    service_conds = _service_line_conditions(root)
    if not date_cond or not service_conds:
        for cond in service_conds:
            if cond.get("lookback_days") is not None:
                date_cond = {"value": cond.get("lookback_days")}
                break
    if not date_cond or not service_conds:
        return None

    try:
        days = int(float(date_cond.get("value")))
    except (TypeError, ValueError):
        return None

    conds_as_match = []
    labels = []
    for cond in service_conds:
        labels.extend(str(v) for v in _value_list(cond.get("value")))
        op = cond.get("operator", "").upper()
        conds_as_match.append({**cond, "operator": "EQ" if op in ("NOT_IN", "NOT_IN_LAST", "NEQ") else op})

    events = _service_events(conds_as_match)
    service_label = _safe_col_part("_".join(labels) or "service")
    latest = _latest_service_evidence(events, service_label)

    if events.empty or "closed_date" not in events.columns:
        recent_ids = set()
    else:
        cutoff = pd.Timestamp.now() - pd.Timedelta(days=days)
        recent_ids = set(events[events["closed_date"] >= cutoff]["customer_id"].tolist())

    cids = all_customer_ids - recent_ids
    evidence = pd.DataFrame({"customer_id": list(cids)})
    if not latest.empty:
        evidence = evidence.merge(latest, on="customer_id", how="left")
    return {
        "customer_ids": cids,
        "evidence_df": evidence,
        "skip_tables": {cfg["service_table"], cfg["date_table"]},
    }


def _resolve_to_customer_id(df, table, customers_df):
    if table == HOUSEHOLD_TABLE:
        hh_ids   = set(df["household_id"].tolist())
        cust_map = customers_df[
            customers_df["household_id"].isin(hh_ids)
        ][["customer_id", "household_id"]]
        return df.merge(cust_map, on="household_id", how="inner")

    elif table == SERVICE_LINE_TABLE:
        so_df  = _load("service_orders")
        soi    = set(df["service_order_id"].tolist())
        so_map = so_df[
            so_df["service_order_id"].isin(soi)
        ][["service_order_id", "customer_id"]]
        return df.merge(so_map, on="service_order_id", how="inner")

    elif table == TELEMATICS_TABLE:
        if "customer_id" in df.columns and "odometer_end" in df.columns:
            df["odometer_end"] = pd.to_numeric(df["odometer_end"], errors="coerce")
            return df.groupby("customer_id", as_index=False).agg(
                {"odometer_end": "max"}
            )
        return df

    elif "customer_id" in df.columns:
        return df

    return pd.DataFrame()


def _get_cids(table, conditions, all_customer_ids, customers_df):
    if not conditions:
        return set()
    df = _load(table)
    if df.empty:
        return set()

    if table == TELEMATICS_TABLE and "odometer_end" in df.columns:
        df["odometer_end"] = pd.to_numeric(df["odometer_end"], errors="coerce")
        agg_df = df.groupby("customer_id", as_index=False).agg(
            {"odometer_end": "max"}
        )
        mask  = _apply_conditions(conditions, agg_df, "AND")
        cids  = set(agg_df[mask]["customer_id"].tolist()) & all_customer_ids
        print(f"[AutoEngine] {table}: {len(cids)} matched")
        return cids

    mask       = _apply_conditions(conditions, df, "AND")
    matched_df = df[mask].copy()
    print(f"[AutoEngine] {table}: {len(matched_df)} rows matched")

    if matched_df.empty:
        return set()

    resolved = _resolve_to_customer_id(matched_df, table, customers_df)
    if resolved.empty or "customer_id" not in resolved.columns:
        return set()

    cids = set(resolved["customer_id"].tolist()) & all_customer_ids
    print(f"[AutoEngine] {table}: {len(cids)} customer_ids")
    return cids


def _build_export_dataframe(
    filtered_df,
    root,
    customers_df,
    evidence_dfs=None,
    skip_tables=None,
):
    """
    CSV: customer_id, first_name, last_name
    + ONLY include condition attribute columns.
    Exclusion conditions do filtering only — no evidence columns.
    One row per customer.
    """
    all_tables = _get_tables(root)
    base_profile_cols = [
        "customer_id",
        "first_name",
        "last_name",
    ]
    if "households" in all_tables:
        base_profile_cols.append("household_id")
    export_df = filtered_df[
        [c for c in base_profile_cols if c in filtered_df.columns]
    ].copy()

    for col in ["phone", "zip"]:
        if col in export_df.columns:
            export_df[col] = export_df[col].apply(
                lambda v: "" if pd.isna(v) else str(v).removesuffix(".0")
            )

    matched_cids = set(filtered_df["customer_id"].tolist())

    for evidence_df in evidence_dfs or []:
        if evidence_df is None or evidence_df.empty or "customer_id" not in evidence_df.columns:
            continue
        ev = evidence_df[evidence_df["customer_id"].isin(matched_cids)].copy()
        export_df = export_df.merge(ev, on="customer_id", how="left")

    # Customer profile include conditions only
    inc_p, _ = _split_conditions(root, "customers")
    for cond in inc_p:
        attr = cond.get("attribute")
        if attr and attr in filtered_df.columns:
            export_df[attr] = filtered_df[attr].values

    all_tables.discard("customers")
    all_tables -= set(skip_tables or [])

    for table in sorted(all_tables):
        raw_df = _load(table)
        if raw_df.empty:
            continue

        inc_conds, exc_conds = _split_conditions(root, table)
        if not inc_conds:
            if table == "service_orders":
                orders = raw_df[raw_df["customer_id"].isin(matched_cids)].copy()
                include_odometer = (
                    _has_attribute_condition(root, "service_orders", "odometer")
                    or _has_attribute_condition(root, TELEMATICS_TABLE, "odometer_end")
                    or _has_attribute_condition(root, VEHICLES_TABLE, "current_mileage")
                )
                lookback_days = None
                for cond in exc_conds:
                    if cond.get("attribute") in ("closed_date", "opened_date"):
                        try:
                            lookback_days = int(float(cond.get("value")))
                        except (TypeError, ValueError):
                            lookback_days = None
                if not orders.empty:
                    if "closed_date" in orders.columns:
                        orders["closed_date"] = pd.to_datetime(
                            orders["closed_date"], errors="coerce"
                        )
                    if "odometer" in orders.columns:
                        orders["odometer"] = pd.to_numeric(
                            orders["odometer"], errors="coerce"
                        )
                    latest = (
                        orders.sort_values(["closed_date", "odometer"])
                        .groupby("customer_id", as_index=False)
                        .tail(1)
                    )
                    keep = ["customer_id"]
                    if "closed_date" in latest.columns:
                        keep.append("closed_date")
                    if include_odometer and "odometer" in latest.columns:
                        keep.append("odometer")
                    latest = latest[keep].rename(columns={
                        "closed_date": "service_orders_closed_date",
                        "odometer": "service_orders_odometer",
                    })
                    export_df = export_df.merge(
                        latest, on="customer_id", how="left"
                    )
                else:
                    export_df["service_orders_closed_date"] = pd.NaT

                if "service_orders_closed_date" in export_df.columns:
                    service_dates = pd.to_datetime(
                        export_df["service_orders_closed_date"],
                        errors="coerce",
                    )
                    export_df["calculated_days_since_last_service"] = (
                        pd.Timestamp.now().normalize() - service_dates
                    ).dt.days
                    sort_key = service_dates.notna().astype(int)
                    export_df = (
                        export_df.assign(_has_service_order_evidence=sort_key)
                        .sort_values(
                            ["_has_service_order_evidence", "service_orders_closed_date"],
                            ascending=[False, False],
                            na_position="last",
                        )
                        .drop(columns=["_has_service_order_evidence"])
                    )
            # No include conditions for this table
            # Exclusion only table — skip evidence columns
            continue

        # Get evidence attribute names from include conditions only
        evidence_attrs = list(dict.fromkeys([
            c.get("attribute") for c in inc_conds
            if c.get("attribute")
        ]))

        # Filter and aggregate
        if table == TELEMATICS_TABLE and "odometer_end" in raw_df.columns:
            raw_df["odometer_end"] = pd.to_numeric(
                raw_df["odometer_end"], errors="coerce"
            )
            work_df    = raw_df.groupby("customer_id", as_index=False).agg(
                {"odometer_end": "max"}
            )
            mask       = _apply_conditions(inc_conds, work_df, "AND")
            matched_df = work_df[mask].copy()
        else:
            mask       = _apply_conditions(inc_conds, raw_df, "AND")
            matched_df = raw_df[mask].copy()

        if matched_df.empty:
            continue

        resolved = _resolve_to_customer_id(matched_df, table, customers_df)
        if resolved.empty or "customer_id" not in resolved.columns:
            continue

        resolved = resolved[
            resolved["customer_id"].isin(matched_cids)
        ].copy()

        if resolved.empty:
            continue

        # Keep only customer_id + evidence columns
        keep  = ["customer_id"] + [
            a for a in evidence_attrs if a in resolved.columns
        ]
        ev_df = resolved[keep].copy()

        # One row per customer
        agg_dict = {}
        for col in ev_df.columns:
            if col == "customer_id":
                continue
            numeric_col = pd.to_numeric(ev_df[col], errors="coerce")
            if numeric_col.notna().any():
                ev_df[col] = numeric_col
                agg_dict[col] = "max"
            else:
                agg_dict[col] = "first"

        if agg_dict:
            ev_df = ev_df.groupby("customer_id", as_index=False).agg(agg_dict)

        ev_df.rename(columns={
            col: f"{table}_{col}"
            for col in ev_df.columns if col != "customer_id"
        }, inplace=True)

        export_df = export_df.merge(ev_df, on="customer_id", how="left")

    return export_df.drop_duplicates(subset=["customer_id"])


class AutomotiveRuleEngine:

    def execute(self, segment: dict) -> dict:
        root = segment.get("root", {})

        customers = _load("customers")
        if customers.empty:
            return self._empty()

        all_customer_ids = set(customers["customer_id"].tolist())
        op               = root.get("operator", "AND").upper()

        print(f"\n[AutoEngine] Total customers: {len(all_customer_ids)}")

        all_tables = _get_tables(root)
        all_tables.discard("customers")
        print(f"[AutoEngine] Tables: {all_tables}")

        include_sets = []
        exclude_sets = []
        evidence_dfs = []
        skip_tables = set()

        pattern_handlers = [
            ("mileage_without_recent_service_type", _correlated_mileage_service_gap),
            ("service_type_not_in_last_window", _correlated_service_not_in_last),
        ]
        for pattern_key, correlated in pattern_handlers:
            if not _has_pattern(root, pattern_key):
                continue
            correlated_result = correlated(root, all_customer_ids)
            if not correlated_result:
                continue
            include_sets.append(correlated_result["customer_ids"])
            if correlated_result.get("evidence_df") is not None:
                evidence_dfs.append(correlated_result["evidence_df"])
            skip_tables |= correlated_result.get("skip_tables", set())

        if skip_tables:
            print(f"[AutoEngine] Correlated tables handled: {skip_tables}")

        for table in all_tables:
            if table in skip_tables:
                continue
            inc, exc = _split_conditions(root, table)

            print(f"\n[AutoEngine] {table}: include={len(inc)} exclude={len(exc)}")

            if inc:
                matched = _get_cids(table, inc, all_customer_ids, customers)
                include_sets.append(matched)

            if exc:
                eq_conds = []
                for cond in exc:
                    op_c = cond.get("operator", "").upper()
                    val  = cond.get("value")
                    if op_c == "NEQ":
                        # Find who HAS this value → exclude
                        eq_conds.append({**cond, "operator": "EQ"})
                    elif op_c in ("NOT_IN", "NOT_IN_LAST"):
                        try:
                            float(val)
                            # Numeric → date exclusion keep as-is
                            eq_conds.append(cond)
                        except (TypeError, ValueError):
                            # String → find who HAS it → exclude
                            eq_conds.append({**cond, "operator": "EQ"})

                excluded_attrs = {
                    c.get("attribute") for c in eq_conds if c.get("attribute")
                }
                eq_conds.extend([
                    c for c in inc
                    if c.get("attribute") not in excluded_attrs
                ])

                has_value = _get_cids(
                    table, eq_conds, all_customer_ids, customers
                )
                exclude_sets.append(has_value)
                print(f"[AutoEngine] Excluding: {len(has_value)}")

        # Combine includes
        if include_sets:
            if op == "AND":
                combined = include_sets[0]
                for s in include_sets[1:]:
                    combined = combined & s
            else:
                combined = set()
                for s in include_sets:
                    combined = combined | s
        else:
            combined = all_customer_ids

        print(f"\n[AutoEngine] After includes: {len(combined)}")

        filtered = customers[
            customers["customer_id"].isin(combined)
        ].copy()
        print(f"[AutoEngine] After customer filter: {len(filtered)}")

        # Profile conditions
        inc_p, _ = _split_conditions(root, "customers")
        if inc_p:
            mask     = _apply_conditions(inc_p, filtered, op)
            filtered = filtered[mask].copy()
            print(f"[AutoEngine] After profile filter: {len(filtered)}")

        # Apply exclusions
        for excl_ids in exclude_sets:
            before   = len(filtered)
            filtered = filtered[
                ~filtered["customer_id"].isin(excl_ids)
            ].copy()
            print(f"[AutoEngine] After exclusion: {before} → {len(filtered)}")

        print(f"\n[AutoEngine] FINAL: {len(filtered)} customers")

        export_df = _build_export_dataframe(
            filtered,
            root,
            customers,
            evidence_dfs=evidence_dfs,
            skip_tables=skip_tables,
        )

        rows = []
        for row in filtered.head(10).to_dict("records"):
            rows.append({
                k: (None if isinstance(v, float) and v != v else v)
                for k, v in row.items()
            })

        return {
            "count":        len(filtered),
            "rows":         rows,
            "customer_ids": filtered["customer_id"].tolist(),
            "filtered_df":  filtered,
            "export_df":    export_df,
        }

    def _empty(self):
        return {
            "count": 0, "rows": [], "customer_ids": [],
            "filtered_df": pd.DataFrame(), "export_df": pd.DataFrame(),
        }
