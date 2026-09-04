"""
automotive_schema_generator.py
Reads automotive CSVs → generates automotive_schema.json
Run: python automotive_schema_generator.py
"""

import segmentation_uc_bootstrap  # noqa: F401
import json
import pandas as pd
from pathlib import Path
from scipy.stats import entropy

_THIS_DIR = Path(__file__).resolve().parent
_AUTO_DIR = _THIS_DIR / "automotive"

SOURCES = {
    "customers": {
        "path": _AUTO_DIR / "customers.csv",
        "role": "profile",
        "description": (
            "Customer profile. One row per customer. "
            "customer_id is master key. "
            "Use for age, income_band, lifecycle_stage, "
            "churn_risk_score, ev_propensity_score, estimated_clv, "
            "generation, preferred_language, primary_state_province."
        ),
    },
    "households": {
        "path": _AUTO_DIR / "households.csv",
        "role": "profile",
        "description": (
            "Household level data. One row per household. "
            "Use vehicles_in_household to find households "
            "with multiple vehicles. "
            "Does NOT have customer_id — "
            "joined via customers.household_id."
        ),
    },
    "connected_services_subscriptions": {
        "path": _AUTO_DIR / "connected_services_subscriptions.csv",
        "role": "behavioral",
        "description": (
            "Connected service subscriptions per customer. "
            "One row per subscription. "
            "plan_name values: Connected Vehicle, Remote Access, "
            "Safety and Security, Premium. "
            "subscription_status values: Active, Cancelled, Expired, Trial. "
            "To find customers NOT on a plan use EXCLUDE operator. "
            "Example: customers not on Premium = "
            "plan_name EXCLUDE Premium."
        ),
    },
    "service_orders": {
        "path": _AUTO_DIR / "service_orders.csv",
        "role": "transactional",
        "description": (
            "Service visit records. One row per service visit. "
            "closed_date = when service was completed. "
            "Use closed_date with NOT_IN_LAST N days for "
            "customers not serviced in last N days. "
            "Also has odometer reading at time of service."
        ),
    },
    "service_line_items": {
        "path": _AUTO_DIR / "service_line_items.csv",
        "role": "transactional",
        "description": (
            "Individual line items per service order. "
            "One row per line item. "
            "service_category values: Battery, Tires, Maintenance, "
            "Repair, Recall, Warranty, Collision. "
            "Use EQ on service_category for broad service categories. "
            "For replacement intent such as battery replacement or tire "
            "replacement, use description CONTAINS the replacement keyword "
            "because service_category can include diagnostics or inspections. "
            "Joined via service_order_id to service_orders. "
            "Use service_orders.closed_date for time filters. "
            "To find customers who never had a service use "
            "EXCLUDE operator on service_category."
        ),
    },
    "telematics_monthly_summary": {
        "path": _AUTO_DIR / "telematics_monthly_summary.csv",
        "role": "behavioral",
        "description": (
            "Monthly telematics data per customer and vehicle. "
            "odometer_end = cumulative odometer at end of month. "
            "MAX odometer_end = total lifetime miles on vehicle. "
            "Use odometer_end GT value for mileage threshold filters. "
            "Also has miles_driven per month, trip_count, safety_score."
        ),
    },
}

# Skip — IDs, PII, timestamps, raw scores
SKIP_COLS = {
    # IDs — never filter on these
    "customer_id", "service_order_id", "appointment_id",
    "dealer_id", "advisor_staff_id", "service_line_item_id",
    "line_number", "operation_code", "currency_code",
    "eligibility_id", "campaign_id", "vehicle_id",
    "ownership_id", "household_id", "model_id",
    "vin", "build_date", "selling_dealer_id",
    "warranty_plan_id", "telematics_month_id", "subscription_id",
    # PII
    "email", "phone", "zip", "birth_date",
    "first_name", "last_name", "household_name",
    # Timestamps
    "created_at", "updated_at",
    # Telematics granular — keep only odometer + summary
    "odometer_start", "fuel_gallons", "kwh_consumed",
    "hard_brake_count", "hard_acceleration_count",
    "nighttime_trip_count", "idle_minutes",
    # Subscription — skip financial/date details
    "start_date", "end_date", "monthly_fee",
    "auto_renew_flag", "trial_flag",
}

DATE_COLS = {
    "closed_date", "opened_date",
    "customer_since", "month_start", "in_service_date",
}

FORCE_TEXT_COLS = {
    "description",
    "eligibility_reason",
}

MAX_CATEGORICAL = 30
MIN_FILL        = 0.05


def analyze_column(series: pd.Series, col: str) -> dict | None:
    clean = series.dropna()
    if len(clean) == 0:
        return None
    if len(clean) / len(series) < MIN_FILL:
        return None

    if col in DATE_COLS:
        return {
            "type":      "date",
            "operators": ["IN_LAST", "NOT_IN_LAST", "BEFORE", "AFTER"],
            "note":      "Use IN_LAST N or NOT_IN_LAST N (number of days)",
        }

    if col in FORCE_TEXT_COLS:
        return {
            "type":      "text",
            "operators": ["CONTAINS"],
            "note":      (
                "Free text. Always use CONTAINS and extract the exact "
                "keyword phrase from the user query."
            ),
        }

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

    str_s    = clean.astype(str).str.strip()
    n_unique = str_s.nunique()
    valid    = [
        v for v in str_s.unique()
        if str(v).lower() not in ("nan", "none", "", "null", "na")
    ]

    if len(valid) == 2:
        return {
            "type":      "boolean",
            "operators": ["EQ"],
            "values":    sorted(valid),
        }

    if str_s.str.len().mean() > 60:
        return None

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
    out = _THIS_DIR / "automotive_schema.json"
    print("=" * 60)
    print("Automotive Schema Generator")
    print("=" * 60)

    schema = {
        "domain": "automotive",
        "anchor": "customers",
        "key":    "customer_id",
        "bridge": None,
        "tables": {},
    }

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
                print(f"  ✓ {col:40s} categorical → {meta['values'][:4]}")
            elif t == "text":
                print(f"  ✓ {col:40s} text/CONTAINS")
            elif t == "boolean":
                print(f"  ✓ {col:40s} boolean     → {meta['values']}")
            elif t == "date":
                print(f"  ✓ {col:40s} date")
            else:
                print(f"  ✓ {col:40s} numeric     → {meta['range']}")

        schema["tables"][table_name] = table_meta

    with open(out, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"✓ Saved → {out}")
    print(f"\nSummary:")
    for t, m in schema["tables"].items():
        print(
            f"  {t:45s} "
            f"{len(m['columns'])} columns, "
            f"{m['row_count']} rows"
        )


if __name__ == "__main__":
    main()
