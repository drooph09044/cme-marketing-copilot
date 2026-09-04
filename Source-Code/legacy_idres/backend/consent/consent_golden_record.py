"""
consent_golden_record.py
StreamPass CDP — Step 5: Consent Golden Record

Reads consent_resolved.csv and merges the consent block into the
main golden record (golden_record.csv).

If golden_record.csv does not exist yet, writes a standalone
consent_golden_record.csv that can be joined later.

Every MOSCID gets a clean consent sub-block:
    - All 5 resolved consent fields
    - marketing_suppressed flag
    - suppression_reason
    - withdrawn_review_flag
    - consent_last_updated
    - sources_seen

Usage:
    python consent_golden_record.py

Pipeline position:
    consent_survivorship.py  →  [THIS FILE]  →  consent_gate.py
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

CONSENT_BLOCK_COLS = [
    "data_processing_consent",
    "global_consent",
    "marketing_comms_optout",
    "marketing_email_consent",
    "tracking_cookie_consent",
    "marketing_suppressed",
    "suppression_reason",
    "withdrawn_review_flag",
    "consent_last_updated",
    "sources_seen",
]

OUTPUT_COLS = [
    "moscid",
    "data_processing_consent",
    "global_consent",
    "marketing_comms_optout",
    "marketing_email_consent",
    "tracking_cookie_consent",
    "marketing_suppressed",
    "suppression_reason",
    "withdrawn_review_flag",
    "consent_last_updated",
    "sources_seen",
    "golden_record_updated_at",
]


def log(msg):
    encoding = sys.stdout.encoding or "utf-8"
    safe_msg = str(msg).encode(encoding, errors="replace").decode(encoding)
    print(f"[consent_golden_record] {safe_msg}")


def build_consent_block(resolved_df):
    """
    Produce a clean consent block from consent_resolved.
    One row per MOSCID with all consent fields + flags.
    """
    block = resolved_df[["moscid"] + CONSENT_BLOCK_COLS].copy()
    block["golden_record_updated_at"] = datetime.now(timezone.utc).strftime(
        '%Y-%m-%dT%H:%M:%S'
    )
    return block


def merge_with_golden_record(consent_block, golden_path):
    """
    If golden_record.csv exists:
        - Load it
        - Drop any existing consent columns to avoid duplicates
        - Left-join consent block on moscid
        - Write back to golden_record.csv

    If it doesn't exist:
        - Write consent block as standalone consent_golden_record.csv
        - Log a note for when golden record is ready
    """
    if os.path.exists(golden_path):
        log(f"  Golden record found: {golden_path}")
        golden = pd.read_csv(golden_path, low_memory=False)
        log(f"  Loaded {len(golden):,} golden record rows")

        # Drop stale consent columns if they exist
        stale_cols = [c for c in CONSENT_BLOCK_COLS + ["golden_record_updated_at"]
                      if c in golden.columns]
        if stale_cols:
            golden = golden.drop(columns=stale_cols)
            log(f"  Dropped {len(stale_cols)} stale consent columns before merge")

        merged = golden.merge(consent_block, on="moscid", how="left")
        log(f"  Merged: {len(merged):,} rows | "
            f"{merged['marketing_suppressed'].sum():,} MOSCIDs marketing-suppressed")

        merged.to_csv(golden_path, index=False)
        log(f"  ✓ Golden record updated: {golden_path}")
        return merged, "merged"

    else:
        log(f"  ⚠  Golden record not found at: {golden_path}")
        log(f"  Writing standalone consent block — merge when golden record is ready.")
        return consent_block, "standalone"


def print_summary(df, mode):
    log(f"\n{'─'*60}")
    log("CONSENT GOLDEN RECORD SUMMARY")
    log(f"{'─'*60}")
    log(f"Mode                      : {mode.upper()}")
    log(f"MOSCIDs in consent block  : {df['moscid'].nunique():,}")
    log(f"Marketing suppressed      : {df['marketing_suppressed'].sum():,}")
    log(f"Withdrawn review flags    : {df['withdrawn_review_flag'].sum():,}")

    log(f"\nConsent field breakdown:")
    for field in [
        "data_processing_consent", "global_consent",
        "marketing_email_consent", "tracking_cookie_consent"
    ]:
        if field in df.columns:
            vc = df[field].value_counts(dropna=False).to_dict()
            log(f"  {field:<35} {vc}")

    log(f"\nTop sources seen:")
    if "sources_seen" in df.columns:
        from collections import Counter
        source_counter = Counter()
        for s in df["sources_seen"].dropna():
            for src in s.split(","):
                source_counter[src.strip()] += 1
        for src, count in source_counter.most_common():
            log(f"  {src:<25} {count:>6,} MOSCIDs")


def main(resolved_path, golden_path, output_path):
    abort_if_uc_runtime("consent_golden_record.py")

    if not os.path.exists(resolved_path):
        log(f"ERROR: consent_resolved.csv not found: {resolved_path}")
        return

    log(f"Reading: {resolved_path}")
    resolved_df = pd.read_csv(resolved_path, low_memory=False)
    log(f"Loaded {len(resolved_df):,} resolved consent rows")

    log("\nBuilding consent block ...")
    consent_block = build_consent_block(resolved_df)

    log("\nMerging with golden record ...")
    final_df, mode = merge_with_golden_record(consent_block, golden_path)

    # Always write the standalone consent block regardless
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    consent_block[OUTPUT_COLS].to_csv(output_path, index=False)

    print_summary(consent_block, mode)

    log(f"\n{'═'*60}")
    log("GOLDEN RECORD CONSENT MERGE COMPLETE")
    log(f"{'═'*60}")
    log(f"Consent block written : {os.path.abspath(output_path)}")
    if mode == "merged":
        log(f"Golden record updated : {os.path.abspath(golden_path)}")
    else:
        log(f"Standalone file ready — merge into golden record when available.")
    log(f"{'═'*60}")
    log("Next step → consent_gate.py")


if __name__ == "__main__":
    BASE        = str(Path(__file__).resolve().parent.parent.parent / "generated_data" / "enriched")
    GOLDEN_BASE = str(Path(__file__).resolve().parent.parent.parent / "generated_data" / "enriched")

    parser = argparse.ArgumentParser(
        description="Consent Golden Record — merge consent block into golden record"
    )
    parser.add_argument(
        "--resolved_path",
        default=os.path.join(BASE, "consent_resolved.csv"),
        help="Path to consent_resolved.csv (output of consent_survivorship.py)"
    )
    parser.add_argument(
        "--golden_path",
        default=os.path.join(GOLDEN_BASE, "golden_record.csv"),
        help="Path to existing golden_record.csv — merged in-place if found"
    )
    parser.add_argument(
        "--output_path",
        default=os.path.join(BASE, "consent_golden_record.csv"),
        help="Path to write standalone consent block (always written)"
    )
    args = parser.parse_args()
    main(args.resolved_path, args.golden_path, args.output_path)
