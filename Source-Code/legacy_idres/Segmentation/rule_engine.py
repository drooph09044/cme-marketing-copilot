"""
rule_engine.py
Executes rule tree on raw CSVs directly.
Uses superseded_ids to map record_id to golden_id.
Handles all operators including NOT_IN exclusion.
No assumptions on data values.
"""

import segmentation_uc_bootstrap  # noqa: F401
import pandas as pd
from pathlib import Path

_THIS_DIR  = Path(__file__).resolve().parent
_IDRES_DIR = _THIS_DIR.parent
_STD_DIR   = _IDRES_DIR / "standardized_data"

TABLE_PATHS = {
    "customer_profile":    _IDRES_DIR / "customer_profile_export.csv",
    "streaming_activity":  _STD_DIR / "standardized_streaming_activity.csv",
    "app_events":          _STD_DIR / "standardized_app_events.csv",
    "email_engagement":    _STD_DIR / "standardized_email_engagement.csv",
    "subscription_billing":_STD_DIR / "standardized_subscription_billing.csv",
    "customer_support":    _STD_DIR / "standardized_customer_support.csv",
}

BRIDGE_PATH = _IDRES_DIR / "superseded_ids.csv"

SOURCE_FILE_MAP = {
    "streaming_activity":   "streaming_activity.csv",
    "app_events":           "app_events.csv",
    "email_engagement":     "email_engagement.csv",
    "subscription_billing": "subscription_billing.csv",
    "customer_support":     "customer_support.csv",
}

_cache = {}


def _load(table: str) -> pd.DataFrame:
    if table not in _cache:
        path = TABLE_PATHS.get(table)
        if not path or not path.exists():
            print(f"[Engine] WARNING: {table} not found")
            return pd.DataFrame()
        _cache[table] = pd.read_csv(path, low_memory=False)
        print(f"[Engine] Loaded {table}: {len(_cache[table])} rows")
    return _cache[table].copy()


def _load_bridge() -> pd.DataFrame:
    if "bridge" not in _cache:
        if not BRIDGE_PATH.exists():
            print(f"[Engine] WARNING: superseded_ids not found")
            return pd.DataFrame()
        _cache["bridge"] = pd.read_csv(
            BRIDGE_PATH, low_memory=False
        )
        print(f"[Engine] Loaded bridge: {len(_cache['bridge'])} rows")
    return _cache["bridge"].copy()


def clear_cache():
    global _cache
    _cache = {}


def _raw_to_golden_ids(
    table: str,
    conditions: list,
    all_golden_ids: set,
) -> set:
    """
    Filter raw table by conditions.
    Map matching record_ids to golden_ids via superseded_ids.
    Returns set of matching golden_ids.
    """
    df = _load(table)
    if df.empty:
        print(f"[Engine] {table} is empty")
        return set()

    bridge = _load_bridge()
    if bridge.empty:
        print(f"[Engine] bridge is empty")
        return set()

    # Apply ALL conditions with AND logic within same table
    mask       = _apply_conditions(conditions, df, "AND")
    matched_df = df[mask]

    print(f"[Engine] {table}: {len(matched_df)} raw rows matched")

    if matched_df.empty:
        return set()

    if "record_id" not in matched_df.columns:
        print(f"[Engine] No record_id column in {table}")
        return set()

    record_ids  = set(matched_df["record_id"].tolist())
    source_file = SOURCE_FILE_MAP.get(table, "")

    # Filter bridge by source_file
    bridge_filtered = bridge[
        bridge["source_file"].astype(str) == source_file
    ]

    print(
        f"[Engine] Bridge rows for {source_file}: "
        f"{len(bridge_filtered)}"
    )

    # Map record_ids to golden_ids
    golden_ids = set(
        bridge_filtered[
            bridge_filtered["record_id"].isin(record_ids)
        ]["golden_id"].tolist()
    )

    print(f"[Engine] {table}: {len(golden_ids)} golden_ids found")

    # Only keep golden_ids that exist in profile
    golden_ids = golden_ids & all_golden_ids

    print(
        f"[Engine] {table}: {len(golden_ids)} "
        f"golden_ids after profile intersection"
    )

    return golden_ids


def _apply_conditions(
    conditions: list,
    df: pd.DataFrame,
    op: str,
) -> pd.Series:
    if not conditions:
        return pd.Series([True] * len(df), index=df.index)

    masks  = [_eval_condition(c, df) for c in conditions]
    result = masks[0]
    for m in masks[1:]:
        if op == "AND":
            result = result & m
        else:
            result = result | m
    return result


def _eval_condition(
    cond: dict,
    df: pd.DataFrame,
) -> pd.Series:
    attr  = cond.get("attribute", "")
    op    = cond.get("operator", "EQ").upper()
    value = cond.get("value")
    false = pd.Series([False] * len(df), index=df.index)

    if attr not in df.columns:
        print(f"[Engine] Column '{attr}' not found")
        return false

    col = df[attr]

    try:
        # ── Date operators ────────────────────────────────────────
        if op in ("IN_LAST", "NOT_IN_LAST", "NOT_IN", "BEFORE", "AFTER"):
            dates  = pd.to_datetime(col, errors="coerce")
            cutoff = (
                pd.Timestamp.now()
                - pd.Timedelta(days=int(value))
            )
            if op == "IN_LAST":
                # streamed within last N days
                return dates >= cutoff
            elif op in ("NOT_IN_LAST", "NOT_IN"):
                # streamed within last N days
                # (used for exclusion at engine level)
                return dates >= cutoff
            elif op == "BEFORE":
                return dates < pd.Timestamp(str(value))
            elif op == "AFTER":
                return dates > pd.Timestamp(str(value))

        # ── Standard operators ────────────────────────────────────
        elif op == "EQ":
            return (
                col.astype(str).str.strip().str.lower()
                == str(value).lower().strip()
            )
        elif op == "NEQ":
            return (
                col.astype(str).str.strip().str.lower()
                != str(value).lower().strip()
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
            print(f"[Engine] Unknown operator: {op}")
            return false

    except Exception as e:
        print(f"[Engine] Error evaluating {attr} {op} {value}: {e}")
        return false


def _get_tables(node: dict) -> set:
    tables = set()
    if not node:
        return tables
    if "table" in node:
        tables.add(node["table"])
    for c in node.get("conditions", []):
        tables |= _get_tables(c)
    return tables


def _get_conditions(
    node: dict,
    table: str,
    only_not_in: bool = False,
    exclude_not_in: bool = False,
) -> list:
    """Extract conditions for a specific table from rule tree."""
    conds = []
    if not node:
        return conds

    if "attribute" in node and node.get("table") == table:
        op = node.get("operator", "").upper()
        is_not_in = op in ("NOT_IN", "NOT_IN_LAST")

        if only_not_in and is_not_in:
            conds.append(node)
        elif exclude_not_in and not is_not_in:
            conds.append(node)
        elif not only_not_in and not exclude_not_in:
            conds.append(node)
    else:
        for c in node.get("conditions", []):
            conds.extend(
                _get_conditions(c, table, only_not_in, exclude_not_in)
            )
    return conds


class RuleEngine:
    def _build_export_dataframe(
    self,
    profile_df,
    root,
):
        """
        Build explainable export dataframe.

        Includes:
        - customer profile columns
        - matched raw table evidence
        - NOT_IN verification columns
        """

        # ─────────────────────────────────────────────
        # Base profile columns
        # ─────────────────────────────────────────────

        BASE_PROFILE_COLS = [
            "golden_id",
            "email",
            "full_name",
        ]

        # Dynamically add customer_profile rule columns
        profile_conditions = _get_conditions(
            root,
            "customer_profile",
            exclude_not_in=True
        )

        for cond in profile_conditions:

            attr = cond.get("attribute")

            if (
                attr
                and attr in profile_df.columns
                and attr not in BASE_PROFILE_COLS
            ):
                BASE_PROFILE_COLS.append(attr)

        export_df = profile_df[
            [
                c for c in BASE_PROFILE_COLS
                if c in profile_df.columns
            ]
        ].copy()

        # ─────────────────────────────────────────────
        # Load bridge
        # ─────────────────────────────────────────────

        bridge = _load_bridge()

        # ─────────────────────────────────────────────
        # Get all raw tables
        # ─────────────────────────────────────────────

        all_tables = _get_tables(root)
        all_tables.discard("customer_profile")

        # ─────────────────────────────────────────────
        # Process every raw table dynamically
        # ─────────────────────────────────────────────

        for table in all_tables:

            raw_df = _load(table)

            if raw_df.empty:
                continue

            source_file = SOURCE_FILE_MAP.get(table, "")

            bridge_filtered = bridge[
                bridge["source_file"].astype(str)
                == source_file
            ][["golden_id", "record_id"]]

            # =========================================================
            # REGULAR CONDITIONS
            # =========================================================

            regular_conditions = _get_conditions(
                root,
                table,
                exclude_not_in=True
            )

            if regular_conditions:

                # Apply filters
                mask = _apply_conditions(
                    regular_conditions,
                    raw_df,
                    "AND"
                )

                matched_df = raw_df[mask].copy()

                if not matched_df.empty:

                    # Attach golden_id
                    matched_df = matched_df.merge(
                        bridge_filtered,
                        on="record_id",
                        how="inner"
                    )

                    # Keep only final filtered customers
                    matched_df = matched_df[
                        matched_df["golden_id"].isin(
                            profile_df["golden_id"]
                        )
                    ]

                    # -------------------------------------
                    # Build evidence columns dynamically
                    # -------------------------------------

                    evidence_cols = ["golden_id"]

                    for cond in regular_conditions:

                        attr = cond.get("attribute")

                        if (
                            attr
                            and attr in matched_df.columns
                            and attr not in evidence_cols
                        ):
                            evidence_cols.append(attr)

                   

                    # Remove duplicates
                    evidence_cols = list(
                        dict.fromkeys(evidence_cols)
                    )

                    evidence_df = matched_df[
                        evidence_cols
                    ].copy()

                    # Prefix raw table columns
                    rename_map = {}

                    for col in evidence_df.columns:

                        if col != "golden_id":

                            rename_map[col] = (
                                f"{table}_{col}"
                            )

                    evidence_df.rename(
                        columns=rename_map,
                        inplace=True
                    )

                    # Merge into export
                    export_df = export_df.merge(
                        evidence_df,
                        on="golden_id",
                        how="left"
                    )

            # =========================================================
            # NOT_IN CONDITIONS
            # =========================================================

            not_in_conditions = _get_conditions(
                root,
                table,
                only_not_in=True
            )

            for cond in not_in_conditions:

                attr  = cond.get("attribute")
                value = cond.get("value")

                export_col = (
                    f"{table}_NOT_{attr.upper()}_DAYS"
                )

                export_df[export_col] = value

        # ─────────────────────────────────────────────
        # Final cleanup
        # ─────────────────────────────────────────────

        export_df = export_df.drop_duplicates()

        return export_df
    def execute(self, segment: dict) -> dict:
        root = segment.get("root", {})

        # Load customer profile as anchor
        profile = _load("customer_profile")
        if profile.empty:
            return self._empty()

        all_golden_ids = set(profile["golden_id"].tolist())
        op             = root.get("operator", "AND").upper()

        print(f"\n[Engine] Total customers in profile: {len(all_golden_ids)}")
        print(f"[Engine] Root operator: {op}")

        # Get all raw tables needed
        all_tables = _get_tables(root)
        all_tables.discard("customer_profile")
        print(f"[Engine] Raw tables needed: {all_tables}")

        include_sets = []  # golden_ids that MATCH
        exclude_sets = []  # golden_ids to EXCLUDE

        for table in all_tables:
            # Regular conditions for this table
            regular = _get_conditions(
                root, table, exclude_not_in=True
            )
            # NOT_IN conditions — these are exclusions
            not_in = _get_conditions(
                root, table, only_not_in=True
            )

            print(f"\n[Engine] {table}:")
            print(f"  regular conditions: {len(regular)}")
            print(f"  NOT_IN conditions:  {len(not_in)}")

            if regular:
                matched = _raw_to_golden_ids(
                    table, regular, all_golden_ids
                )
                include_sets.append(matched)

            if not_in:
                # Find golden_ids who DID the action
                # We will EXCLUDE them from final result
                did_action = _raw_to_golden_ids(
                    table, not_in, all_golden_ids
                )
                exclude_sets.append(did_action)
                print(
                    f"[Engine] {table} NOT_IN: "
                    f"will exclude {len(did_action)} customers"
                )

        # ── Combine include sets ──────────────────────────────────
        if include_sets:
            if op == "AND":
                combined = include_sets[0]
                for s in include_sets[1:]:
                    combined = combined & s
            else:
                combined = set()
                for s in include_sets:
                    combined = combined | s
            print(f"\n[Engine] After combining include sets: {len(combined)}")
        else:
            # No raw table includes — start with all customers
            combined = all_golden_ids
            print(f"\n[Engine] No raw includes — using all: {len(combined)}")

        # ── Filter profile by combined golden_ids ─────────────────
        filtered = profile[
            profile["golden_id"].isin(combined)
        ].copy()
        print(f"[Engine] After golden_id filter: {len(filtered)}")

        # ── Apply customer_profile conditions ─────────────────────
        profile_conds = _get_conditions(
            root, "customer_profile", exclude_not_in=True
        )
        print(f"[Engine] Profile conditions: {len(profile_conds)}")

        if profile_conds:
            mask     = _apply_conditions(profile_conds, filtered, op)
            filtered = filtered[mask].copy()
            print(f"[Engine] After profile filter: {len(filtered)}")

        # ── Apply exclusions ──────────────────────────────────────
        for exclude_ids in exclude_sets:
            before   = len(filtered)
            filtered = filtered[
                ~filtered["golden_id"].isin(exclude_ids)
            ].copy()
            print(
                f"[Engine] After NOT_IN exclusion: "
                f"{before} → {len(filtered)}"
            )

        # Clean rows
        rows = []
        for row in filtered.head(10).to_dict("records"):
            rows.append({
                k: (None if isinstance(v, float) and v != v else v)
                for k, v in row.items()
            })

        print(f"\n[Engine] FINAL: {len(filtered)} customers")
        
        # Build explainable export dataframe
        export_df = self._build_export_dataframe(
            filtered,
            root,
        )

        return {
        "count":       len(filtered),
        "rows":        rows,
        "golden_ids":  filtered["golden_id"].tolist(),
        "filtered_df": filtered,
        "export_df":   export_df,
    }

    def _empty(self) -> dict:
        return {
            "count":       0,
            "rows":        [],
            "golden_ids":  [],
            "filtered_df": pd.DataFrame(),
        }
