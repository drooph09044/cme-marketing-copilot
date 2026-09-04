"""
consent_segment_filter.py
StreamPass CDP — Consent Segment Filter

Patches the /api/segments/dynamic endpoint behaviour so that
suppressed / opted-out users are HARD EXCLUDED from segment
member lists — not just flagged.

Add this to app.py:
    from consent.consent_segment_filter import filter_segment_by_consent
    
Then wrap the dynamic_segment response:
    rows = filter_segment_by_consent(rows, channel="email")

Or use the standalone function anywhere a member list is produced.
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import os
from pathlib import Path
import math

CONSENT_RESOLVED_PATH = str(Path(__file__).resolve().parent.parent.parent / "consent_data" / "enriched" / "consent_resolved.csv")

# Cache — reloaded on every call so it always reflects latest consent
_consent_cache = {}
_cache_mtime   = 0


def _load_consent_fresh():
    """
    Always reload from disk if the file has changed since last load.
    This ensures every layer uses the latest consent timestamp.
    """
    global _consent_cache, _cache_mtime

    if not os.path.exists(CONSENT_RESOLVED_PATH):
        return {}

    mtime = os.path.getmtime(CONSENT_RESOLVED_PATH)
    if mtime == _cache_mtime and _consent_cache:
        return _consent_cache   # file unchanged — use cache

    df = pd.read_csv(CONSENT_RESOLVED_PATH, low_memory=False)

    # Normalise NaN → None
    data = {}
    for _, row in df.iterrows():
        moscid = row.get("moscid")
        if not moscid or pd.isna(moscid):
            continue
        record = {}
        for k, v in row.items():
            if isinstance(v, float) and math.isnan(v):
                record[k] = None
            else:
                record[k] = v
        data[str(moscid)] = record

    _consent_cache = data
    _cache_mtime   = mtime
    print(f"[consent_filter] Consent reloaded — {len(data):,} MOSCIDs "
          f"(mtime: {mtime})")
    return _consent_cache


def _evaluate_gate(record, channel="email"):
    """
    Returns ("SEND"|"BLOCK"|"BYPASS", rule_that_fired).
    Mirrors consent_gate.py logic exactly.
    Always uses the most recent consent state from the resolved record.
    """
    if not record:
        return "SEND", "no_consent_record"   # null rule — opted in by default

    if channel == "transactional":
        return "BYPASS", "transactional_bypass"
    if channel == "social":
        return "BYPASS", "social_bypass"

    # Rule 1 — Global suppress
    gc = record.get("global_consent")
    if gc and str(gc).lower() in ("opt_out", "withdrawn"):
        return "BLOCK", "global_consent"

    # Rule 2 — Comms optout
    co = record.get("marketing_comms_optout")
    if co and str(co).lower() == "opt_out":
        return "BLOCK", "marketing_comms_optout"

    # Rule 3 — Channel-specific
    if channel == "email":
        ec = record.get("marketing_email_consent")
        if ec and str(ec).lower() in ("opt_out", "withdrawn"):
            return "BLOCK", "marketing_email_consent"

    return "SEND", "null_passthrough"


def filter_segment_by_consent(rows, channel="email"):
    """
    Hard-exclude non-consented users from a segment member list.

    Args:
        rows    : list of dicts, each must have a 'golden_id' key
        channel : "email" | "transactional" | "social"

    Returns:
        dict with keys:
            eligible    : list of rows that passed the gate
            suppressed  : list of rows that were blocked
            total       : original count
            send        : eligible count
            block       : suppressed count
            channel     : channel evaluated
            consent_last_refreshed : ISO timestamp of consent data
    """
    consent = _load_consent_fresh()

    eligible   = []
    suppressed = []

    for row in rows:
        moscid = str(row.get("golden_id") or row.get("moscid") or "")
        record = consent.get(moscid, {})
        result, rule = _evaluate_gate(record, channel)

        if result in ("SEND", "BYPASS"):
            eligible.append({k: v for k, v in row.items() if not k.startswith("_")})
        else:
            suppressed.append({k: v for k, v in row.items() if not k.startswith("_")})

    import datetime
    refreshed = datetime.datetime.now(datetime.timezone.utc).isoformat()

    return {
        "eligible":              eligible,
        "suppressed":            suppressed,
        "total":                 len(rows),
        "send":                  len(eligible),
        "block":                 len(suppressed),
        "channel":               channel,
        "consent_last_refreshed": refreshed,
    }


def get_consent_for_moscid(moscid):
    """
    Return the current resolved consent record for a single MOSCID.
    Always reads the latest from disk.
    """
    consent = _load_consent_fresh()
    return consent.get(str(moscid))


def is_eligible(moscid, channel="email"):
    """
    Quick boolean check — is this MOSCID eligible for activation?
    """
    record = get_consent_for_moscid(moscid)
    result, _ = _evaluate_gate(record, channel)
    return result in ("SEND", "BYPASS")
