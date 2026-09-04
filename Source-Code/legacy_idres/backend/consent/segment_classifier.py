"""
segment_classifier.py
StreamPass CDP — Real Segment Classification

Replaces the random _classify_record() function with actual
behavioural data from source files.

Builds a lookup: golden_id → set of segment IDs

Usage in app.py:
    from consent.segment_classifier import get_segment_lookup, classify_golden_id
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import os
from pathlib import Path
from collections import defaultdict

# Dynamic path — resolves relative to this file's location
# segment_classifier.py lives in: backend/consent/
# golden_records.csv lives in: legacy_idres/
ROOT = str(Path(__file__).resolve().parent.parent.parent)
MEDIA_SOURCE = "media"
GEN_DIR = os.path.join(ROOT, "generated_data", MEDIA_SOURCE)
GOLDEN_CSV = os.path.join(
    ROOT,
    "golden_records_output",
    MEDIA_SOURCE,
    "golden_records.csv",
)

_segment_lookup = {}   # golden_id → set of segment IDs
_lookup_built   = False


def log(msg):
    print(f"[segment_classifier] {msg}")


def _build_lookup():
    global _segment_lookup, _lookup_built

    log("Building real segment lookup from source files ...")
    lookup = defaultdict(set)

    # ── Load golden records — email → golden_id index ─────────────────────────
    gr = pd.read_csv(GOLDEN_CSV, low_memory=False)
    email_to_gid = {}
    for _, row in gr.iterrows():
        gid   = str(row.get("golden_id", "")).strip()
        email = str(row.get("email", "")).strip().lower()
        tier  = str(row.get("subscription_tier", "")).strip()
        if email:
            email_to_gid[email] = gid
        # Subscription tier from golden record
        if tier == "Free":
            lookup[gid].add("free_to_paid")
        elif tier in ("Basic", "Premium", "VIP"):
            lookup[gid].add("active_subs")

    log(f"  Golden records indexed: {len(email_to_gid):,} emails")

    # ── Subscription Billing — account_status ─────────────────────────────────
    billing_path = os.path.join(GEN_DIR, "med_subscription_billing.csv")
    if os.path.exists(billing_path):
        billing = pd.read_csv(billing_path, low_memory=False)
        for _, row in billing.iterrows():
            email  = str(row.get("billing_email", "")).strip().lower()
            status = str(row.get("account_status", "")).strip()
            tier   = str(row.get("subscription_tier", "")).strip()
            gid    = email_to_gid.get(email)
            if not gid:
                continue
            if status == "Active":
                lookup[gid].add("active_subs")
                if tier == "VIP":
                    lookup[gid].add("vip_fans")
                    lookup[gid].add("suite_holders")
                elif tier == "Premium":
                    lookup[gid].add("heavy_consumers")
            elif status == "Cancelled":
                lookup[gid].add("churned_subs")
                lookup[gid].add("winback_lapsed")
            elif status == "Suspended":
                lookup[gid].add("at_risk_subs")
                lookup[gid].add("churn_risk_tel")
        log(f"  Billing processed: {len(billing):,} rows")

    # ── Email Engagement ──────────────────────────────────────────────────────
    email_path = os.path.join(GEN_DIR, "med_email_engagement.csv")
    if os.path.exists(email_path):
        email_df = pd.read_csv(email_path, low_memory=False)
        for _, row in email_df.iterrows():
            email      = str(row.get("recipient_email", "")).strip().lower()
            opened     = str(row.get("opened", "False")).strip().lower() in ("true", "1", "yes")
            clicked    = str(row.get("clicked", "False")).strip().lower() in ("true", "1", "yes")
            unsubbed   = str(row.get("unsubscribed", "False")).strip().lower() in ("true", "1", "yes")
            tier       = str(row.get("subscription_tier", "")).strip()
            gid        = email_to_gid.get(email)
            if not gid:
                continue
            if unsubbed:
                lookup[gid].add("email_nonbuyer")   # unsubscribed — not receiving email
            elif opened and clicked:
                lookup[gid].add("heavy_consumers")
                lookup[gid].add("active_subs")
            elif opened and not clicked:
                lookup[gid].add("at_risk_subs")
            if tier == "Free":
                lookup[gid].add("free_to_paid")
        log(f"  Email engagement processed: {len(email_df):,} rows")

    # ── Streaming Activity ────────────────────────────────────────────────────
    streaming_path = os.path.join(GEN_DIR, "med_streaming_activity.csv")
    if os.path.exists(streaming_path):
        stream_df = pd.read_csv(streaming_path, low_memory=False)

        # Aggregate per user
        stream_df["user_email"] = stream_df["user_email"].str.strip().str.lower()
        stream_df["session_duration_min"] = pd.to_numeric(
            stream_df["session_duration_min"], errors="coerce"
        ).fillna(0)

        user_stats = stream_df.groupby("user_email").agg(
            total_sessions=("session_id", "count"),
            total_minutes=("session_duration_min", "sum"),
            live_sessions=("is_live", lambda x: (x == True).sum()),
        ).reset_index()

        avg_minutes = user_stats["total_minutes"].median()
        avg_sessions = user_stats["total_sessions"].median()

        for _, row in user_stats.iterrows():
            email = str(row["user_email"]).strip().lower()
            gid   = email_to_gid.get(email)
            if not gid:
                continue
            mins     = row["total_minutes"]
            sessions = row["total_sessions"]
            live     = row["live_sessions"]

            if mins > avg_minutes * 2:
                lookup[gid].add("heavy_consumers")
            elif mins > avg_minutes:
                lookup[gid].add("active_subs")
            else:
                lookup[gid].add("at_risk_subs")

            if live > 0:
                lookup[gid].add("sth_active")   # watches live = engaged fan

        log(f"  Streaming processed: {len(stream_df):,} rows | {len(user_stats):,} unique users")

    # ── Customer Support ──────────────────────────────────────────────────────
    support_path = os.path.join(GEN_DIR, "med_customer_support.csv")
    if os.path.exists(support_path):
        support_df = pd.read_csv(support_path, low_memory=False)
        for _, row in support_df.iterrows():
            email    = str(row.get("customer_email", "")).strip().lower()
            category = str(row.get("category", "")).strip().lower()
            gid      = email_to_gid.get(email)
            if not gid:
                continue
            if "cancellation" in category:
                lookup[gid].add("churned_subs")
            elif "billing" in category:
                lookup[gid].add("active_subs")
            elif "complaint" in category:
                lookup[gid].add("at_risk_subs")
        log(f"  Support processed: {len(support_df):,} rows")

    # ── App Events ────────────────────────────────────────────────────────────
    app_path = os.path.join(GEN_DIR, "med_app_events.csv")
    if os.path.exists(app_path):
        app_df = pd.read_csv(app_path, low_memory=False)
        app_users = set(app_df["app_user_email"].str.strip().str.lower().dropna().unique())
        for email in app_users:
            gid = email_to_gid.get(email)
            if gid:
                lookup[gid].add("new_joiners")   # has app = newer/engaged user
        log(f"  App events processed: {len(app_df):,} rows | {len(app_users):,} unique users")

    _segment_lookup = dict(lookup)
    _lookup_built   = True
    log(f"Segment lookup built: {len(_segment_lookup):,} golden IDs classified")

    # Print counts per segment
    counts = defaultdict(int)
    for segs in _segment_lookup.values():
        for s in segs:
            counts[s] += 1
    log("Segment counts from real data:")
    for seg, count in sorted(counts.items(), key=lambda x: -x[1]):
        log(f"  {seg:<30} {count:>6,}")

    return _segment_lookup


def get_segment_lookup():
    if not _lookup_built:
        _build_lookup()
    return _segment_lookup


def classify_golden_id(golden_id):
    """Returns set of segment IDs for a given golden_id."""
    lookup = get_segment_lookup()
    return lookup.get(str(golden_id).strip(), set())


if __name__ == "__main__":
    _build_lookup()
