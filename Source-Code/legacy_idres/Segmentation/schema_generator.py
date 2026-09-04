"""
schema_generator.py
Reads all CSVs → generates schema.json
No assumptions — based on real data only
Run: python schema_generator.py
"""

import segmentation_uc_bootstrap  # noqa: F401
import json
import pandas as pd
from pathlib import Path
from scipy.stats import entropy

_THIS_DIR  = Path(__file__).resolve().parent
_IDRES_DIR = _THIS_DIR.parent
_STD_DIR   = _IDRES_DIR / "standardized_data"

SOURCES = {
    "customer_profile": {
        "path": _IDRES_DIR / "customer_profile_export.csv",
        "role": "profile",
        "description": (
            "Customer identity and profile. "
            "One row per customer. "
            "golden_id is master key. "
            "Use for profile level filters."
        ),
    },
    "streaming_activity": {
        "path": _STD_DIR / "standardized_streaming_activity.csv",
        "role": "behavioral",
        "description": (
            "Raw streaming sessions. "
            "One row per session. "
            "Use for content watched, teams, "
            "live events, device type, session duration."
        ),
    },
    "app_events": {
        "path": _STD_DIR / "standardized_app_events.csv",
        "role": "behavioral",
        "description": (
            "Raw app usage events. "
            "One row per event. "
            "Use for app installs, logins, "
            "uninstalls, device platform."
        ),
    },
    "email_engagement": {
        "path": _STD_DIR / "standardized_email_engagement.csv",
        "role": "behavioral",
        "description": (
            "Raw email campaign events. "
            "One row per email. "
            "Use for email opens, clicks, "
            "unsubscribes, campaign names."
        ),
    },
    "subscription_billing": {
        "path": _STD_DIR / "standardized_subscription_billing.csv",
        "role": "transactional",
        "description": (
            "Raw billing records. "
            "One row per billing event. "
            "Use for account status, "
            "billing amount, payment method."
        ),
    },
    "customer_support": {
        "path": _STD_DIR / "standardized_customer_support.csv",
        "role": "transactional",
        "description": (
            "Raw support tickets. "
            "One row per ticket. "
            "Use for issue category, "
            "ticket status, satisfaction score."
        ),
    },
}

# Skip — not useful for segmentation
SKIP_COLS = {
    "source_file", "record_id", "cluster_id",
    "ticket_number", "push_token", "advertising_id",
    "device_id", "ip_address", "user_agent",
    "device_model", "app_version", "os_version",
    "click_url", "source_files", "activity_timeline",
    "identity_strength", "phone", "address",
    "city", "state", "zip",
    "email", "full_name", "golden_id",
}

# Date columns — special handling
DATE_COLS = {
    "session_start", "event_timestamp",
    "send_date", "open_date", "billing_date",
    "created_date", "resolved_date",
}

# Threshold for categorical vs text
MAX_CATEGORICAL = 30
MIN_FILL        = 0.05


def analyze_column(series: pd.Series, col: str) -> dict | None:
    """
    Detect column type from real data.
    No assumptions — reads actual values.
    """
    clean = series.dropna()
    if len(clean) == 0:
        return None
    if len(clean) / len(series) < MIN_FILL:
        return None

    # Date column
    if col in DATE_COLS:
        return {
            "type":      "date",
            "operators": ["IN_LAST", "NOT_IN_LAST", "BEFORE", "AFTER"],
            "note":      "Use IN_LAST N or NOT_IN_LAST N (number of days)",
        }

    # Try numeric
    is_numeric = pd.api.types.is_numeric_dtype(series)
    if not is_numeric:
        try:
            pd.to_numeric(clean, errors="raise")
            is_numeric = True
        except Exception:
            pass

    if is_numeric:
        nums      = pd.to_numeric(clean, errors="coerce").dropna()
        uniq_vals = sorted(nums.unique().tolist())

        # Boolean-like numeric (only 2 unique values)
        if len(uniq_vals) == 2:
            return {
                "type":      "boolean",
                "operators": ["EQ"],
                "values":    [str(v) for v in uniq_vals],
            }

        return {
            "type":      "numeric",
            "operators": ["EQ", "GT", "GTE", "LT", "LTE"],
            "range": [
                round(float(nums.quantile(0.05)), 2),
                round(float(nums.quantile(0.95)), 2),
            ],
        }

    # String analysis
    str_s    = clean.astype(str).str.strip()
    n_unique = str_s.nunique()

    # Remove nulls
    valid = [
        v for v in str_s.unique()
        if str(v).lower() not in ("nan", "none", "", "null", "na")
    ]

    # Boolean-like string (2 unique values)
    if len(valid) == 2:
        return {
            "type":      "boolean",
            "operators": ["EQ"],
            "values":    sorted(valid),
        }

    # Free text — too long to be useful
    if str_s.str.len().mean() > 60:
        return None

    # High cardinality — use CONTAINS only
    # Do NOT send sample values
    # LLM extracts keyword from user query
    if n_unique > MAX_CATEGORICAL:
        return {
            "type":      "text",
            "operators": ["CONTAINS"],
            "note":      (
                "High cardinality text. "
                "Always use CONTAINS operator. "
                "Extract keyword from user query."
            ),
        }

    # Categorical — send all actual values
    vc     = str_s.value_counts(normalize=True)
    e      = entropy(vc)
    values = [
        v for v in str_s.value_counts().index.tolist()
        if str(v).lower() not in ("nan", "none", "", "null", "na")
    ]

    if n_unique <= MAX_CATEGORICAL and e < 4.5:
        return {
            "type":      "string",
            "operators": ["EQ", "IN", "CONTAINS"],
            "values":    values,
        }

    return None


def main():
    out = _THIS_DIR / "schema.json"
    print("=" * 60)
    print("Schema Generator")
    print("Reading real data — no assumptions")
    print("=" * 60)

    schema = {"tables": {}}

    for table_name, config in SOURCES.items():
        path = config["path"]
        if not path.exists():
            print(f"\n  ⚠  Not found: {path}")
            continue

        df = pd.read_csv(path, low_memory=False)
        print(f"\n[{table_name}] {len(df)} rows, {len(df.columns)} cols")

        table_meta = {
            "role":        config["role"],
            "description": config["description"],
            "row_count":   len(df),
            "columns":     {},
        }

        for col in df.columns:
            if col.lower() in {s.lower() for s in SKIP_COLS}:
                continue

            meta = analyze_column(df[col], col)
            if not meta:
                continue

            table_meta["columns"][col] = meta

            t = meta["type"]
            if t == "string":
                print(f"  ✓ {col:35s} categorical → {meta['values'][:4]}")
            elif t == "text":
                print(f"  ✓ {col:35s} text/CONTAINS")
            elif t == "boolean":
                print(f"  ✓ {col:35s} boolean     → {meta['values']}")
            elif t == "date":
                print(f"  ✓ {col:35s} date")
            else:
                print(f"  ✓ {col:35s} numeric     → {meta['range']}")

        schema["tables"][table_name] = table_meta

    with open(out, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"✓ Saved → {out}")
    print(f"\nSummary:")
    for t, m in schema["tables"].items():
        print(f"  {t:30s} {len(m['columns'])} columns, {m['row_count']} rows")


if __name__ == "__main__":
    main()
