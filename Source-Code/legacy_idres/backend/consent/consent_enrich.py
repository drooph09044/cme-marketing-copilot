"""
consent_enrich.py
StreamPass CDP — Consent Column Enrichment
Adds consent fields to all 5 source files based on confirmed spec.

Usage:
    python consent_enrich.py --input_dir ./data --output_dir ./data_enriched

Each file is enriched independently. Original files are never modified.
Output files are written to output_dir with the same filenames.
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import numpy as np
import argparse
import os
import sys
from pathlib import Path
import random
from datetime import datetime, timedelta
from consent_runtime_guard import abort_if_uc_runtime

# ── Reproducibility ──────────────────────────────────────────────────────────
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

# ── Consent value pools ───────────────────────────────────────────────────────
# Weighted choices: (value, weight)
BILLING_DATA_PROCESSING = ["opt_in"] * 92 + ["opt_out"] * 5 + [None] * 3
BILLING_GLOBAL_CONSENT  = ["opt_in"] * 88 + ["opt_out"] * 8 + [None] * 4
CONSENT_VERSIONS        = ["v2.0"] * 30 + ["v2.1"] * 70   # v2.1 is current

# ~15% of streaming rows had a cookie banner interaction
STREAMING_BANNER_RATE   = 0.15
STREAMING_BANNER_CHOICE = ["opt_in"] * 68 + ["opt_out"] * 32   # 68/32 split

# ~20% of app sessions had ATT / tracking prompt
APP_ATT_RATE            = 0.20
APP_ATT_CHOICE          = ["opt_in"] * 60 + ["opt_out"] * 40

# Support call types that map to specific consent outcomes
SUPPORT_EMAIL_OPTOUT_CALLS  = ["opt_out_request", "unsubscribe", "email_complaint"]
SUPPORT_EMAIL_OPTIN_CALLS   = ["resubscribe_request", "opt_in_request"]
SUPPORT_GLOBAL_OPTOUT_CALLS = ["remove_everything", "gdpr_erasure", "do_not_contact"]
SUPPORT_WITHDRAWN_CALLS     = ["gdpr_erasure", "do_not_contact"]

AGENT_IDS = [f"AGT-{str(i).zfill(3)}" for i in range(101, 130)]


# ── Helpers ───────────────────────────────────────────────────────────────────

def random_offset_datetime(base_dt_series, max_offset_seconds=300):
    """Add a small random offset (0–max seconds) to a datetime series."""
    offsets = np.random.randint(0, max_offset_seconds, size=len(base_dt_series))
    return pd.to_datetime(base_dt_series) + pd.to_timedelta(offsets, unit='s')


def null_safe_choice(pool, size):
    """
    Sample from a pool that may include None values.
    Returns a list (not np.array) to preserve None correctly.
    """
    return [random.choice(pool) for _ in range(size)]


def log(msg):
    encoding = sys.stdout.encoding or "utf-8"
    safe_msg = str(msg).encode(encoding, errors="replace").decode(encoding)
    print(f"[consent_enrich] {safe_msg}")


def validate_agent_ids(df):
    """Flag rows with missing agent_id — required for compliance."""
    missing = df['agent_id'].isna().sum()
    if missing > 0:
        log(f"  ⚠  WARNING: {missing} customer_support rows missing agent_id — "
            f"flagged as audit_incomplete")
        df['audit_flag'] = np.where(df['agent_id'].isna(), 'audit_incomplete', None)
    return df


# ── Per-file enrichment functions ─────────────────────────────────────────────

def enrich_subscription_billing(df):
    """
    Adds: data_processing_consent, global_consent, consent_timestamp,
          consent_version, consent_source
    All values synthetic except consent_source which is hardcoded.
    Null rule: uncaptured fields stay null — never default to opt_out.
    """
    log("  Enriching subscription_billing ...")
    n = len(df)

    # Only add columns that don't already exist
    if 'data_processing_consent' not in df.columns:
        df['data_processing_consent'] = null_safe_choice(BILLING_DATA_PROCESSING, n)

    if 'global_consent' not in df.columns:
        df['global_consent'] = null_safe_choice(BILLING_GLOBAL_CONSENT, n)

    if 'consent_timestamp' not in df.columns:
        # Use signup_date as base; consent captured a few seconds after
        base = df['signup_date'] if 'signup_date' in df.columns else pd.Timestamp('2024-01-01')
        df['consent_timestamp'] = random_offset_datetime(
            pd.to_datetime(df.get('signup_date', pd.Series([base] * n))),
            max_offset_seconds=120
        ).dt.strftime('%Y-%m-%dT%H:%M:%S')

    if 'consent_version' not in df.columns:
        df['consent_version'] = random.choices(
            ["v2.0", "v2.1"], weights=[30, 70], k=n
        )

    # Always hardcode — not user-captured
    df['consent_source'] = 'billing'

    log(f"  ✓  {n} rows enriched")
    return df


def enrich_email_engagement(df):
    """
    Adds: marketing_email_consent, consent_timestamp, consent_source
    Critical rule: unsubscribe event_type → opt_out directly on marketing_email_consent.
    Re-subscribe / subscribe → opt_in.
    Other event types → null (not a consent event).
    """
    log("  Enriching email_engagement ...")
    n = len(df)

    if 'marketing_email_consent' not in df.columns:
        df['marketing_email_consent'] = None

    # Map from event_type — this is the critical behavioral fix
    if 'event_type' in df.columns:
        df['marketing_email_consent'] = np.where(
            df['event_type'].str.lower().isin(['unsubscribe']),
            'opt_out',
            np.where(
                df['event_type'].str.lower().isin(['subscribe', 're_subscribe', 'resubscribe']),
                'opt_in',
                df['marketing_email_consent']   # leave null for non-consent event types
            )
        )
    else:
        # No event_type column — generate synthetic values
        log("  ⚠  event_type column not found — generating synthetic marketing_email_consent")
        df['marketing_email_consent'] = random.choices(
            ['opt_in', 'opt_out'], weights=[60, 40], k=n
        )

    # consent_timestamp = event timestamp (same moment as the subscribe/unsubscribe)
    if 'consent_timestamp' not in df.columns:
        ts_col = next(
            (c for c in ['event_timestamp', 'activity_timestamp', 'timestamp'] if c in df.columns),
            None
        )
        if ts_col:
            df['consent_timestamp'] = pd.to_datetime(df[ts_col]).dt.strftime('%Y-%m-%dT%H:%M:%S')
        else:
            df['consent_timestamp'] = pd.Timestamp('2024-01-01T00:00:00')

    # Null out consent_timestamp for non-consent rows (null marketing_email_consent)
    df['consent_timestamp'] = np.where(
        df['marketing_email_consent'].isna(),
        None,
        df['consent_timestamp']
    )

    df['consent_source'] = 'email_engagement'

    log(f"  ✓  {n} rows enriched | "
        f"opt_in: {(df['marketing_email_consent']=='opt_in').sum()} | "
        f"opt_out: {(df['marketing_email_consent']=='opt_out').sum()} | "
        f"null (non-consent rows): {df['marketing_email_consent'].isna().sum()}")
    return df


def enrich_streaming_activity(df):
    """
    Adds: tracking_cookie_consent, consent_timestamp, consent_source
    Most rows are passive activity — consent columns stay null.
    Only ~15% of rows had a cookie banner interaction.
    Null rule strictly enforced — passive rows must not get opt_out.
    """
    log("  Enriching streaming_activity ...")
    n = len(df)

    # Randomly select ~15% of rows as banner-interaction rows
    banner_mask = np.random.rand(n) < STREAMING_BANNER_RATE

    if 'tracking_cookie_consent' not in df.columns:
        df['tracking_cookie_consent'] = None
        df.loc[banner_mask, 'tracking_cookie_consent'] = [
            random.choice(STREAMING_BANNER_CHOICE)
            for _ in range(banner_mask.sum())
        ]

    if 'consent_timestamp' not in df.columns:
        df['consent_timestamp'] = None
        ts_col = next(
            (c for c in ['activity_timestamp', 'event_timestamp', 'timestamp'] if c in df.columns),
            None
        )
        if ts_col:
            # Banner fires just before the page activity
            banner_ts = (
                pd.to_datetime(df.loc[banner_mask, ts_col]) -
                pd.to_timedelta(np.random.randint(5, 30, size=banner_mask.sum()), unit='s')
            ).dt.strftime('%Y-%m-%dT%H:%M:%S')
            df.loc[banner_mask, 'consent_timestamp'] = banner_ts.values

    # consent_source only on rows where consent was captured
    df['consent_source'] = None
    df.loc[banner_mask, 'consent_source'] = 'website_banner'

    log(f"  ✓  {n} rows enriched | "
        f"banner interactions: {banner_mask.sum()} ({banner_mask.mean()*100:.1f}%) | "
        f"passive (null): {(~banner_mask).sum()}")
    return df


def enrich_customer_support(df):
    """
    Adds: marketing_email_consent, global_consent, consent_timestamp,
          consent_source, agent_id (if missing)
    Maps from call_type where available.
    Validates agent_id — flags missing as audit_incomplete.
    Supports 'withdrawn' value for GDPR/do-not-contact call types.
    """
    log("  Enriching customer_support ...")
    n = len(df)

    # ── marketing_email_consent ──────────────────────────────────────────────
    if 'marketing_email_consent' not in df.columns:
        df['marketing_email_consent'] = None

    if 'call_type' in df.columns:
        call_lower = df['call_type'].str.lower().fillna('')
        df['marketing_email_consent'] = np.where(
            call_lower.isin([c.lower() for c in SUPPORT_WITHDRAWN_CALLS]),
            'withdrawn',
            np.where(
                call_lower.isin([c.lower() for c in SUPPORT_EMAIL_OPTOUT_CALLS]),
                'opt_out',
                np.where(
                    call_lower.isin([c.lower() for c in SUPPORT_EMAIL_OPTIN_CALLS]),
                    'opt_in',
                    df['marketing_email_consent']   # null for unrelated call types
                )
            )
        )
    else:
        log("  ⚠  call_type column not found — generating synthetic marketing_email_consent")
        df['marketing_email_consent'] = null_safe_choice(
            ['opt_out'] * 55 + ['withdrawn'] * 15 + ['opt_in'] * 10 + [None] * 20, n
        )

    # ── global_consent ────────────────────────────────────────────────────────
    if 'global_consent' not in df.columns:
        df['global_consent'] = None

    if 'call_type' in df.columns:
        call_lower = df['call_type'].str.lower().fillna('')
        df['global_consent'] = np.where(
            call_lower.isin([c.lower() for c in SUPPORT_WITHDRAWN_CALLS]),
            'withdrawn',
            np.where(
                call_lower.isin([c.lower() for c in SUPPORT_GLOBAL_OPTOUT_CALLS]),
                'opt_out',
                df['global_consent']    # null — most calls don't touch global consent
            )
        )

    # ── consent_timestamp ────────────────────────────────────────────────────
    if 'consent_timestamp' not in df.columns:
        ts_col = next(
            (c for c in ['call_timestamp', 'event_timestamp', 'timestamp', 'date'] if c in df.columns),
            None
        )
        if ts_col:
            df['consent_timestamp'] = pd.to_datetime(df[ts_col]).dt.strftime('%Y-%m-%dT%H:%M:%S')
        else:
            df['consent_timestamp'] = pd.Timestamp('2024-01-01T00:00:00')

    # ── agent_id ──────────────────────────────────────────────────────────────
    if 'agent_id' not in df.columns:
        df['agent_id'] = [random.choice(AGENT_IDS) for _ in range(n)]

    df = validate_agent_ids(df)

    df['consent_source'] = 'call_center'

    log(f"  ✓  {n} rows enriched | "
        f"email opt_out: {(df['marketing_email_consent']=='opt_out').sum()} | "
        f"withdrawn: {(df['marketing_email_consent']=='withdrawn').sum()} | "
        f"global opt_out: {(df['global_consent']=='opt_out').sum()}")
    return df


def enrich_app_events(df):
    """
    Adds: tracking_cookie_consent, consent_timestamp, consent_source
    Same null pattern as streaming_activity but via iOS ATT / Android SDK prompt.
    ~20% of rows had a tracking prompt interaction.
    consent_source = 'mobile_app' (distinct from 'website_banner').
    """
    log("  Enriching app_events ...")
    n = len(df)

    att_mask = np.random.rand(n) < APP_ATT_RATE

    if 'tracking_cookie_consent' not in df.columns:
        df['tracking_cookie_consent'] = None
        df.loc[att_mask, 'tracking_cookie_consent'] = [
            random.choice(APP_ATT_CHOICE)
            for _ in range(att_mask.sum())
        ]

    if 'consent_timestamp' not in df.columns:
        df['consent_timestamp'] = None
        ts_col = next(
            (c for c in ['event_timestamp', 'activity_timestamp', 'timestamp'] if c in df.columns),
            None
        )
        if ts_col:
            att_ts = (
                pd.to_datetime(df.loc[att_mask, ts_col]) -
                pd.to_timedelta(np.random.randint(2, 15, size=att_mask.sum()), unit='s')
            ).dt.strftime('%Y-%m-%dT%H:%M:%S')
            df.loc[att_mask, 'consent_timestamp'] = att_ts.values

    df['consent_source'] = None
    df.loc[att_mask, 'consent_source'] = 'mobile_app'

    log(f"  ✓  {n} rows enriched | "
        f"ATT prompt interactions: {att_mask.sum()} ({att_mask.mean()*100:.1f}%) | "
        f"passive (null): {(~att_mask).sum()}")
    return df


# ── File routing ──────────────────────────────────────────────────────────────

FILE_CONFIG = {
    "subscription_billing.csv": enrich_subscription_billing,
    "email_engagement.csv":     enrich_email_engagement,
    "streaming_activity.csv":   enrich_streaming_activity,
    "customer_support.csv":     enrich_customer_support,
    "app_events.csv":           enrich_app_events,
}


# ── Main ──────────────────────────────────────────────────────────────────────

INPUT_FILE_ALIASES = {
    "subscription_billing.csv": [
        "subscription_billing.csv",
        "med_subscription_billing.csv",
        os.path.join("media", "med_subscription_billing.csv"),
    ],
    "email_engagement.csv": [
        "email_engagement.csv",
        "med_email_engagement.csv",
        os.path.join("media", "med_email_engagement.csv"),
    ],
    "streaming_activity.csv": [
        "streaming_activity.csv",
        "med_streaming_activity.csv",
        os.path.join("media", "med_streaming_activity.csv"),
    ],
    "customer_support.csv": [
        "customer_support.csv",
        "med_customer_support.csv",
        os.path.join("media", "med_customer_support.csv"),
    ],
    "app_events.csv": [
        "app_events.csv",
        "med_app_events.csv",
        os.path.join("media", "med_app_events.csv"),
    ],
}


def resolve_input_path(input_dir, filename):
    for candidate in INPUT_FILE_ALIASES.get(filename, [filename]):
        path = os.path.join(input_dir, candidate)
        if os.path.exists(path):
            return path
    return None


def write_output_csv(df, output_path):
    try:
        df.to_csv(output_path, index=False)
        return output_path
    except PermissionError:
        pending_path = f"{output_path}.pending.csv"
        df.to_csv(pending_path, index=False)
        if os.path.exists(output_path):
            log(
                f"  WARNING: {output_path} is locked. "
                f"Wrote refreshed output to {pending_path} and kept existing canonical file."
            )
            return output_path
        raise


def main(input_dir, output_dir):
    abort_if_uc_runtime("consent_enrich.py")

    os.makedirs(output_dir, exist_ok=True)
    summary = []

    for filename, enrich_fn in FILE_CONFIG.items():
        input_path  = resolve_input_path(input_dir, filename)
        output_path = os.path.join(output_dir, filename)

        if not input_path:
            aliases = ", ".join(INPUT_FILE_ALIASES.get(filename, [filename]))
            log(f"  SKIP: {filename} not found in {input_dir} using aliases: {aliases}")
            continue

        log(f"\n{'─'*60}")
        log(f"Processing: {filename} from {os.path.relpath(input_path, input_dir)}")

        df = pd.read_csv(input_path, low_memory=False)
        log(f"  Loaded {len(df)} rows, {len(df.columns)} columns")

        df = enrich_fn(df)

        written_path = write_output_csv(df, output_path)
        log(f"  Saved → {written_path}")

        summary.append({
            "file":         filename,
            "rows":         len(df),
            "columns_out":  len(df.columns),
        })

    # ── Summary report ─────────────────────────────────────────────────────
    log(f"\n{'═'*60}")
    log("ENRICHMENT COMPLETE")
    log(f"{'═'*60}")
    log(f"{'File':<35} {'Rows':>8} {'Cols':>6}")
    log(f"{'─'*35} {'─'*8} {'─'*6}")
    for s in summary:
        log(f"{s['file']:<35} {s['rows']:>8,} {s['columns_out']:>6}")
    log(f"{'═'*60}")
    log(f"Output directory: {os.path.abspath(output_dir)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich CDP source files with consent columns")
    parser.add_argument("--input_dir",  default=str(Path(__file__).resolve().parent.parent.parent / "generated_data"),          help="Directory containing raw source CSVs")
    parser.add_argument("--output_dir", default=str(Path(__file__).resolve().parent.parent.parent / "generated_data" / "enriched"), help="Directory for enriched output CSVs")
    args = parser.parse_args()
    main(args.input_dir, args.output_dir)
