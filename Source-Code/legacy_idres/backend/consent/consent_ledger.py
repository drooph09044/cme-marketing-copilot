"""
consent_ledger.py
StreamPass CDP — Step 3: Consent Event Ledger

Reads consent_events_linked.csv and writes an append-only audit ledger.
Each row = one consent field change for one MOSCID.

Wide rows (one row per source record) are unpivoted into tall rows
(one row per consent field per record) so every field change is
independently auditable.

This table is NEVER updated — only appended.
It is the compliance backbone for regulatory queries.

Usage:
    python consent_ledger.py

Pipeline position:
    consent_idr_join.py  →  [THIS FILE]  →  consent_survivorship.py
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import numpy as np
import argparse
import os
import sys
from pathlib import Path
import hashlib
from datetime import datetime, timezone
from consent_runtime_guard import abort_if_uc_runtime

# ── Consent fields to track individually ─────────────────────────────────────
CONSENT_FIELDS = [
    "data_processing_consent",
    "global_consent",
    "marketing_comms_optout",
    "marketing_email_consent",
    "tracking_cookie_consent",
]

# Valid consent values — anything outside this is flagged
VALID_VALUES = {"opt_in", "opt_out", "withdrawn", None}

# Ledger output columns
LEDGER_COLS = [
    "ledger_id",            # deterministic hash — dedup key
    "moscid",
    "raw_identifier",
    "identifier_type",
    "consent_field",        # which field changed
    "consent_value",        # the new value
    "communication_type",
    "consent_timestamp",
    "consent_version",
    "consent_source",
    "agent_id",
    "source_file",
    "ledger_written_at",    # when this ledger row was written
    "value_valid",          # True/False — flags unexpected values
]


def log(msg):
    encoding = sys.stdout.encoding or "utf-8"
    safe_msg = str(msg).encode(encoding, errors="replace").decode(encoding)
    print(f"[consent_ledger] {safe_msg}")


def make_ledger_id(moscid, consent_field, consent_timestamp, consent_source):
    """
    Deterministic dedup key.
    Same event ingested twice produces the same ledger_id — safe to re-run.
    """
    raw = f"{moscid}|{consent_field}|{consent_timestamp}|{consent_source}"
    return hashlib.md5(raw.encode()).hexdigest()


def unpivot_to_ledger(df):
    """
    Convert wide consent_events_linked rows into tall ledger rows.
    One output row per (record × consent_field) where the field is not null.

    Null fields are excluded — a null means 'not captured at this source',
    not a consent state change. Never write null as a ledger entry.
    """
    ledger_rows = []
    written_at  = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')

    for _, row in df.iterrows():
        for field in CONSENT_FIELDS:
            value = row.get(field)

            # Skip nulls — not a consent event
            if pd.isna(value) or value is None:
                continue

            moscid    = row.get("moscid", "")
            ts        = row.get("consent_timestamp", "")
            source    = row.get("consent_source", "")

            ledger_rows.append({
                "ledger_id":          make_ledger_id(moscid, field, ts, source),
                "moscid":             moscid,
                "raw_identifier":     row.get("raw_identifier"),
                "identifier_type":    row.get("identifier_type"),
                "consent_field":      field,
                "consent_value":      value,
                "communication_type": row.get("communication_type"),
                "consent_timestamp":  ts,
                "consent_version":    row.get("consent_version"),
                "consent_source":     source,
                "agent_id":           row.get("agent_id"),
                "source_file":        row.get("source_file"),
                "ledger_written_at":  written_at,
                "value_valid":        str(value).lower() in {v for v in VALID_VALUES if v},
            })

    return pd.DataFrame(ledger_rows, columns=LEDGER_COLS)


def append_to_ledger(new_rows_df, ledger_path):
    """
    Append new rows to the ledger.
    If ledger already exists, deduplicates on ledger_id before appending
    so re-runs are safe.
    """
    if os.path.exists(ledger_path):
        existing = pd.read_csv(ledger_path, low_memory=False)
        log(f"  Existing ledger: {len(existing):,} rows")

        # Dedup — drop rows already in ledger
        existing_ids = set(existing["ledger_id"].astype(str))
        new_rows_df  = new_rows_df[~new_rows_df["ledger_id"].isin(existing_ids)]
        log(f"  New rows after dedup: {len(new_rows_df):,}")

        combined = pd.concat([existing, new_rows_df], ignore_index=True)
    else:
        log("  No existing ledger — creating fresh.")
        combined = new_rows_df

    combined.to_csv(ledger_path, index=False)
    return len(new_rows_df)


def validate_ledger(df):
    """
    Run basic quality checks on the ledger batch.
    Logs warnings — does not block ingestion.
    """
    issues = []

    # Invalid values
    invalid = df[~df["value_valid"]]
    if len(invalid):
        issues.append(f"  ⚠  {len(invalid)} rows with unexpected consent values:")
        for val, grp in invalid.groupby("consent_value"):
            issues.append(f"     '{val}' — {len(grp)} rows")

    # Missing MOSCID
    no_mosc = df["moscid"].isna().sum()
    if no_mosc:
        issues.append(f"  ⚠  {no_mosc} rows with null MOSCID")

    # Missing timestamps
    no_ts = df["consent_timestamp"].isna().sum()
    if no_ts:
        issues.append(f"  ⚠  {no_ts} rows with null consent_timestamp")

    # call_center rows without agent_id
    call_rows = df[df["consent_source"] == "call_center"]
    missing_agent = call_rows["agent_id"].isna().sum()
    if missing_agent:
        issues.append(f"  ⚠  {missing_agent} call_center rows missing agent_id (audit risk)")

    if issues:
        log("  Validation warnings:")
        for i in issues:
            log(i)
    else:
        log("  ✓ Validation passed — no issues found")

    return df


def print_summary(ledger_df):
    log(f"\n{'─'*60}")
    log("LEDGER CONTENTS SUMMARY")
    log(f"{'─'*60}")
    log(f"Total ledger rows : {len(ledger_df):,}")
    log(f"Unique MOSCIDs    : {ledger_df['moscid'].nunique():,}")

    log(f"\nRows by consent_field:")
    for field, grp in ledger_df.groupby("consent_field"):
        vc = grp["consent_value"].value_counts().to_dict()
        log(f"  {field:<35} {vc}")

    log(f"\nRows by consent_source:")
    for src, grp in ledger_df.groupby("consent_source"):
        log(f"  {src:<25} {len(grp):>6,} rows")


def main(linked_path, ledger_path):
    abort_if_uc_runtime("consent_ledger.py")

    if not os.path.exists(linked_path):
        log(f"ERROR: Input file not found: {linked_path}")
        return

    log(f"Reading: {linked_path}")
    df = pd.read_csv(linked_path, low_memory=False)
    log(f"Loaded {len(df):,} linked consent events")

    log("\nUnpivoting to ledger format ...")
    ledger_df = unpivot_to_ledger(df)
    log(f"Ledger rows generated: {len(ledger_df):,}")

    log("\nValidating ...")
    ledger_df = validate_ledger(ledger_df)

    log(f"\nAppending to ledger: {ledger_path}")
    rows_added = append_to_ledger(ledger_df, ledger_path)

    print_summary(pd.read_csv(ledger_path, low_memory=False))

    log(f"\n{'═'*60}")
    log("LEDGER WRITE COMPLETE")
    log(f"{'═'*60}")
    log(f"Rows added this run : {rows_added:,}")
    log(f"Ledger path         : {os.path.abspath(ledger_path)}")
    log(f"{'═'*60}")
    log("Next step → consent_survivorship.py")


if __name__ == "__main__":
    BASE = str(Path(__file__).resolve().parent.parent.parent / "generated_data" / "enriched")

    parser = argparse.ArgumentParser(description="Consent Event Ledger — append-only audit log")
    parser.add_argument(
        "--linked_path",
        default=os.path.join(BASE, "consent_events_linked.csv"),
        help="Path to consent_events_linked.csv (output of consent_idr_join.py)"
    )
    parser.add_argument(
        "--ledger_path",
        default=os.path.join(BASE, "consent_event_ledger.csv"),
        help="Path to the ledger file (created if not exists, appended if exists)"
    )
    args = parser.parse_args()
    main(args.linked_path, args.ledger_path)
