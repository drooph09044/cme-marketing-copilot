"""
consent_gate.py
StreamPass CDP — Step 6: Consent Gate Enforcement

Runs at campaign execution time — NOT at ingestion time.
Reads consent_golden_record.csv and evaluates every MOSCID
in a target segment against the gate rules.

Gate rules (evaluated in order — first match wins):
    Rule 1 — Transactional bypass:
              communication_type = "transactional" → always SEND
    Rule 2 — Social bypass:
              channel = "social" → always SEND (platform handles consent)
    Rule 3 — Global suppress:
              global_consent = opt_out / withdrawn → BLOCK
    Rule 4 — Comms optout suppress:
              marketing_comms_optout = opt_out → BLOCK
    Rule 5 — Email suppress:
              marketing_email_consent = opt_out / withdrawn → BLOCK (email only)
    Rule 6 — Null passthrough:
              null on any field = opted in by default → SEND

Output:
    consent_gate_results.csv    — full decision log per MOSCID
    suppression_list.csv        — BLOCK-only list for email platform upload

Usage:
    python consent_gate.py --channel email
    python consent_gate.py --channel email --segment_path ./my_segment.csv
    python consent_gate.py --channel transactional

Pipeline position:
    consent_golden_record.py  →  [THIS FILE]  →  suppression_list.csv
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import numpy as np
import argparse
import os
from pathlib import Path
from datetime import datetime, timezone
from consent_runtime_guard import abort_if_uc_runtime

VALID_CHANNELS = ["email", "transactional", "social", "sms", "push"]

GATE_COLS = [
    "moscid",
    "channel",
    "gate_result",       # SEND | BLOCK | BYPASS
    "rule_fired",        # which rule made the decision
    "global_consent",
    "marketing_comms_optout",
    "marketing_email_consent",
    "marketing_suppressed",
    "evaluated_at",
]


def log(msg):
    print(f"[consent_gate] {msg}")


# ── Gate logic ────────────────────────────────────────────────────────────────

def evaluate_row(row, channel):
    """
    Evaluate one MOSCID against the gate for a given channel.
    Returns (gate_result, rule_fired).
    """

    # Rule 1 — Transactional bypass
    if channel == "transactional":
        return "BYPASS", "transactional_bypass"

    # Rule 2 — Social bypass
    if channel == "social":
        return "BYPASS", "social_bypass"

    # Rule 3 — Global consent block
    global_consent = row.get("global_consent")
    if pd.notna(global_consent) and str(global_consent).lower() in ("opt_out", "withdrawn"):
        return "BLOCK", "global_consent"

    # Rule 4 — Marketing comms optout block
    comms_optout = row.get("marketing_comms_optout")
    if pd.notna(comms_optout) and str(comms_optout).lower() == "opt_out":
        return "BLOCK", "marketing_comms_optout"

    # Rule 5 — Channel-specific block (email only for now)
    if channel == "email":
        email_consent = row.get("marketing_email_consent")
        if pd.notna(email_consent) and str(email_consent).lower() in ("opt_out", "withdrawn"):
            return "BLOCK", "marketing_email_consent"

    # Rule 6 — Null passthrough → SEND
    return "SEND", "null_passthrough"


def run_gate(consent_df, channel, segment_moscids=None):
    """
    Run gate evaluation across all MOSCIDs (or segment subset).
    Returns full results dataframe.
    """
    evaluated_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')

    # Filter to segment if provided
    if segment_moscids is not None:
        before = len(consent_df)
        consent_df = consent_df[consent_df["moscid"].isin(segment_moscids)].copy()
        log(f"  Segment filter: {len(consent_df):,} MOSCIDs matched "
            f"({before - len(consent_df):,} not in consent record — treated as SEND)")

        # MOSCIDs in segment but not in consent record → SEND by null rule
        missing = set(segment_moscids) - set(consent_df["moscid"])
        if missing:
            missing_rows = pd.DataFrame({
                "moscid":                missing,
                "global_consent":        None,
                "marketing_comms_optout": None,
                "marketing_email_consent": None,
                "marketing_suppressed":  False,
            })
            consent_df = pd.concat([consent_df, missing_rows], ignore_index=True)
            log(f"  {len(missing):,} MOSCIDs not in consent record → defaulting to SEND")

    results = []
    for _, row in consent_df.iterrows():
        gate_result, rule_fired = evaluate_row(row, channel)
        results.append({
            "moscid":                 row.get("moscid"),
            "channel":                channel,
            "gate_result":            gate_result,
            "rule_fired":             rule_fired,
            "global_consent":         row.get("global_consent"),
            "marketing_comms_optout": row.get("marketing_comms_optout"),
            "marketing_email_consent":row.get("marketing_email_consent"),
            "marketing_suppressed":   row.get("marketing_suppressed", False),
            "evaluated_at":           evaluated_at,
        })

    return pd.DataFrame(results, columns=GATE_COLS)


def print_summary(results_df, channel):
    total   = len(results_df)
    send    = (results_df["gate_result"] == "SEND").sum()
    block   = (results_df["gate_result"] == "BLOCK").sum()
    bypass  = (results_df["gate_result"] == "BYPASS").sum()

    log(f"\n{'─'*60}")
    log(f"GATE RESULTS — channel: {channel.upper()}")
    log(f"{'─'*60}")
    log(f"Total MOSCIDs evaluated : {total:,}")
    log(f"  SEND                  : {send:,}  ({send/max(total,1)*100:.1f}%)")
    log(f"  BLOCK                 : {block:,}  ({block/max(total,1)*100:.1f}%)")
    log(f"  BYPASS                : {bypass:,}  ({bypass/max(total,1)*100:.1f}%)")

    if block > 0:
        log(f"\nBlock breakdown by rule:")
        for rule, grp in results_df[results_df["gate_result"] == "BLOCK"].groupby("rule_fired"):
            log(f"  {rule:<35} {len(grp):>6,}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main(golden_path, output_dir, channel, segment_path):
    abort_if_uc_runtime("consent_gate.py")

    if not os.path.exists(golden_path):
        log(f"ERROR: consent_golden_record.csv not found: {golden_path}")
        return

    os.makedirs(output_dir, exist_ok=True)

    log(f"Reading consent golden record: {golden_path}")
    consent_df = pd.read_csv(golden_path, low_memory=False)
    log(f"Loaded {len(consent_df):,} MOSCIDs")
    log(f"Channel: {channel.upper()}")

    # Load segment if provided
    segment_moscids = None
    if segment_path and os.path.exists(segment_path):
        seg_df = pd.read_csv(segment_path, low_memory=False)
        # Accept either 'moscid' column or first column
        id_col = "moscid" if "moscid" in seg_df.columns else seg_df.columns[0]
        segment_moscids = set(seg_df[id_col].dropna().astype(str))
        log(f"Segment loaded: {len(segment_moscids):,} MOSCIDs from {segment_path}")
    else:
        log("No segment file — evaluating all MOSCIDs in consent record")

    log("\nRunning gate evaluation ...")
    results_df = run_gate(consent_df, channel, segment_moscids)

    # ── Write gate results ─────────────────────────────────────────────────
    gate_path = os.path.join(output_dir, f"consent_gate_results_{channel}.csv")
    results_df.to_csv(gate_path, index=False)
    log(f"\nGate results written: {gate_path}")

    # ── Write suppression list (BLOCK only) ────────────────────────────────
    suppression_df = results_df[results_df["gate_result"] == "BLOCK"][["moscid", "rule_fired"]]
    suppression_path = os.path.join(output_dir, f"suppression_list_{channel}.csv")
    suppression_df.to_csv(suppression_path, index=False)
    log(f"Suppression list written: {suppression_path}")

    print_summary(results_df, channel)

    log(f"\n{'═'*60}")
    log("GATE EVALUATION COMPLETE")
    log(f"{'═'*60}")
    log(f"Gate results    : {os.path.abspath(gate_path)}")
    log(f"Suppression list: {os.path.abspath(suppression_path)}")
    log(f"{'═'*60}")
    log("Next step → consent_api.py (Step 7)")


if __name__ == "__main__":
    BASE = str(Path(__file__).resolve().parent.parent.parent / "consent_data" / "enriched")

    parser = argparse.ArgumentParser(description="Consent Gate — evaluate MOSCIDs for a campaign send")
    parser.add_argument(
        "--golden_path",
        default=os.path.join(BASE, "consent_golden_record.csv"),
        help="Path to consent_golden_record.csv"
    )
    parser.add_argument(
        "--output_dir",
        default=BASE,
        help="Directory to write gate results and suppression list"
    )
    parser.add_argument(
        "--channel",
        default="email",
        choices=VALID_CHANNELS,
        help="Campaign channel: email | transactional | social | sms | push"
    )
    parser.add_argument(
        "--segment_path",
        default=None,
        help="Optional: path to segment CSV with 'moscid' column — runs gate on segment only"
    )
    args = parser.parse_args()
    main(args.golden_path, args.output_dir, args.channel, args.segment_path)
