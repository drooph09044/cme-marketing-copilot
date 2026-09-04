"""
consent_api.py
StreamPass CDP — Step 7: Consent API + Suppression Export

Flask endpoints that expose consent state for:
  1. Customer Profile UI  — GET /api/consent/<moscid>
  2. Segment gate check   — POST /api/consent/gate
  3. Suppression export   — GET /api/consent/suppression/<channel>
  4. Audit trail          — GET /api/consent/audit/<moscid>
  5. Health check         — GET /api/consent/health

Register in app.py:
    from consent.consent_api import consent_bp
    app.register_blueprint(consent_bp)

Usage standalone (for testing):
    python consent_api.py
    → runs on http://localhost:5002
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import numpy as np
import os
import csv
from pathlib import Path
import json
from datetime import datetime, timezone
from flask import Flask, Blueprint, jsonify, request, Response

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent.parent
GENERATED_BASE = ROOT / "generated_data" / "enriched"
LEGACY_BASE = ROOT / "consent_data" / "enriched"
if os.getenv("CODEX_DATA_SOURCE", "local").strip().lower() == "uc":
    # These paths are logical UC/Volume locations in Databricks mode.  Calling
    # Path.exists() here runs during module import and can start a SQL statement
    # before the warehouse is ready, blocking the entire web application.
    BASE = str(GENERATED_BASE)
else:
    BASE = str(GENERATED_BASE if GENERATED_BASE.exists() else LEGACY_BASE)

GOLDEN_RECORD_PATH = os.path.join(BASE, "consent_golden_record.csv")
LEDGER_PATH        = os.path.join(BASE, "consent_event_ledger.csv")

# ── In-memory cache (reload on each request for demo; add TTL cache for prod) ─
_consent_cache = {}
_ledger_cache  = {}


# Sentinel file written by consent_refresh.py when data changes
SENTINEL_PATH = os.path.join(BASE, ".consent_last_refresh")
_cache_mtime  = 0   # tracks last file modification time


def _first_row(path, predicate):
    path = Path(path)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if predicate(row):
                return row
    return None


def _normalize_consent_status(value):
    value = str(value or "").strip().lower().replace(" ", "_")
    if value in {"opted_in", "opt_in", "true", "yes", "active"}:
        return "opt_in"
    if value in {"opted_out", "opt_out", "false", "no", "withdrawn"}:
        return "opt_out"
    return None


def _automotive_consent_rows(moscid):
    source = request.args.get("source", "").strip().lower()
    if source != "automotive" and not str(moscid).upper().startswith("AUT-GR-"):
        return None, []

    golden_path = ROOT / "golden_records_output" / "automotive" / "golden_records.csv"
    golden = _first_row(golden_path, lambda row: row.get("golden_id", "").upper() == str(moscid).upper())
    if not golden:
        return None, []

    customer_id = golden.get("customer_id", "")
    if not customer_id:
        return None, []

    consent_paths = [
        ROOT / "standardized_data" / "automotive" / "standardized_aut_customer_consents.csv",
        ROOT / "preprocessed_data" / "automotive" / "preprocessed_aut_customer_consents.csv",
        ROOT / "gm_cdp_csv" / "customer_consents.csv",
    ]

    consent_rows = []
    for path in consent_paths:
        if not path.exists():
            continue
        with open(path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("customer_id") == customer_id:
                    consent_rows.append(row)
        if consent_rows:
            break

    return golden, consent_rows


def _automotive_demo_consent(moscid):
    golden, consent_rows = _automotive_consent_rows(moscid)
    if not consent_rows:
        return None

    def status_for(*types):
        for row in consent_rows:
            consent_type = str(row.get("consent_type", "")).strip().lower()
            if any(t in consent_type for t in types):
                return _normalize_consent_status(row.get("status") or row.get("consent_status"))
        return None

    marketing = status_for("marketing")
    data_sharing = status_for("data", "sharing")
    telematics = status_for("telematics")
    personalization = status_for("personalization")

    latest = ""
    for row in consent_rows:
        latest = max(latest, row.get("updated_at") or row.get("effective_at") or row.get("created_at") or "")

    sources = sorted({row.get("consent_source", "") for row in consent_rows if row.get("consent_source", "")})
    global_consent = "opt_out" if "opt_out" in [marketing, data_sharing, telematics, personalization] else "opt_in"

    return {
        "data_processing_consent": data_sharing or "opt_in",
        "global_consent": global_consent,
        "marketing_comms_optout": "opt_out" if marketing == "opt_out" else None,
        "marketing_email_consent": marketing or "opt_in",
        "tracking_cookie_consent": personalization or telematics or "opt_in",
        "marketing_suppressed": marketing == "opt_out" or global_consent == "opt_out",
        "suppression_reason": "automotive_customer_consent" if marketing == "opt_out" or global_consent == "opt_out" else None,
        "withdrawn_review_flag": False,
        "consent_last_updated": latest,
        "sources_seen": ",".join(sources),
        "golden_record_updated_at": latest,
        "household_suppressed": False,
        "household_suppressor_id": None,
        "household_id": golden.get("household_id", ""),
    }


def _automotive_demo_audit(moscid):
    golden, consent_rows = _automotive_consent_rows(moscid)
    if not consent_rows:
        return None

    events = []
    for row in consent_rows:
        consent_type = str(row.get("consent_type", "")).strip()
        status = _normalize_consent_status(row.get("status") or row.get("consent_status"))
        if not consent_type or not status:
            continue
        events.append({
            "moscid": moscid,
            "raw_identifier": golden.get("customer_id", ""),
            "identifier_type": "customer_id",
            "consent_field": consent_type.lower().replace(" ", "_") + "_consent",
            "consent_value": status,
            "communication_type": "marketing" if consent_type.lower() == "marketing" else None,
            "consent_timestamp": row.get("effective_at") or row.get("updated_at") or row.get("created_at"),
            "consent_version": row.get("consent_version") or "",
            "consent_source": row.get("consent_source") or row.get("source_file") or "Automotive",
            "agent_id": row.get("agent_id") or "",
            "source_file": row.get("source_file") or "aut_customer_consents.csv",
            "value_valid": True,
        })

    events_sorted = sorted(
        events,
        key=lambda e: str(e.get("consent_timestamp") or ""),
        reverse=True,
    )
    return {
        "moscid": moscid,
        "event_count": len(events_sorted),
        "events": events_sorted,
        "source": "automotive_customer_consents",
    }


def _normalize_source_system(value):
    """Normalize a source system query value.

    :param value: Raw source system string from the request.
    :type value: str
    :returns: Normalized source key when supported.
    :rtype: str
    """
    source = str(value or "").strip().lower()
    return source if source in {"media", "sports", "automotive", "telecom"} else ""


def _source_from_moscid(moscid):
    """Infer cluster source system from a golden record id prefix.

    :param moscid: Golden record identifier.
    :type moscid: str
    :returns: Source system key or empty string.
    :rtype: str
    """
    upper = str(moscid or "").upper()
    if upper.startswith("MED-GR-"):
        return "media"
    if upper.startswith("SPO-GR-") or upper.startswith("SPT-GR-"):
        return "sports"
    if upper.startswith("AUT-GR-"):
        return "automotive"
    if upper.startswith("TEL-GR-"):
        return "telecom"
    return ""


def _source_golden_row(source, moscid):
    """Load a golden record row for a source system and golden id.

    :param source: Cluster source system.
    :type source: str
    :param moscid: Golden record identifier.
    :type moscid: str
    :returns: Matching golden record row, if any.
    :rtype: dict | None
    """
    source = _normalize_source_system(source)
    if not source:
        return None
    golden_path = ROOT / "golden_records_output" / source / "golden_records.csv"
    return _first_row(golden_path, lambda row: row.get("golden_id", "").upper() == str(moscid).upper())


def _email_match_keys(*values):
    """Build normalized email lookup keys for profile matching.

    :param values: Email strings that may contain pipe-delimited values.
    :type values: str
    :returns: Set of comparable email keys.
    :rtype: set[str]
    """
    keys = set()
    for value in values:
        for part in str(value or "").split("|"):
            email = part.strip().lower()
            if not email or "@" not in email:
                continue
            local, domain = email.split("@", 1)
            keys.add(email)
            keys.add(f"{local.split('+', 1)[0]}@{domain}")
    return keys


def _row_matches_profile(row, email_keys, phone_values):
    """Return whether a source row matches a golden record email or phone.

    :param row: Candidate source row.
    :type row: dict
    :param email_keys: Normalized email keys for the profile.
    :type email_keys: set[str]
    :param phone_values: Normalized phone digit strings for the profile.
    :type phone_values: set[str]
    :returns: ``True`` when the row matches the profile identifiers.
    :rtype: bool
    """
    row_email = str(row.get("email", "") or "").strip().lower()
    if row_email:
        local, domain = row_email.split("@", 1) if "@" in row_email else (row_email, "")
        row_keys = {row_email}
        if domain:
            row_keys.add(f"{local.split('+', 1)[0]}@{domain}")
        if row_keys & email_keys:
            return True

    row_phone = "".join(ch for ch in str(row.get("phone", "") or "") if ch.isdigit())
    return bool(row_phone and row_phone in phone_values)


def _collect_source_rows(source, golden):
    """Collect standardized source rows linked to a golden record profile.

    :param source: Cluster source system.
    :type source: str
    :param golden: Golden record row used for email/phone matching.
    :type golden: dict
    :returns: Matching standardized source rows.
    :rtype: list[dict]
    """
    email_keys = _email_match_keys(golden.get("email"), golden.get("all_emails"))
    phone_values = {
        "".join(ch for ch in str(value or "") if ch.isdigit())
        for value in [golden.get("phone"), *str(golden.get("all_phones", "") or "").split("|")]
    }
    phone_values.discard("")

    source_files = {
        "media": [
            ROOT / "standardized_data" / "media" / "standardized_med_email_engagement.csv",
            ROOT / "standardized_data" / "media" / "standardized_med_subscription_billing.csv",
            ROOT / "standardized_data" / "media" / "standardized_med_app_events.csv",
            ROOT / "standardized_data" / "media" / "standardized_med_customer_support.csv",
        ],
        "sports": [
            ROOT / "standardized_data" / "sports" / "standardized_spt_fan_accounts.csv",
            ROOT / "standardized_data" / "sports" / "standardized_spt_loyalty_members.csv",
            ROOT / "standardized_data" / "sports" / "standardized_spt_app_events.csv",
        ],
    }.get(source, [])

    rows = []
    for path in source_files:
        if not path.exists():
            continue
        with open(path, "r", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                if _row_matches_profile(row, email_keys, phone_values):
                    rows.append(row)
    return rows


def _bool_status(value):
    """Map common boolean or consent strings to opt-in/out values.

    :param value: Raw field value.
    :type value: str
    :returns: ``opt_in``, ``opt_out``, or ``None``.
    :rtype: str | None
    """
    text = str(value or "").strip().lower()
    if text in {"true", "yes", "y", "1", "opt_in", "opted_in", "active"}:
        return "opt_in"
    if text in {"false", "no", "n", "0", "opt_out", "opted_out", "withdrawn", "inactive"}:
        return "opt_out"
    return None


def _status_from_rows(rows, *fields, default=None):
    """Derive a single consent status from one or more row fields.

    :param rows: Source rows to inspect.
    :type rows: list[dict]
    :param fields: Field names to evaluate in priority order.
    :type fields: str
    :param default: Default status when no field resolves.
    :type default: str | None
    :returns: Resolved consent status.
    :rtype: str | None
    """
    statuses = []
    for row in rows:
        for field in fields:
            status = _bool_status(row.get(field))
            if status:
                statuses.append(status)
    if "opt_in" in statuses:
        return "opt_in"
    if "opt_out" in statuses:
        return "opt_out"
    return default


def _source_profile_consent(moscid):
    """Build a consent block from linked media or sports source rows.

    Used when the MOSCID is absent from ``consent_golden_record.csv``.

    :param moscid: Golden record identifier.
    :type moscid: str
    :returns: Consent block dict or ``None``.
    :rtype: dict | None
    """
    requested_source = _normalize_source_system(request.args.get("source", ""))
    source = requested_source or _source_from_moscid(moscid)
    if source not in {"media", "sports"}:
        return None

    golden = _source_golden_row(source, moscid)
    if not golden:
        return None

    rows = _collect_source_rows(source, golden)
    latest = max(
        [
            row.get("updated_date")
            or row.get("open_date")
            or row.get("send_date")
            or row.get("created_date")
            or row.get("billing_date")
            or row.get("last_login_at")
            or row.get("last_activity_date")
            or ""
            for row in rows
        ]
        or [""]
    )
    sources = sorted({row.get("source_file", "") for row in rows if row.get("source_file", "")})

    if source == "sports":
        marketing = _status_from_rows(rows, "is_opt_in_email", default="opt_in")
        sms = _status_from_rows(rows, "is_opt_in_sms")
        push = _status_from_rows(rows, "is_opt_in_push")
        tracking = push or "opt_in"
        source_name = "sports_source_consent"
    else:
        unsubscribed = any(str(row.get("unsubscribed", "")).strip().lower() == "true" for row in rows)
        marketing = "opt_out" if unsubscribed else "opt_in"
        sms = None
        tracking = "opt_in"
        source_name = "media_source_consent"

    global_consent = "opt_out" if marketing == "opt_out" else "opt_in"
    suppressed = marketing == "opt_out" or global_consent == "opt_out"

    return {
        "data_processing_consent": "opt_in",
        "global_consent": global_consent,
        "marketing_comms_optout": "opt_out" if suppressed else None,
        "marketing_email_consent": marketing,
        "tracking_cookie_consent": tracking,
        "marketing_sms_consent": sms,
        "marketing_suppressed": suppressed,
        "suppression_reason": source_name if suppressed else None,
        "withdrawn_review_flag": False,
        "consent_last_updated": latest,
        "sources_seen": ",".join(sources) or golden.get("source_files", ""),
        "golden_record_updated_at": latest,
        "household_suppressed": False,
        "household_suppressor_id": None,
        "household_id": golden.get("household_id", ""),
    }


def _source_profile_audit(moscid):
    """Build a synthetic consent audit trail from source-profile consent.

    :param moscid: Golden record identifier.
    :type moscid: str
    :returns: Audit payload dict or ``None``.
    :rtype: dict | None
    """
    requested_source = _normalize_source_system(request.args.get("source", ""))
    source = requested_source or _source_from_moscid(moscid)
    if source not in {"media", "sports"}:
        return None

    consent = _source_profile_consent(moscid)
    if not consent:
        return None

    events = []
    for field in ["data_processing_consent", "global_consent", "marketing_email_consent", "tracking_cookie_consent"]:
        value = consent.get(field)
        if not value:
            continue
        events.append({
            "moscid": moscid,
            "raw_identifier": moscid,
            "identifier_type": "golden_id",
            "consent_field": field,
            "consent_value": value,
            "communication_type": "marketing" if field == "marketing_email_consent" else "transactional",
            "consent_timestamp": consent.get("consent_last_updated"),
            "consent_version": "source-profile",
            "consent_source": consent.get("sources_seen") or source,
            "agent_id": "",
            "source_file": consent.get("sources_seen") or f"{source}_golden_records.csv",
            "value_valid": True,
        })

    return {
        "moscid": moscid,
        "event_count": len(events),
        "events": events,
        "source": f"{source}_source_profile_consent",
    }


def load_consent_data():
    """
    Load golden record into memory dict keyed by moscid.
    Reloads from disk whenever consent_golden_record.csv changes —
    ensures every layer always uses the latest consent timestamp.
    """
    global _consent_cache, _cache_mtime
    if not os.path.exists(GOLDEN_RECORD_PATH):
        return {}

    # Check if file has changed since last load
    current_mtime = os.path.getmtime(GOLDEN_RECORD_PATH)
    if current_mtime == _cache_mtime and _consent_cache:
        return _consent_cache   # unchanged — serve from cache

    import math
    df = pd.read_csv(GOLDEN_RECORD_PATH, low_memory=False)
    data = df.set_index("moscid").to_dict(orient="index")
    for mid, rec in data.items():
        for k, v in rec.items():
            if isinstance(v, float) and math.isnan(v):
                rec[k] = None

    _consent_cache = data
    _cache_mtime   = current_mtime
    print(f"[consent_api] Consent reloaded — {len(data):,} MOSCIDs")
    return _consent_cache


_ledger_mtime = 0

def load_ledger_data():
    """Load audit ledger — reloads from disk when file changes."""
    global _ledger_cache, _ledger_mtime
    if not os.path.exists(LEDGER_PATH):
        return {}
    current_mtime = os.path.getmtime(LEDGER_PATH)
    if current_mtime == _ledger_mtime and _ledger_cache:
        return _ledger_cache
    df = pd.read_csv(LEDGER_PATH, low_memory=False)
    df = df.where(pd.notna(df), None)
    _ledger_cache = df.groupby("moscid").apply(
        lambda g: g.to_dict(orient="records"), include_groups=False
    ).to_dict()
    _ledger_mtime = current_mtime
    return _ledger_cache


def run_gate_logic(record, channel):
    """Single-record gate evaluation — mirrors consent_gate.py logic."""
    if channel == "transactional":
        return {"result": "BYPASS", "rule": "transactional_bypass"}
    if channel == "social":
        return {"result": "BYPASS", "rule": "social_bypass"}

    gc = record.get("global_consent")
    if gc and str(gc).lower() in ("opt_out", "withdrawn"):
        return {"result": "BLOCK", "rule": "global_consent"}

    co = record.get("marketing_comms_optout")
    if co and str(co).lower() == "opt_out":
        return {"result": "BLOCK", "rule": "marketing_comms_optout"}

    if channel == "email":
        ec = record.get("marketing_email_consent")
        if ec and str(ec).lower() in ("opt_out", "withdrawn"):
            return {"result": "BLOCK", "rule": "marketing_email_consent"}

    return {"result": "SEND", "rule": "null_passthrough"}


# ── Blueprint ─────────────────────────────────────────────────────────────────
consent_bp = Blueprint("consent", __name__, url_prefix="/api/consent")


@consent_bp.route("/health", methods=["GET"])
def health():
    """Health check — confirms consent data is loaded."""
    consent_data = load_consent_data()
    return jsonify({
        "status":           "ok",
        "moscids_loaded":   len(consent_data),
        "golden_record":    os.path.exists(GOLDEN_RECORD_PATH),
        "ledger":           os.path.exists(LEDGER_PATH),
        "checked_at":       datetime.now(timezone.utc).isoformat(),
    })


@consent_bp.route("/<moscid>", methods=["GET"])
def get_consent(moscid):
    """
    GET /api/consent/<moscid>
    Returns full consent block for a MOSCID.
    Used by Customer Profile page.

    Response:
    {
        "moscid": "MOSC-001234",
        "consent": {
            "data_processing_consent": "opt_in",
            "global_consent": "opt_in",
            "marketing_comms_optout": null,
            "marketing_email_consent": "opt_out",
            "tracking_cookie_consent": "opt_in",
            "marketing_suppressed": false,
            "suppression_reason": null,
            "consent_last_updated": "2024-06-22T14:05:10",
            "sources_seen": "billing,email_engagement"
        },
        "found": true
    }
    """
    consent_data = load_consent_data()
    record = consent_data.get(str(moscid))

    if not record:
        fallback = _automotive_demo_consent(moscid) or _source_profile_consent(moscid)
        if fallback:
            return jsonify({
                "moscid": moscid,
                "consent": fallback,
                "found": True,
            })
        return jsonify({
            "moscid": moscid,
            "consent": None,
            "found":   False,
            "message": "MOSCID not found in consent golden record — "
                       "treated as opted in by null rule"
        }), 404

    # Clean up internal fields
    consent_block = {k: v for k, v in record.items() if k != "resolved_at"}

    return jsonify({
        "moscid":  moscid,
        "consent": consent_block,
        "found":   True,
    })


@consent_bp.route("/gate", methods=["POST"])
def gate_check():
    """
    POST /api/consent/gate
    Evaluate a list of MOSCIDs for a given channel.
    Used before any campaign send.

    Request body:
    {
        "moscids": ["MOSC-001234", "MOSC-005678"],
        "channel": "email"
    }

    Response:
    {
        "channel": "email",
        "total": 2,
        "send": 1,
        "block": 1,
        "bypass": 0,
        "results": [
            {"moscid": "MOSC-001234", "result": "SEND",  "rule": "null_passthrough"},
            {"moscid": "MOSC-005678", "result": "BLOCK", "rule": "marketing_email_consent"}
        ],
        "suppression_list": ["MOSC-005678"]
    }
    """
    body    = request.get_json(force=True, silent=True) or {}
    moscids = body.get("moscids", [])
    channel = body.get("channel", "email").lower()

    if not moscids:
        return jsonify({"error": "moscids list required"}), 400

    consent_data = load_consent_data()
    results      = []

    for moscid in moscids:
        record   = consent_data.get(str(moscid), {})
        decision = run_gate_logic(record, channel)
        results.append({"moscid": moscid, **decision})

    send    = sum(1 for r in results if r["result"] == "SEND")
    block   = sum(1 for r in results if r["result"] == "BLOCK")
    bypass  = sum(1 for r in results if r["result"] == "BYPASS")
    suppression_list = [r["moscid"] for r in results if r["result"] == "BLOCK"]

    return jsonify({
        "channel":          channel,
        "total":            len(results),
        "send":             send,
        "block":            block,
        "bypass":           bypass,
        "results":          results,
        "suppression_list": suppression_list,
        "evaluated_at":     datetime.now(timezone.utc).isoformat(),
    })


@consent_bp.route("/suppression/<channel>", methods=["GET"])
def suppression_export(channel):
    """
    GET /api/consent/suppression/<channel>
    Returns suppression list for a channel as CSV download.
    Upload directly to email platform before campaign send.

    Usage:
        GET /api/consent/suppression/email
        → downloads suppression_list_email.csv
    """
    consent_data = load_consent_data()
    blocked = []

    for moscid, record in consent_data.items():
        decision = run_gate_logic(record, channel.lower())
        if decision["result"] == "BLOCK":
            blocked.append({
                "moscid":    moscid,
                "rule_fired": decision["rule"],
            })

    if not blocked:
        return jsonify({
            "channel": channel,
            "suppressed": 0,
            "message": "No suppressed MOSCIDs for this channel"
        })

    # Return as CSV download
    df  = pd.DataFrame(blocked)
    csv = df.to_csv(index=False)

    return Response(
        csv,
        mimetype="text/csv",
        headers={
            "Content-Disposition":
                f"attachment; filename=suppression_list_{channel}.csv"
        }
    )


@consent_bp.route("/audit/<moscid>", methods=["GET"])
def get_audit_trail(moscid):
    """
    GET /api/consent/audit/<moscid>
    Returns full consent event history for a MOSCID.
    Used for compliance queries — "when did this customer opt out?"

    Response:
    {
        "moscid": "MOSC-001234",
        "event_count": 3,
        "events": [
            {
                "consent_field": "marketing_email_consent",
                "consent_value": "opt_out",
                "consent_source": "call_center",
                "consent_timestamp": "2024-08-05T11:45:00",
                "agent_id": "AGT-204"
            },
            ...
        ]
    }
    """
    ledger_data = load_ledger_data()
    events      = ledger_data.get(str(moscid), [])

    if not events:
        fallback = _automotive_demo_audit(moscid) or _source_profile_audit(moscid)
        if fallback:
            return jsonify(fallback)
        return jsonify({
            "moscid":      moscid,
            "event_count": 0,
            "events":      [],
            "message":     "No consent events found for this MOSCID"
        }), 404

    # Sort by timestamp descending — most recent first
    events_sorted = sorted(
        events,
        key=lambda e: str(e.get("consent_timestamp") or ""),
        reverse=True
    )

    return jsonify({
        "moscid":      moscid,
        "event_count": len(events_sorted),
        "events":      events_sorted,
    })


@consent_bp.route("/summary", methods=["GET"])
def consent_summary():
    """
    GET /api/consent/summary
    Returns aggregate consent stats across all MOSCIDs.
    Used for dashboard / reporting.
    """
    consent_data = load_consent_data()
    if not consent_data:
        return jsonify({"error": "No consent data loaded"}), 503

    df = pd.DataFrame.from_dict(consent_data, orient="index")
    df = df.where(pd.notna(df), None)

    def vc(col):
        if col not in df.columns:
            return {}
        return df[col].value_counts(dropna=True).to_dict()

    total = len(df)
    suppressed = int(df["marketing_suppressed"].sum()) if "marketing_suppressed" in df.columns else 0

    return jsonify({
        "total_moscids":       total,
        "marketing_suppressed": suppressed,
        "suppression_rate":    f"{suppressed/max(total,1)*100:.1f}%",
        "fields": {
            "data_processing_consent":  vc("data_processing_consent"),
            "global_consent":           vc("global_consent"),
            "marketing_email_consent":  vc("marketing_email_consent"),
            "tracking_cookie_consent":  vc("tracking_cookie_consent"),
        },
        "sources_seen": vc("sources_seen"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })


# ── Standalone runner (for testing outside app.py) ────────────────────────────
def create_app():
    app = Flask(__name__)
    app.register_blueprint(consent_bp)
    return app


if __name__ == "__main__":
    print("[consent_api] Loading consent data ...")
    consent_data = load_consent_data()
    ledger_data  = load_ledger_data()
    print(f"[consent_api] Loaded {len(consent_data):,} MOSCIDs from golden record")
    print(f"[consent_api] Loaded {len(ledger_data):,} MOSCIDs from ledger")
    print(f"[consent_api] Starting on http://localhost:5002")
    print(f"[consent_api]")
    print(f"[consent_api] Available endpoints:")
    print(f"[consent_api]   GET  /api/consent/health")
    print(f"[consent_api]   GET  /api/consent/summary")
    print(f"[consent_api]   GET  /api/consent/<moscid>")
    print(f"[consent_api]   POST /api/consent/gate")
    print(f"[consent_api]   GET  /api/consent/suppression/<channel>")
    print(f"[consent_api]   GET  /api/consent/audit/<moscid>")

    app = create_app()
    app.run(host="0.0.0.0", port=5002, debug=True)
