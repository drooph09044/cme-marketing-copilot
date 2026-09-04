"""
consent_survivorship.py
StreamPass CDP — Step 4: Consent Survivorship

Reads consent_event_ledger.csv and reduces it to one resolved consent
state per MOSCID by applying priority rules in order.

Priority rules (applied in sequence):
    Rule 1 — Global override:
              global_consent = opt_out / withdrawn → locks all marketing
    Rule 2 — Withdrawn trust:
              'withdrawn' from call_center cannot be silently reversed by
              a later opt_in from a lower-trust source — flagged for review
    Rule 3 — Most recent timestamp wins (per field, per MOSCID)
    Rule 4 — marketing_comms_optout:
              if opt_out → suppress all marketing (does not affect transactional)
    Rule 5 — Null passthrough:
              no ledger entry for a field → resolved value stays null (= opted in)

Output: consent_resolved.csv — one row per MOSCID

Usage:
    python consent_survivorship.py

Pipeline position:
    consent_ledger.py  →  [THIS FILE]  →  consent_golden_record.py
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import numpy as np
import argparse
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from consent_runtime_guard import abort_if_uc_runtime

# ── Source trust hierarchy ────────────────────────────────────────────────────
# Higher number = higher trust
SOURCE_TRUST = {
    "call_center":      4,
    "billing":          3,
    "email_engagement": 2,
    "website_banner":   1,
    "mobile_app":       1,
}

# Consent fields to resolve
CONSENT_FIELDS = [
    "data_processing_consent",
    "global_consent",
    "marketing_comms_optout",
    "marketing_email_consent",
    "tracking_cookie_consent",
]

# Output schema
RESOLVED_COLS = [
    "moscid",
    "data_processing_consent",
    "global_consent",
    "marketing_comms_optout",
    "marketing_email_consent",
    "tracking_cookie_consent",
    "marketing_suppressed",         # True if any suppression rule fires
    "suppression_reason",           # which rule triggered suppression
    "withdrawn_review_flag",        # True if withdrawn reversed by lower-trust source
    "consent_last_updated",         # most recent timestamp across all fields
    "sources_seen",                 # comma-separated list of sources with events
    "resolved_at",                  # when survivorship was run
]


def log(msg):
    encoding = sys.stdout.encoding or "utf-8"
    safe_msg = str(msg).encode(encoding, errors="replace").decode(encoding)
    print(f"[consent_survivorship] {safe_msg}")


# ── Rule engine ───────────────────────────────────────────────────────────────

def resolve_field_for_moscid(field_df):
    """
    For a single MOSCID + single consent_field:
    Apply Rule 2 (withdrawn trust) then Rule 3 (most recent wins).

    Returns: (resolved_value, withdrawn_review_flag)
    """
    if field_df.empty:
        return None, False

    # Sort by timestamp descending, then trust descending
    field_df = field_df.copy()
    field_df["trust_score"] = field_df["consent_source"].map(
        lambda s: SOURCE_TRUST.get(str(s).lower(), 0)
    )
    field_df["consent_timestamp"] = pd.to_datetime(
        field_df["consent_timestamp"], errors="coerce"
    )
    # Separate rows with valid timestamps from null-timestamp rows
    has_ts  = field_df[field_df["consent_timestamp"].notna()].copy()
    null_ts = field_df[field_df["consent_timestamp"].isna()].copy()

    if not has_ts.empty:
        # Prefer most recent timestamp, then highest trust as tiebreaker
        field_df = has_ts.sort_values(
            ["consent_timestamp", "trust_score"],
            ascending=[False, False]
        )
    else:
        # No timestamps at all — fall back to trust hierarchy only
        field_df = null_ts.sort_values("trust_score", ascending=False)

    most_recent      = field_df.iloc[0]
    most_recent_val  = most_recent["consent_value"]
    most_recent_src  = str(most_recent["consent_source"]).lower()

    # Rule 2 — Withdrawn trust check
    # If any prior row is 'withdrawn' from call_center,
    # and the most recent row is opt_in from a lower-trust source → flag it
    withdrawn_rows = field_df[field_df["consent_value"] == "withdrawn"]
    review_flag = False

    if not withdrawn_rows.empty and most_recent_val == "opt_in":
        highest_withdrawn_trust = withdrawn_rows["trust_score"].max()
        if SOURCE_TRUST.get(most_recent_src, 0) < highest_withdrawn_trust:
            review_flag = True
            # Still honour most recent — but flag for manual review
            # (do not silently suppress the opt_in)

    return most_recent_val, review_flag


def resolve_moscid(moscid_df):
    """
    Full resolution for one MOSCID across all consent fields.
    Returns a dict representing one row of consent_resolved.csv.
    """
    resolved = {"moscid": moscid_df["moscid"].iloc[0]}
    review_flags = []

    # ── Rule 3 + Rule 2 per field ─────────────────────────────────────────
    for field in CONSENT_FIELDS:
        field_rows = moscid_df[moscid_df["consent_field"] == field]
        value, flag = resolve_field_for_moscid(field_rows)
        resolved[field] = value
        if flag:
            review_flags.append(field)

    # ── Rule 1 — Global override ──────────────────────────────────────────
    marketing_suppressed = False
    suppression_reason   = None

    if resolved.get("global_consent") in ("opt_out", "withdrawn"):
        marketing_suppressed = True
        suppression_reason   = "global_consent"

    # ── Rule 4 — marketing_comms_optout ───────────────────────────────────
    if resolved.get("marketing_comms_optout") == "opt_out":
        marketing_suppressed = True
        suppression_reason   = suppression_reason or "marketing_comms_optout"

    resolved["marketing_suppressed"]   = marketing_suppressed
    resolved["suppression_reason"]     = suppression_reason
    resolved["withdrawn_review_flag"]  = len(review_flags) > 0

    # ── Metadata ──────────────────────────────────────────────────────────
    valid_ts = pd.to_datetime(moscid_df["consent_timestamp"], errors="coerce").dropna()
    resolved["consent_last_updated"] = (
        valid_ts.max().strftime('%Y-%m-%dT%H:%M:%S') if not valid_ts.empty else None
    )
    resolved["sources_seen"] = ",".join(
        sorted(moscid_df["consent_source"].dropna().unique().tolist())
    )
    resolved["resolved_at"] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')

    return resolved


# ── Main ──────────────────────────────────────────────────────────────────────

def main(ledger_path, resolved_path):
    abort_if_uc_runtime("consent_survivorship.py")

    if not os.path.exists(ledger_path):
        log(f"ERROR: Ledger not found: {ledger_path}")
        return

    log(f"Reading ledger: {ledger_path}")
    ledger = pd.read_csv(ledger_path, low_memory=False)
    log(f"Loaded {len(ledger):,} ledger rows | {ledger['moscid'].nunique():,} unique MOSCIDs")

    # Only work on linked rows with a valid MOSCID
    ledger = ledger[ledger["moscid"].notna()].copy()

    log("\nApplying survivorship rules per MOSCID ...")
    resolved_rows = []
    moscids = ledger["moscid"].unique()
    total   = len(moscids)

    for i, moscid in enumerate(moscids):
        if i % 500 == 0:
            log(f"  Processing {i:,} / {total:,} ...")
        moscid_df   = ledger[ledger["moscid"] == moscid]
        resolved_rows.append(resolve_moscid(moscid_df))

    resolved_df = pd.DataFrame(resolved_rows, columns=RESOLVED_COLS)

    # ── Save ──────────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(resolved_path), exist_ok=True)
    resolved_df.to_csv(resolved_path, index=False)

    # ── Summary ───────────────────────────────────────────────────────────
    log(f"\n{'═'*60}")
    log("SURVIVORSHIP COMPLETE")
    log(f"{'═'*60}")
    log(f"MOSCIDs resolved          : {len(resolved_df):,}")
    log(f"Marketing suppressed      : {resolved_df['marketing_suppressed'].sum():,}")
    log(f"  → via global_consent    : {(resolved_df['suppression_reason']=='global_consent').sum():,}")
    log(f"  → via comms_optout      : {(resolved_df['suppression_reason']=='marketing_comms_optout').sum():,}")
    log(f"Withdrawn review flags    : {resolved_df['withdrawn_review_flag'].sum():,}")

    log(f"\nResolved values per field:")
    for field in CONSENT_FIELDS:
        vc = resolved_df[field].value_counts(dropna=False).to_dict()
        log(f"  {field:<35} {vc}")

    log(f"\nOutput : {os.path.abspath(resolved_path)}")
    log(f"{'═'*60}")
    log("Next step → consent_golden_record.py")


if __name__ == "__main__":
    BASE = str(Path(__file__).resolve().parent.parent.parent / "generated_data" / "enriched")

    parser = argparse.ArgumentParser(description="Consent Survivorship — one resolved state per MOSCID")
    parser.add_argument(
        "--ledger_path",
        default=os.path.join(BASE, "consent_event_ledger.csv"),
        help="Path to consent_event_ledger.csv (output of consent_ledger.py)"
    )
    parser.add_argument(
        "--resolved_path",
        default=os.path.join(BASE, "consent_resolved.csv"),
        help="Path to write consent_resolved.csv"
    )
    args = parser.parse_args()
    main(args.ledger_path, args.resolved_path)
