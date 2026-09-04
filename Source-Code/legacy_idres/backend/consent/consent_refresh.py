"""
consent_refresh.py
StreamPass CDP — Consent Refresh

Re-runs Steps 3→5 of the consent pipeline so consent_resolved.csv
always reflects the latest consent events.

Run on a schedule (cron / Windows Task Scheduler) or call manually
before any activation:

    python consent_refresh.py

Recommended schedule:
    - Every hour during business hours
    - Immediately before any batch campaign send

What it does:
    1. Re-reads consent_event_ledger.csv (append-only — source of truth)
    2. Re-applies survivorship rules (most recent timestamp wins per field)
    3. Re-writes consent_resolved.csv
    4. Re-writes consent_golden_record.csv
    5. Signals the API to reload (touches a refresh sentinel file)
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import numpy as np
import os
from pathlib import Path
import math
from datetime import datetime, timezone
from consent_runtime_guard import abort_if_uc_runtime

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE          = str(Path(__file__).resolve().parent.parent.parent / "consent_data" / "enriched")
LEDGER_PATH   = os.path.join(BASE, "consent_event_ledger.csv")
RESOLVED_PATH = os.path.join(BASE, "consent_resolved.csv")
GOLDEN_PATH   = os.path.join(BASE, "consent_golden_record.csv")
SENTINEL_PATH = os.path.join(BASE, ".consent_last_refresh")

# ── Source trust hierarchy (mirrors consent_survivorship.py) ──────────────────
SOURCE_TRUST = {
    "call_center":      4,
    "billing":          3,
    "email_engagement": 2,
    "website_banner":   1,
    "mobile_app":       1,
}

CONSENT_FIELDS = [
    "data_processing_consent",
    "global_consent",
    "marketing_comms_optout",
    "marketing_email_consent",
    "tracking_cookie_consent",
]

RESOLVED_COLS = [
    "moscid", "data_processing_consent", "global_consent",
    "marketing_comms_optout", "marketing_email_consent",
    "tracking_cookie_consent", "marketing_suppressed",
    "suppression_reason", "withdrawn_review_flag",
    "consent_last_updated", "sources_seen", "resolved_at",
]

GOLDEN_COLS = [
    "moscid", "data_processing_consent", "global_consent",
    "marketing_comms_optout", "marketing_email_consent",
    "tracking_cookie_consent", "marketing_suppressed",
    "suppression_reason", "withdrawn_review_flag",
    "consent_last_updated", "sources_seen", "golden_record_updated_at",
]


def log(msg):
    ts = datetime.now(timezone.utc).strftime('%H:%M:%S')
    print(f"[consent_refresh {ts}] {msg}")


# ── Survivorship ──────────────────────────────────────────────────────────────

def resolve_field(field_df):
    """Most recent timestamp wins. If no timestamps, trust hierarchy wins."""
    if field_df.empty:
        return None, False

    field_df = field_df.copy()
    field_df["trust_score"] = field_df["consent_source"].map(
        lambda s: SOURCE_TRUST.get(str(s).lower(), 0)
    )
    field_df["consent_timestamp"] = pd.to_datetime(
        field_df["consent_timestamp"], errors="coerce"
    )

    has_ts  = field_df[field_df["consent_timestamp"].notna()]
    null_ts = field_df[field_df["consent_timestamp"].isna()]

    if not has_ts.empty:
        sorted_df = has_ts.sort_values(
            ["consent_timestamp", "trust_score"], ascending=[False, False]
        )
    else:
        sorted_df = null_ts.sort_values("trust_score", ascending=False)

    most_recent     = sorted_df.iloc[0]
    most_recent_val = most_recent["consent_value"]
    most_recent_src = str(most_recent["consent_source"]).lower()

    # Withdrawn trust check
    withdrawn_rows = field_df[field_df["consent_value"] == "withdrawn"]
    review_flag = False
    if not withdrawn_rows.empty and most_recent_val == "opt_in":
        highest_withdrawn_trust = withdrawn_rows["trust_score"].max()
        if SOURCE_TRUST.get(most_recent_src, 0) < highest_withdrawn_trust:
            review_flag = True

    return most_recent_val, review_flag


def resolve_moscid(moscid_df):
    resolved     = {"moscid": moscid_df["moscid"].iloc[0]}
    review_flags = []

    for field in CONSENT_FIELDS:
        field_rows = moscid_df[moscid_df["consent_field"] == field]
        value, flag = resolve_field(field_rows)
        resolved[field] = value
        if flag:
            review_flags.append(field)

    # Suppression rules
    marketing_suppressed = False
    suppression_reason   = None
    if resolved.get("global_consent") in ("opt_out", "withdrawn"):
        marketing_suppressed = True
        suppression_reason   = "global_consent"
    if resolved.get("marketing_comms_optout") == "opt_out":
        marketing_suppressed = True
        suppression_reason   = suppression_reason or "marketing_comms_optout"

    resolved["marketing_suppressed"]  = marketing_suppressed
    resolved["suppression_reason"]    = suppression_reason
    resolved["withdrawn_review_flag"] = len(review_flags) > 0

    valid_ts = pd.to_datetime(
        moscid_df["consent_timestamp"], errors="coerce"
    ).dropna()
    resolved["consent_last_updated"] = (
        valid_ts.max().strftime('%Y-%m-%dT%H:%M:%S') if not valid_ts.empty else None
    )
    resolved["sources_seen"] = ",".join(
        sorted(moscid_df["consent_source"].dropna().unique().tolist())
    )
    resolved["resolved_at"] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')
    return resolved


# ── Main refresh ──────────────────────────────────────────────────────────────

def run_refresh():
    abort_if_uc_runtime("consent_refresh.py")

    start = datetime.now(timezone.utc)
    log("Starting consent refresh ...")

    if not os.path.exists(LEDGER_PATH):
        log(f"ERROR: Ledger not found at {LEDGER_PATH}")
        return False

    # ── Load ledger ───────────────────────────────────────────────────────────
    ledger = pd.read_csv(LEDGER_PATH, low_memory=False)
    ledger = ledger[ledger["moscid"].notna()].copy()
    log(f"Ledger loaded: {len(ledger):,} rows | {ledger['moscid'].nunique():,} unique MOSCIDs")

    # ── Survivorship ──────────────────────────────────────────────────────────
    log("Applying survivorship rules (latest timestamp wins per field) ...")
    resolved_rows = []
    moscids = ledger["moscid"].unique()

    for i, moscid in enumerate(moscids):
        if i % 500 == 0 and i > 0:
            log(f"  {i:,} / {len(moscids):,} processed ...")
        moscid_df = ledger[ledger["moscid"] == moscid]
        resolved_rows.append(resolve_moscid(moscid_df))

    resolved_df = pd.DataFrame(resolved_rows, columns=RESOLVED_COLS)

    # ── Write consent_resolved.csv ────────────────────────────────────────────
    resolved_df.to_csv(RESOLVED_PATH, index=False)
    log(f"consent_resolved.csv written: {len(resolved_df):,} MOSCIDs")

    # ── Write consent_golden_record.csv ───────────────────────────────────────
    golden_df = resolved_df.copy()
    golden_df["golden_record_updated_at"] = datetime.now(timezone.utc).strftime(
        '%Y-%m-%dT%H:%M:%S'
    )
    for col in GOLDEN_COLS:
        if col not in golden_df.columns:
            golden_df[col] = None
    golden_df[GOLDEN_COLS].to_csv(GOLDEN_PATH, index=False)
    log(f"consent_golden_record.csv written: {len(golden_df):,} MOSCIDs")

    # ── Suppression summary ───────────────────────────────────────────────────
    suppressed  = resolved_df[resolved_df["marketing_suppressed"] == True]
    email_block = resolved_df[resolved_df["marketing_email_consent"].isin(["opt_out", "withdrawn"])]
    log(f"Marketing suppressed : {len(suppressed):,}")
    log(f"Email blocked        : {len(email_block):,}")

    # ── Write sentinel file (signals API to reload) ───────────────────────────
    with open(SENTINEL_PATH, "w") as f:
        f.write(datetime.now(timezone.utc).isoformat())

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    log(f"Refresh complete in {elapsed:.1f}s")
    log(f"Sentinel written: {SENTINEL_PATH}")
    log("API will reload consent data on next request.")
    return True


if __name__ == "__main__":
    run_refresh()
