from functools import lru_cache
from datetime import datetime, timezone
import importlib.util
import json
import os
import re
import threading
import time
from pathlib import Path
from typing import Optional
from urllib import error as urllib_error
from urllib import request as urllib_request
import pandas as pd
from flask import jsonify, request, send_from_directory
import numpy as np
from config_loader import (
    get_databricks_catalog,
    get_databricks_schema,
    get_default_source,
    get_directory,
    get_path,
    get_supported_sources,
)
from data_registry import get_registry
from databricks_uc_io import (
    DatabricksDataAccessError,
    configured_warehouse_id,
    install_databricks_compat,
    tables_fast_metadata,
    uc_enabled,
)
from payload_loader import (
    get_ajo_api_key,
    get_ajo_default,
    get_ajo_env_value,
    get_ajo_payload,
)
from services.copilot_artifacts import CopilotArtifactService
from services.concurrency import (
    cached_result,
    clear_cached_results,
    env_flag,
    timed_section,
)
from services.measurement import MeasurementService


ROOT = get_directory("app_root")
LEGACY_ROOT = get_directory("legacy_root")
PRESET_JOURNEYS_DIR = get_directory("preset_journeys")
CUSTOM_JOURNEYS_DIR = get_directory("custom_journeys")
CUSTOM_SEGMENTS_DIR = get_directory("custom_segments")
AI_SEGMENTS_DIR = get_directory("ai_segments")
COPILOT_SEGMENTS_FILE = get_path("copilot_segments")
CAMPAIGNS_JOURNEYS_REPORT_PATH = get_path("campaigns_journeys_report")
SUPPORTED_SOURCE_SYSTEMS = set(get_supported_sources())

_STARTUP_STARTED = time.perf_counter()
print("[STARTUP] Initializing Databricks compatibility and Flask routes...", flush=True)
_STARTUP_STAGE = time.perf_counter()
install_databricks_compat(ROOT, extra_roots=[LEGACY_ROOT])
print(
    f"[STARTUP] Databricks compatibility installed in "
    f"{time.perf_counter() - _STARTUP_STAGE:.1f}s.",
    flush=True,
)
COPILOT_ARTIFACT_SERVICE = CopilotArtifactService()
MEASUREMENT_SERVICE = MeasurementService()


def load_legacy_app():
    import sys
    legacy_backend = str(get_directory("legacy_backend_root"))
    if legacy_backend not in sys.path:
        sys.path.insert(0, legacy_backend)
    legacy_app_path = LEGACY_ROOT / "backend" / "app.py"
    spec = importlib.util.spec_from_file_location("legacy_idres_backend_app", legacy_app_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load legacy backend from {legacy_app_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


_STARTUP_STAGE = time.perf_counter()
app = load_legacy_app()
app.extensions["codex_cached_result"] = cached_result
app.extensions["codex_clear_cached_results"] = clear_cached_results
from segment_lifecycle import SegmentLifecycleStore

SEGMENT_LIFECYCLE_STORE = SegmentLifecycleStore(
    COPILOT_SEGMENTS_FILE,
    AI_SEGMENTS_DIR,
    extra_directories=[CUSTOM_SEGMENTS_DIR],
    default_source=get_default_source(),
)
print(
    f"[STARTUP] Legacy Flask routes loaded in "
    f"{time.perf_counter() - _STARTUP_STAGE:.1f}s.",
    flush=True,
)

app.json.sort_keys = False

try:
    from qa_automation import register_qa_automation_routes
except ModuleNotFoundError:
    from backend.qa_automation import register_qa_automation_routes

_STARTUP_STAGE = time.perf_counter()
register_qa_automation_routes(app)
print(
    f"[STARTUP] QA routes registered in {time.perf_counter() - _STARTUP_STAGE:.1f}s.",
    flush=True,
)


def _warm_sql_warehouse_async():
    """Start the bound warehouse without delaying frontend readiness."""
    enabled = str(os.getenv("CODEX_WARM_WAREHOUSE_ON_START", "1")).lower()
    warehouse_id = configured_warehouse_id()
    if not uc_enabled() or enabled not in {"1", "true", "yes"} or not warehouse_id:
        return

    def worker():
        try:
            from databricks.sdk import WorkspaceClient

            WorkspaceClient().warehouses.start(id=warehouse_id)
            print(
                f"[STARTUP] SQL warehouse warm-up requested: {warehouse_id}.",
                flush=True,
            )
        except Exception as exc:
            print(f"[WARN] SQL warehouse warm-up failed: {exc}", flush=True)

    threading.Thread(
        target=worker,
        name="sql-warehouse-warmup",
        daemon=True,
    ).start()


_warm_sql_warehouse_async()


@app.errorhandler(DatabricksDataAccessError)
def handle_databricks_data_error(exc):
    app.logger.error(
        "Unity Catalog request failed: method=%s path=%s error=%s",
        request.method,
        request.path,
        exc,
    )
    return jsonify({"error": str(exc), "data_source": "uc"}), 503


@app.get("/api/runtime/uc-health")
def databricks_uc_health():
    """Probe the configured UC tables without returning credentials or table data."""
    source = str(request.args.get("source") or get_default_source()).strip().lower()
    supported_sources = get_supported_sources()
    if source not in supported_sources:
        return jsonify(
            {
                "status": "invalid_source",
                "error": f"Unsupported source '{source}'.",
                "supported_sources": list(supported_sources),
            }
        ), 400

    catalog = get_databricks_catalog()
    source_schema = get_databricks_schema("sources")
    cdp_schema = get_databricks_schema("cdp")
    warehouse_id = configured_warehouse_id()
    warehouse_configured = bool(warehouse_id)
    configuration = {
        "data_source": str(os.getenv("CODEX_DATA_SOURCE") or "uc").strip().lower(),
        "catalog": catalog,
        "schemas": {"sources": source_schema, "cdp": cdp_schema},
        "warehouse_configured": warehouse_configured,
        "warehouse_source": (
            "environment"
            if str(os.getenv("DATABRICKS_WAREHOUSE_ID") or "").strip()
            else "application_config"
            if warehouse_configured
            else "missing"
        ),
        "databricks_host_configured": bool(str(os.getenv("DATABRICKS_HOST") or "").strip()),
    }

    if not uc_enabled():
        return jsonify(
            {
                "status": "local",
                "source": source,
                "configuration": configuration,
                "message": "Unity Catalog access is disabled because CODEX_DATA_SOURCE is not 'uc'.",
            }
        )

    if not warehouse_configured:
        return jsonify(
            {
                "status": "error",
                "source": source,
                "configuration": configuration,
                "error": (
                    "No Databricks SQL warehouse is configured. Bind the Databricks "
                    "App sql_warehouse resource or set DATABRICKS_WAREHOUSE_ID, then "
                    "redeploy."
                ),
            }
        ), 503

    feature_tables = {
        "all_preprocessed",
        "all_standardized",
        "candidate_pairs",
        "clustered_records",
        "golden_records",
        "superseded_ids",
        "customer_profile_export",
        "household_links",
        "identity_graph",
    }
    refs = []
    seen = set()
    for ref in get_registry().all():
        is_raw_source = ref.schema == source_schema and ref.source == source
        is_feature_table = (
            ref.schema == cdp_schema
            and ref.logical_name in feature_tables
            and (ref.source in {None, source})
        )
        marker = (ref.schema, ref.table, ref.source)
        if (is_raw_source or is_feature_table) and marker not in seen:
            seen.add(marker)
            refs.append(ref)

    requests = [
        {
            "key": f"{ref.schema}.{ref.table}",
            "name": ref.table,
            "source": ref.source or source,
            "catalog": catalog,
            "schema": ref.schema,
        }
        for ref in refs
    ]
    # Health needs table existence and schema access, not expensive exact row
    # counts across every configured source. A shared COUNT timeout otherwise
    # makes every readable table look like an access failure.
    metadata = tables_fast_metadata(requests, include_row_counts=False)
    tables = []
    errors = []
    missing = []
    readable = 0
    for ref in refs:
        key = f"{ref.schema}.{ref.table}"
        details = metadata.get(key, {})
        table_errors = [
            str(details[name])
            for name in ("catalog_error", "columns_error")
            if details.get(name)
        ]
        exists_state = details.get("exists")
        exists = exists_state is True
        if table_errors:
            errors.extend(table_errors)
        elif exists:
            readable += 1
        if exists_state is False:
            missing.append(key)
        tables.append(
            {
                "logical_name": ref.logical_name,
                "layer": "source" if ref.schema == source_schema else "cdp",
                "table": f"{catalog}.{ref.schema}.{ref.table}",
                "exists": exists,
                "row_count": details.get("row_count"),
                "column_count": len(details.get("columns") or []),
                "errors": table_errors,
            }
        )

    unique_errors = list(dict.fromkeys(errors))
    status = "ok"
    http_status = 200
    if unique_errors:
        status = "error" if readable == 0 else "degraded"
        http_status = 503
    elif missing:
        status = "degraded"

    return jsonify(
        {
            "status": status,
            "source": source,
            "configuration": configuration,
            "summary": {
                "configured_tables": len(tables),
                "readable_tables": readable,
                "missing_tables": len(missing),
                "tables_with_access_errors": sum(1 for table in tables if table["errors"]),
            },
            "errors": unique_errors,
            "missing": missing,
            "tables": tables,
        }
    ), http_status


def slugify(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return cleaned or fallback


def read_json_files(directory: Path):
    return COPILOT_ARTIFACT_SERVICE.read_json_files(directory)


def write_json(path: Path, payload):
    COPILOT_ARTIFACT_SERVICE.write_json(path, payload)


def normalize_source_system(value, fallback="sports"):
    return COPILOT_ARTIFACT_SERVICE.normalize_source_system(value, fallback)


def _finite_number_or_none(value):
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if np.isfinite(number) and number >= 0 else None


def _rounded_int_or_none(value):
    number = _finite_number_or_none(value)
    return int(round(number)) if number is not None else None


def _normalized_report_name(value):
    normalized = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
    return re.sub(r"\bwin back\b", "winback", normalized)


def _report_name_aliases(value):
    normalized = _normalized_report_name(value)
    if not normalized:
        return []
    aliases = [normalized]
    for suffix in (" journey", " sprint", " workflow"):
        if normalized.endswith(suffix):
            aliases.append(normalized[:-len(suffix)].strip())
    return aliases


def _json_artifacts_with_local_fallback(directory):
    """Read UC Volume JSON artifacts plus any packaged-only definitions."""
    uc_paths = set()
    try:
        uc_paths.update(directory.glob("*.json"))
    except Exception as exc:
        print(f"[WARNING] Unable to list UC JSON artifacts in {directory}: {exc}")
    local_paths = set()
    try:
        with os.scandir(directory) as entries:
            local_paths.update(
                Path(entry.path)
                for entry in entries
                if entry.is_file() and entry.name.lower().endswith(".json")
            )
    except OSError:
        pass

    artifacts = []
    for path in sorted(uc_paths | local_paths):
        try:
            if path in uc_paths:
                payload = COPILOT_ARTIFACT_SERVICE.read_json_with_local_fallback(
                    path,
                    default=None,
                )
            else:
                with path.open("r", encoding="utf-8") as handle:
                    payload = json.load(handle)
            if isinstance(payload, dict):
                artifacts.append((path, payload))
        except Exception as exc:
            print(f"[WARNING] Skipping invalid JSON file {path}: {exc}")
    return artifacts


def _journey_entry_audience_lookup():
    """Return configured journey-name to entry-audience lineage.

    This reads journey definitions only.  It does not infer membership or
    campaign attribution when a definition does not contain an entry audience.
    """
    candidates = {}
    for directory in (PRESET_JOURNEYS_DIR, CUSTOM_JOURNEYS_DIR):
        for path, journey in _json_artifacts_with_local_fallback(directory):
            entry_criteria = journey.get("entryCriteria") if isinstance(journey.get("entryCriteria"), dict) else {}
            journey_form = journey.get("journeyForm") if isinstance(journey.get("journeyForm"), dict) else {}
            journey_table = journey.get("journeyTable") if isinstance(journey.get("journeyTable"), dict) else {}
            audience = entry_criteria.get("audienceName") or journey_form.get("audience")
            if not audience:
                continue

            # Some folders contain both the governed journey and a sprint/demo
            # variant with a nearly identical name. Prefer the explicit
            # ``*-journey.json`` artifact, then custom definitions, while still
            # retaining other files as truthful fallbacks.
            priority = (
                0 if path.stem.lower().endswith("-journey")
                else 1 if directory == CUSTOM_JOURNEYS_DIR
                else 2
            )
            names = [
                journey.get("name"),
                journey.get("useCaseId"),
                journey.get("slug"),
                journey_table.get("journeyName"),
            ]
            for name in names:
                for alias_rank, normalized in enumerate(_report_name_aliases(name)):
                    existing = candidates.get(normalized)
                    rank = (alias_rank, priority)
                    if existing is None or rank < existing[:2]:
                        candidates[normalized] = (alias_rank, priority, str(audience))

    return {name: value[2] for name, value in candidates.items()}


def _entry_audience_for_journey(journey_name, lookup):
    normalized = _normalized_report_name(journey_name)
    if not normalized:
        return None
    if normalized in lookup:
        return lookup[normalized]
    candidates = [
        (key, audience)
        for key, audience in lookup.items()
        if normalized in key or key in normalized
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda item: (abs(len(item[0]) - len(normalized)), len(item[0])))
    return candidates[0][1]


_JOURNEY_CATALOG_CACHE = {}


def _journey_category_name(journey):
    category = journey.get("category")
    journey_table = journey.get("journeyTable")
    if isinstance(category, dict) and category.get("categoryName"):
        return str(category["categoryName"])
    if isinstance(journey_table, dict) and journey_table.get("journeyCategory"):
        return str(journey_table["journeyCategory"])
    return str(journey.get("categoryName") or journey.get("categoryId") or "Unclassified")


def _journey_trigger_type(journey):
    journey_config = journey.get("journey")
    blueprint = journey.get("blueprintForm")
    value = (
        journey_config.get("type") if isinstance(journey_config, dict) else None
    ) or (
        blueprint.get("singleTriggerType") if isinstance(blueprint, dict) else None
    )
    normalized = str(value or "Unclassified").strip().lower().replace("_", "-")
    return {
        "event-based": "Event based",
        "scheduled": "Scheduled",
        "data-driven": "Data driven",
    }.get(normalized, str(value or "Unclassified"))


def _journey_has_variants(journey):
    serialized = json.dumps(journey, separators=(",", ":"))
    return '"variantA"' in serialized and '"variantB"' in serialized


def _journey_custom_experiment(custom_records):
    for journey in custom_records:
        form = journey.get("journeyForm") if isinstance(journey.get("journeyForm"), dict) else {}
        blueprint = journey.get("blueprintForm") if isinstance(journey.get("blueprintForm"), dict) else {}
        nodes = journey.get("nodes") if isinstance(journey.get("nodes"), list) else []
        node_details = journey.get("nodeDetails") if isinstance(journey.get("nodeDetails"), list) else []
        split_present = any(
            isinstance(node, dict) and str(node.get("kind") or "").lower() == "split"
            for node in nodes
        )
        holdout_present = any(
            isinstance(node, dict) and str(node.get("kind") or "").lower() == "holdout"
            for node in nodes
        )
        if not (_journey_has_variants(journey) and (split_present or form.get("split") is not None)):
            continue

        assignment = None
        declared_events = None
        for detail in node_details:
            if not isinstance(detail, dict) or str(detail.get("kind") or "").lower() != "split":
                continue
            for row in detail.get("rows") or []:
                if not isinstance(row, dict):
                    continue
                key = str(row.get("key") or "").strip().lower()
                if key == "assignment":
                    assignment = row.get("value")
                elif key == "cjaevents":
                    declared_events = row.get("value")

        holdout = float(form.get("holdout") or 0)
        split = float(form.get("split") or 0)
        return {
            "name": journey.get("name"),
            "category": journey.get("categoryName") or journey.get("categoryId"),
            "objective": form.get("objective"),
            "source": "saved custom journey",
            "topology_present": split_present,
            "holdout_present": holdout_present,
            "holdout_pct": holdout,
            "treatment_pct": max(100 - holdout, 0),
            "variant_a_pct": split,
            "variant_b_pct": max(100 - split, 0),
            "variant_a": form.get("variantA"),
            "variant_b": form.get("variantB"),
            "assignment": assignment,
            "declared_events": declared_events,
            "outcome_window_hours": blueprint.get("singleOutcomeWindowHours"),
            "ab_toggle": blueprint.get("singleUseAB"),
            "results_available": False,
        }
    return None


def _journey_catalog_report():
    preset_artifacts = _json_artifacts_with_local_fallback(PRESET_JOURNEYS_DIR)
    custom_artifacts = _json_artifacts_with_local_fallback(CUSTOM_JOURNEYS_DIR)
    preset_paths = [path for path, _ in preset_artifacts]
    custom_paths = [path for path, _ in custom_artifacts]
    paths = [*preset_paths, *custom_paths]
    signature = _artifact_signature(paths)
    cached = _JOURNEY_CATALOG_CACHE.get("catalog")
    if cached and cached.get("signature") == signature:
        return cached["payload"]

    preset_records = [payload for _, payload in preset_artifacts]
    custom_records = [payload for _, payload in custom_artifacts]
    category_counts = {}
    status_counts = {}
    trigger_counts = {}
    touchpoint_counts = {}
    total_touchpoints = 0
    ready_definitions = 0
    explicitly_active = 0
    active_flag_coverage = 0
    explicitly_inactive = 0
    analytics_configured = 0
    frequency_capping_configured = 0
    variant_preset_definitions = 0

    for journey in preset_records:
        category = _journey_category_name(journey)
        category_counts[category] = category_counts.get(category, 0) + 1

        status = str(journey.get("status") or "Status not stored").strip().upper()
        status_counts[status] = status_counts.get(status, 0) + 1
        if status == "READY":
            ready_definitions += 1

        if "active" in journey:
            active_flag_coverage += 1
            if journey.get("active") is True:
                explicitly_active += 1
            elif journey.get("active") is False:
                explicitly_inactive += 1

        if isinstance(journey.get("analytics"), dict):
            analytics_configured += 1
        if isinstance(journey.get("ajoConfig"), dict):
            frequency_capping_configured += 1

        trigger = _journey_trigger_type(journey)
        trigger_counts[trigger] = trigger_counts.get(trigger, 0) + 1

        touchpoints = journey.get("touchpoints")
        touchpoint_count = len(touchpoints) if isinstance(touchpoints, list) else 0
        total_touchpoints += touchpoint_count
        touchpoint_counts[str(touchpoint_count)] = (
            touchpoint_counts.get(str(touchpoint_count), 0) + 1
        )

        if _journey_has_variants(journey):
            variant_preset_definitions += 1

    custom_variant_definitions = sum(
        1 for journey in custom_records if _journey_has_variants(journey)
    )
    payload = {
        "preset_definitions": len(preset_records),
        "custom_definitions": len(custom_records),
        "total_definitions": len(preset_records) + len(custom_records),
        "ready_definitions": ready_definitions,
        "status_missing": max(len(preset_records) - ready_definitions, 0),
        "explicitly_active": explicitly_active,
        "explicitly_inactive": explicitly_inactive,
        "active_flag_coverage": active_flag_coverage,
        "analytics_configured": analytics_configured,
        "frequency_capping_configured": frequency_capping_configured,
        "total_touchpoints": total_touchpoints,
        "average_touchpoints": round(
            total_touchpoints / len(preset_records), 2
        ) if preset_records else None,
        "variant_preset_definitions": variant_preset_definitions,
        "variant_definitions": variant_preset_definitions + custom_variant_definitions,
        "category_distribution": [
            {"label": label, "value": value}
            for label, value in sorted(
                category_counts.items(), key=lambda item: (-item[1], item[0])
            )
        ],
        "status_distribution": [
            {"label": label, "value": value}
            for label, value in sorted(
                status_counts.items(), key=lambda item: (-item[1], item[0])
            )
        ],
        "trigger_type_distribution": [
            {"label": label, "value": value}
            for label, value in sorted(
                trigger_counts.items(), key=lambda item: (-item[1], item[0])
            )
        ],
        "touchpoint_distribution": [
            {"label": label, "value": value}
            for label, value in sorted(
                touchpoint_counts.items(), key=lambda item: int(item[0])
            )
        ],
        "custom_experiment": _journey_custom_experiment(custom_records),
        "people_enrolled": None,
        "completed_journeys": None,
        "recently_used": None,
    }
    _JOURNEY_CATALOG_CACHE["catalog"] = {
        "signature": signature,
        "payload": payload,
    }
    return payload


def read_campaigns_journeys_report(source_system=None):
    selected_source = normalize_source_system(source_system)
    try:
        payload = COPILOT_ARTIFACT_SERVICE.read_json_with_local_fallback(
            CAMPAIGNS_JOURNEYS_REPORT_PATH,
            default=None,
        )
        if payload is None:
            raise FileNotFoundError(
                f"Campaign reporting artifact not found: {CAMPAIGNS_JOURNEYS_REPORT_PATH}"
            )
    except Exception as exc:
        print(f"[WARNING] Unable to read campaigns journeys report: {exc}")
        return {
            "status": "error",
            "data_available": False,
            "error": "The campaigns and journeys reporting artifact could not be read.",
            "source_system": selected_source,
            "date_range": {},
            "filters": {},
            "summary": {},
            "deltas": {},
            "delivery_funnel": [],
            "channel_mix": [],
            "performance_trend": [],
            "campaign_performance": [],
            "journey_performance": [],
            "device_geography": {},
            "bounce_classification": [],
            "suppression_summary": {},
            "suppression_reasons": [],
        }

    reports = payload.get("reports") if isinstance(payload, dict) else None
    if isinstance(reports, dict):
        report = reports.get(selected_source)
        if not isinstance(report, dict) or not report:
            return {
                "status": "unavailable",
                "data_available": False,
                "error": f"No campaigns and journeys report is available for {selected_source}.",
                "source_system": selected_source,
                "date_range": {},
                "filters": {},
                "summary": {},
                "deltas": {},
                "delivery_funnel": [],
                "channel_mix": [],
                "performance_trend": [],
                "campaign_performance": [],
                "journey_performance": [],
                "device_geography": {},
                "bounce_classification": [],
                "suppression_summary": {},
                "suppression_reasons": [],
            }
    else:
        report = payload if isinstance(payload, dict) else {}

    if not isinstance(report, dict):
        report = {}

    result = dict(report)
    result["status"] = result.get("status") or "success"
    result["data_available"] = bool(report)
    result["source_system"] = selected_source
    result.setdefault("date_range", {})
    result.setdefault("filters", {})
    result.setdefault("summary", {})
    result.setdefault("deltas", {})
    result.setdefault("delivery_funnel", [])
    result.setdefault("channel_mix", [])
    result.setdefault("performance_trend", [])
    result.setdefault("campaign_performance", [])
    result.setdefault("journey_performance", [])
    result.setdefault("device_geography", {})
    result.setdefault("bounce_classification", [])
    result.setdefault("suppression_summary", {})
    result.setdefault("suppression_reasons", [])
    result["journey_catalog"] = _journey_catalog_report()

    # Additive configuration lineage used only by reporting.  A missing match
    # remains null and is rendered as unallocated rather than guessed.
    audience_lookup = _journey_entry_audience_lookup()
    for campaign in result.get("campaign_performance", []):
        if isinstance(campaign, dict):
            campaign["entry_audience"] = _entry_audience_for_journey(
                campaign.get("journey"), audience_lookup
            )

    summary = result["summary"]
    funnel = result["delivery_funnel"]
    funnel_lookup = {
        str(item.get("stage", "")).strip().lower(): _finite_number_or_none(
            item.get("value")
        )
        for item in funnel
        if isinstance(item, dict) and str(item.get("stage", "")).strip()
    }
    sent = _finite_number_or_none(summary.get("total_sent"))
    if sent is None:
        sent = funnel_lookup.get("sent")
    delivered = funnel_lookup.get("delivered")
    opened = funnel_lookup.get("opened")
    clicked = funnel_lookup.get("clicked")
    converted = funnel_lookup.get("converted")
    revenue = _finite_number_or_none(summary.get("revenue"))

    reported_conversions = _finite_number_or_none(summary.get("total_conversions"))
    summary["total_conversions"] = _rounded_int_or_none(
        reported_conversions if reported_conversions is not None else converted
    )
    summary["conversion_rate"] = (
        round((converted / sent) * 100, 1)
        if converted is not None and sent is not None and sent != 0
        else None
    )
    summary["click_to_open_rate"] = (
        round((clicked / opened) * 100, 1)
        if clicked is not None and opened is not None and opened != 0
        else None
    )
    summary["revenue_per_conversion"] = (
        round(revenue / converted, 0)
        if revenue is not None and converted is not None and converted != 0
        else None
    )
    # The source artifact contains campaign performance health (Pass/Warn), not
    # a journey lifecycle registry.  Keep Active Journeys explicitly
    # unavailable rather than relabelling performance health as runtime state.
    summary["active_journeys"] = None
    summary["people_enrolled"] = None
    summary["completed_journeys"] = None
    summary["recently_used"] = None
    summary["ab_test_results"] = None
    summary["roi"] = None

    channel_rows = [
        row for row in result.get("channel_mix", []) if isinstance(row, dict)
    ]
    channel_counts = [
        _finite_number_or_none(row.get("count")) for row in channel_rows
    ]
    channel_counts_complete = (
        bool(channel_rows)
        and all(str(row.get("channel") or "").strip() for row in channel_rows)
        and all(value is not None for value in channel_counts)
    )
    required_funnel_stages = ["sent", "delivered", "opened", "clicked", "converted"]
    funnel_stage_order = [
        str(row.get("stage") or "").strip().lower()
        for row in funnel
        if isinstance(row, dict)
    ]
    channel_count_total = (
        sum(channel_counts) if channel_counts_complete else None
    )
    ordered_funnel_values = [
        _finite_number_or_none(row.get("value"))
        for row in funnel
        if isinstance(row, dict)
    ]
    funnel_complete = (
        funnel_stage_order == required_funnel_stages
        and all(value is not None for value in ordered_funnel_values)
    )
    result["reconciliation"] = {
        "funnel_monotonic": (
            all(
                current <= previous
                for previous, current in zip(
                    ordered_funnel_values,
                    ordered_funnel_values[1:],
                )
            )
            if funnel_complete
            else None
        ),
        "channel_count_total": _rounded_int_or_none(channel_count_total),
        "channel_counts_reconcile_to_sends": (
            round(channel_count_total, 6) == round(sent, 6)
            if channel_count_total is not None and sent is not None
            else None
        ),
        "campaign_summary_grain": "source reporting window",
        "campaign_detail_grain": "supplied ranked campaign rows",
        "journey_catalog_grain": "global definition files",
    }
    result["metric_definitions"] = {
        "total_sent": {
            "label": "Sends",
            "value": _rounded_int_or_none(sent),
            "calculation": "Reported sends in the selected source artifact and fixed reporting window.",
            "source": "data/campaigns_journeys_report.json",
        },
        "open_rate": {
            "label": "Open Rate",
            "value": summary.get("open_rate"),
            "calculation": "Opened events / delivered events in the selected source report.",
            "numerator": _rounded_int_or_none(opened),
            "denominator": _rounded_int_or_none(delivered),
        },
        "click_rate": {
            "label": "Click Rate",
            "value": summary.get("click_rate"),
            "calculation": "Clicked events / delivered events in the selected source report.",
            "numerator": _rounded_int_or_none(clicked),
            "denominator": _rounded_int_or_none(delivered),
        },
        "conversion_rate": {
            "label": "Conversion Rate",
            "value": summary.get("conversion_rate"),
            "calculation": "Converted events / sends in the selected source report.",
            "numerator": _rounded_int_or_none(converted),
            "denominator": _rounded_int_or_none(sent),
        },
        "reported_journeys": {
            "label": "Reported Journeys",
            "value": summary.get("total_journeys"),
            "calculation": "Journey inventory count declared by the selected source campaign artifact.",
        },
        "total_campaigns": {
            "label": "Total Campaigns",
            "value": summary.get("total_campaigns"),
            "calculation": "Campaign inventory count declared by the selected source campaign artifact.",
        },
        "active_journeys": {
            "label": "Active Journeys",
            "value": None,
            "calculation": "Not available without a governed journey lifecycle registry.",
        },
        "people_enrolled": {
            "label": "People Enrolled",
            "value": None,
            "calculation": "Not available without source-scoped journey enrollment events at a defined identity grain.",
        },
        "completed_journeys": {
            "label": "Completed",
            "value": None,
            "calculation": "Converted campaign events are not relabelled as journey completions; a journey execution ledger is required.",
        },
        "recently_used": {
            "label": "Recently Used",
            "value": None,
            "calculation": "Not available without canonical journey execution timestamps.",
        },
        "ab_test_results": {
            "label": "A/B Test Results",
            "value": None,
            "calculation": "A routed definition exists, but assignment, exposure, outcome, lift, confidence, and significance records do not.",
        },
        "roi": {
            "label": "ROI",
            "value": None,
            "calculation": "Attributed revenue is available; allocable campaign spend is not, so ROI is not inferred.",
        },
    }
    result["runtime_availability"] = {
        "active_journeys": False,
        "people_enrolled": False,
        "completed_journeys": False,
        "recently_used": False,
        "ab_test_results": False,
        "roi": False,
        "reason": (
            "The repository has source campaign outcome snapshots and global journey "
            "definitions, but no governed lifecycle, enrollment, completion, recent-use, "
            "experiment-result, or spend ledger."
        ),
    }

    result["top_campaigns_comparison"] = [
        {
            "campaign": campaign.get("campaign"),
            "open_rate": _finite_number_or_none(campaign.get("open_rate")),
            "click_rate": _finite_number_or_none(campaign.get("click_rate")),
        }
        for campaign in result.get("campaign_performance", [])[:4]
        if isinstance(campaign, dict)
    ]

    campaign_rows = [
        row for row in result.get("campaign_performance", [])
        if isinstance(row, dict)
    ]
    journey_rows = [
        row for row in result.get("journey_performance", [])
        if isinstance(row, dict)
    ]
    detailed_send_values = [
        _finite_number_or_none(row.get("sent")) for row in campaign_rows
    ]
    detailed_revenue_values = [
        _finite_number_or_none(row.get("revenue")) for row in campaign_rows
    ]
    detailed_sends = (
        sum(detailed_send_values)
        if campaign_rows and all(value is not None for value in detailed_send_values)
        else None
    )
    detailed_revenue = (
        sum(detailed_revenue_values)
        if campaign_rows and all(value is not None for value in detailed_revenue_values)
        else None
    )
    total_campaigns = _rounded_int_or_none(summary.get("total_campaigns"))
    total_journeys = _rounded_int_or_none(summary.get("total_journeys"))
    result["detail_coverage"] = {
        "campaign_rows": len(campaign_rows),
        "total_campaigns": total_campaigns,
        "campaign_row_pct": round(
            len(campaign_rows) / total_campaigns * 100, 1
        ) if total_campaigns is not None and total_campaigns != 0 else None,
        "campaign_send_pct": (
            round(detailed_sends / sent * 100, 1)
            if detailed_sends is not None and sent is not None and sent != 0
            else None
        ),
        "campaign_revenue_pct": (
            round(detailed_revenue / revenue * 100, 1)
            if detailed_revenue is not None and revenue is not None and revenue != 0
            else None
        ),
        "unallocated_sends": (
            int(round(sent - detailed_sends))
            if (
                sent is not None
                and detailed_sends is not None
                and sent >= detailed_sends
            )
            else None
        ),
        "unallocated_revenue": (
            round(revenue - detailed_revenue, 2)
            if (
                revenue is not None
                and detailed_revenue is not None
                and revenue >= detailed_revenue
            )
            else None
        ),
        "journey_rows": len(journey_rows),
        "total_journeys": total_journeys,
        "journey_row_pct": round(
            len(journey_rows) / total_journeys * 100, 1
        ) if total_journeys is not None and total_journeys != 0 else None,
    }
    return result



def _resolve_ajo_source_system(journey_payload: dict | None):
    if not isinstance(journey_payload, dict):
        return ""
    return str(journey_payload.get("sourceSystem") or journey_payload.get("source_system") or "").strip().lower()


def _build_ajo_payload(override: dict | None, journey_payload: dict | None):
    if isinstance(override, dict) and override:
        return override
    return get_ajo_payload(_resolve_ajo_source_system(journey_payload))


def _build_ajo_api_key(request_config: dict | None, journey_payload: dict | None):
    if isinstance(request_config, dict):
        api_key = str(request_config.get("apiKey") or "").strip()
        if api_key:
            return api_key
    return get_ajo_api_key(_resolve_ajo_source_system(journey_payload))


@app.get("/api/copilot/bootstrap")
def copilot_bootstrap():
    source_system = normalize_source_system(request.args.get("source_system") or request.args.get("sourceSystem"))
    journeys = read_json_files(PRESET_JOURNEYS_DIR) + read_json_files(CUSTOM_JOURNEYS_DIR)
    lifecycle_segments = SEGMENT_LIFECYCLE_STORE.list(source_system)
    persisted_custom_segments = read_json_files(CUSTOM_SEGMENTS_DIR)
    custom_segments_by_id = {}
    for segment in [*lifecycle_segments, *persisted_custom_segments]:
        if not isinstance(segment, dict):
            continue
        presented = SEGMENT_LIFECYCLE_STORE.present(segment)
        segment_id = presented.get("id")
        if segment_id and segment_id not in custom_segments_by_id:
            custom_segments_by_id[segment_id] = presented
    custom_segments = list(custom_segments_by_id.values())
    activated_segments = SEGMENT_LIFECYCLE_STORE.list(
        source_system,
        published_only=True,
    )
    return jsonify(
        {
            "journeys": journeys,
            "customSegments": custom_segments,
            "activatedSegments": activated_segments,
            "defaultSegmentSourceUrl": "/api/segments",
            "campaignsJourneysReport": read_campaigns_journeys_report(source_system),
        }
    )


@app.get("/api/copilot/campaigns-journeys/report")
def copilot_campaigns_journeys_report():
    source_system = (
        request.args.get("source")
        or request.args.get("source_system")
        or request.args.get("sourceSystem")
    )
    payload = read_campaigns_journeys_report(source_system)
    if payload.get("status") == "error":
        return jsonify(payload), 503
    if payload.get("data_available") is False:
        return jsonify(payload), 404
    return jsonify(payload)


_CUSTOMER_REPORT_CACHE = {}
_CUSTOMER_ACTIVITY_PROFILE_CACHE = {}
_IDENTITY_REPORT_CACHE = {}
_CUSTOMER_REPORT_REVISION = 1
_REPORT_CACHE_LOCK = threading.RLock()
_SOURCE_REPORT_CACHE_NAMESPACES = (
    "standardization-report",
    "quality-record-index",
    "identity-report",
    "customer-report",
)


def _report_cache_seconds(env_name, default=300):
    """Return a bounded, configurable TTL without embedding report values."""
    raw_value = os.getenv(
        env_name,
        os.getenv("CODEX_REPORT_CACHE_SECONDS", os.getenv("CODEX_UC_SQL_CACHE_SECONDS", default)),
    )
    try:
        return min(max(int(str(raw_value).strip()), 0), 3600)
    except (TypeError, ValueError):
        return default


def _report_snapshot_max_age_seconds():
    """Keep source-backed restart snapshots longer than process-local caches."""
    raw_value = os.getenv("CODEX_REPORT_SNAPSHOT_MAX_AGE_SECONDS", "604800")
    try:
        return min(max(int(str(raw_value).strip()), 0), 2592000)
    except (TypeError, ValueError):
        return 604800


def _source_report_snapshot_path(namespace, source):
    safe_namespace = str(namespace or "report").replace("-", "_")
    return (
        ROOT
        / "standardization_reports"
        / source
        / f"{safe_namespace}.json"
    )


def _read_source_report_snapshot(namespace, source, revision):
    """Read a validated UC snapshot without substituting report calculations."""
    if not uc_enabled():
        return None
    path = _source_report_snapshot_path(namespace, source)
    try:
        if not path.exists():
            return None
        envelope = json.loads(path.read_text(encoding="utf-8"))
        generated_at = str(envelope.get("generated_at") or "").strip()
        generated = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        if generated.tzinfo is None:
            generated = generated.replace(tzinfo=timezone.utc)
        age_seconds = max(
            (
                datetime.now(timezone.utc)
                - generated.astimezone(timezone.utc)
            ).total_seconds(),
            0,
        )
        payload = envelope.get("payload")
        max_age_seconds = _report_snapshot_max_age_seconds()
        if (
            envelope.get("snapshot_schema_version") == 1
            and envelope.get("report_namespace") == namespace
            and envelope.get("report_revision") == revision
            and str(envelope.get("source_system") or "").strip().lower() == source
            and isinstance(payload, dict)
            and payload.get("data_available") is True
            and str(payload.get("source_system") or "").strip().lower() == source
            and max_age_seconds > 0
            and age_seconds <= max_age_seconds
        ):
            return payload
    except (OSError, ValueError, TypeError, AttributeError):
        return None
    return None


def _write_source_report_snapshot(namespace, source, revision, payload):
    """Persist only successful, source-backed payloads for restart reuse."""
    if not uc_enabled() or not isinstance(payload, dict):
        return
    if payload.get("data_available") is not True:
        return
    if str(payload.get("source_system") or "").strip().lower() != source:
        return
    path = _source_report_snapshot_path(namespace, source)
    envelope = {
        "snapshot_schema_version": 1,
        "report_namespace": namespace,
        "report_revision": revision,
        "source_system": source,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(envelope, indent=2),
            encoding="utf-8",
        )
    except (OSError, RuntimeError, TypeError, ValueError) as exc:
        app.logger.warning(
            "Unable to persist %s snapshot for %s: %s",
            namespace,
            source,
            exc,
        )


def _purge_source_report_snapshots(source=None):
    """Remove persisted unified reports after a successful pipeline refresh."""
    normalized_source = (
        normalize_source_system(source, "media")
        if source
        else None
    )
    sources = (
        (normalized_source,)
        if normalized_source
        else tuple(sorted(SUPPORTED_SOURCE_SYSTEMS))
    )
    for report_source in sources:
        for namespace in ("identity-report", "customer-report"):
            path = _source_report_snapshot_path(namespace, report_source)
            try:
                path.unlink(missing_ok=True)
            except (OSError, RuntimeError) as exc:
                app.logger.warning(
                    "Unable to purge %s snapshot for %s: %s",
                    namespace,
                    report_source,
                    exc,
                )


def _cached_source_report(namespace, source, revision, loader, ttl_env):
    """Cache completed source-backed UC reports and coalesce cold requests."""
    if not uc_enabled():
        return loader()
    ttl_seconds = _report_cache_seconds(ttl_env)
    enabled = env_flag("CODEX_ENABLE_API_CACHE", True) and ttl_seconds > 0
    with timed_section(f"{namespace}:{source}"):
        return cached_result(
            f"{namespace}:{source}",
            revision,
            ttl_seconds,
            loader,
            enabled=enabled,
        )


def _clear_source_reporting_caches(source=None):
    """Invalidate report snapshots after an identity-pipeline write."""
    normalized_source = (
        normalize_source_system(source, "media")
        if source
        else None
    )
    with _REPORT_CACHE_LOCK:
        if normalized_source:
            _CUSTOMER_REPORT_CACHE.pop(normalized_source, None)
            _CUSTOMER_ACTIVITY_PROFILE_CACHE.pop(normalized_source, None)
            _IDENTITY_REPORT_CACHE.pop(normalized_source, None)
        else:
            _CUSTOMER_REPORT_CACHE.clear()
            _CUSTOMER_ACTIVITY_PROFILE_CACHE.clear()
            _IDENTITY_REPORT_CACHE.clear()

    sources = (
        (normalized_source,)
        if normalized_source
        else tuple(sorted(SUPPORTED_SOURCE_SYSTEMS))
    )
    for report_source in sources:
        for namespace in _SOURCE_REPORT_CACHE_NAMESPACES:
            clear_cached_results(f"{namespace}:{report_source}")


app.extensions["codex_clear_reporting_caches"] = _clear_source_reporting_caches
app.extensions["codex_purge_report_snapshots"] = _purge_source_report_snapshots


def _read_json_object(path):
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def _artifact_signature(paths):
    signature = []
    for path in paths:
        try:
            stat = path.stat()
            signature.append((str(path), stat.st_mtime_ns, stat.st_size))
        except OSError:
            signature.append((str(path), None, None))
    return tuple(signature)


_IDENTITY_TIER_ORDER = ("exact", "strong", "medium", "weak")
_IDENTITY_REPORT_REVISION = 1
_IDENTITY_TIER_LABELS = {
    "exact": "Exact",
    "strong": "Strong",
    "medium": "Medium",
    "weak": "Weak",
}
_IDENTITY_FEED_LABELS = {
    "med_streaming_activity.csv": "Streaming",
    "med_app_events.csv": "App events",
    "med_subscription_billing.csv": "Billing",
    "med_customer_support.csv": "Support",
    "med_email_engagement.csv": "Email",
    "spt_ott_streaming_sessions.csv": "OTT sessions",
    "spt_ticket_orders.csv": "Ticket orders",
    "spt_commerce_orders.csv": "Commerce",
    "spt_fan_accounts.csv": "Fan accounts",
    "spt_fantasy_gaming_accounts.csv": "Fantasy",
    "aut_vehicle_health_reports.csv": "Vehicle health",
    "aut_telematics_monthly_summary.csv": "Telematics",
    "aut_campaign_interactions.csv": "Campaign",
    "aut_dtc_events.csv": "DTC events",
    "aut_website_sessions.csv": "Website",
}


def _identity_feed_label(value):
    file_name = Path(str(value or "")).name.lower()
    if file_name in _IDENTITY_FEED_LABELS:
        return _IDENTITY_FEED_LABELS[file_name]
    cleaned = re.sub(r"^(med|spt|aut|tel)_", "", file_name)
    cleaned = re.sub(r"\.csv$", "", cleaned)
    return cleaned.replace("_", " ").strip().title() or "Unknown feed"


def _identity_unavailable(source, reason):
    return {
        "source_system": source,
        "data_available": False,
        "error": reason,
        "summary": {},
        "cluster_depth": [],
        "confidence_tiers": [],
        "source_linkage": {},
        "review": {
            "weak_candidates": None,
            "pending": None,
            "accepted": None,
            "rejected": None,
        },
    }


def _compute_identity_graph_report(source):
    source = normalize_source_system(source, "media")
    cluster_path = LEGACY_ROOT / "clustering_output" / source / "cluster_summary.json"
    clustered_records_path = (
        LEGACY_ROOT / "clustering_output" / source / "clustered_records.csv"
    )
    candidate_path = LEGACY_ROOT / "matching_output" / source / "candidate_pairs.csv"
    signature = _artifact_signature(
        [cluster_path, clustered_records_path, candidate_path]
    )
    cached = _IDENTITY_REPORT_CACHE.get(source)
    # Local artifact mtimes provide a reliable invalidation signature. UC
    # compatibility paths do not expose those mtimes, so re-read the
    # source-scoped artifacts there instead of serving a permanently stale
    # report after an identity-resolution rerun.
    if not uc_enabled() and cached and cached.get("signature") == signature:
        return cached["payload"]

    if not clustered_records_path.exists() or not candidate_path.exists():
        return _identity_unavailable(
            source,
            "Source-scoped clustered-record membership and candidate-pair "
            "artifacts are required.",
        )

    cluster = _read_json_object(cluster_path) if cluster_path.exists() else {}
    summary_source = str(cluster.get("source_system") or "").strip().lower()
    cluster_metrics = {
        "total_records": cluster.get("total_records"),
        "total_clusters": cluster.get("total_clusters"),
        "multi_record_clusters": cluster.get("multi_record_clusters"),
        "singletons": cluster.get(
            "singletons",
            cluster.get("single_record_clusters"),
        ),
        "largest_cluster": cluster.get(
            "largest_cluster",
            cluster.get("largest_cluster_size"),
        ),
    }
    summary_metrics = None
    summary_issue = None
    if not cluster:
        summary_issue = "Cluster summary is unavailable."
    elif summary_source and summary_source != source:
        summary_issue = "Cluster summary belongs to a different source system."
    elif any(value is None for value in cluster_metrics.values()):
        summary_issue = "Cluster summary is missing required reporting metrics."
    else:
        try:
            summary_metrics = {
                key: int(value)
                for key, value in cluster_metrics.items()
            }
        except (TypeError, ValueError):
            summary_issue = "Cluster summary contains invalid reporting metrics."

    required_membership_columns = {"record_id", "cluster_id", "source_file"}
    try:
        membership_headers = set(
            pd.read_csv(clustered_records_path, nrows=0).columns.astype(str)
        )
        if not required_membership_columns.issubset(membership_headers):
            return _identity_unavailable(
                source,
                "Clustered-record membership is missing record, cluster, or source lineage.",
            )
        clustered_membership = pd.read_csv(
            clustered_records_path,
            usecols=list(required_membership_columns),
            dtype=str,
            low_memory=False,
        ).fillna("")
    except Exception as exc:
        return _identity_unavailable(
            source,
            f"Clustered-record membership could not be read: {exc}",
        )

    for column in required_membership_columns:
        clustered_membership[column] = (
            clustered_membership[column].astype(str).str.strip()
        )
    if bool(
        clustered_membership[list(required_membership_columns)]
        .eq("")
        .any(axis=None)
    ):
        return _identity_unavailable(
            source,
            "Clustered records contain blank record, cluster, or source lineage.",
        )
    repeated_record_rows = int(
        clustered_membership["record_id"].duplicated(keep="first").sum()
    )
    if repeated_record_rows:
        # Event and transaction sources can legitimately repeat a governed
        # source-record identifier. The matching pipeline treats that identifier
        # as one node, so repeats are safe only when their cluster and source
        # lineage are identical. Conflicting membership remains a hard failure.
        repeated_membership = (
            clustered_membership.loc[
                clustered_membership["record_id"].duplicated(keep=False)
            ]
            .groupby("record_id", sort=False)
            .agg(
                cluster_count=("cluster_id", "nunique"),
                source_count=("source_file", "nunique"),
            )
        )
        if bool(
            (
                (repeated_membership["cluster_count"] != 1)
                | (repeated_membership["source_count"] != 1)
            ).any()
        ):
            return _identity_unavailable(
                source,
                "Repeated record identifiers have conflicting cluster or source lineage.",
            )

    cluster_sizes = clustered_membership["cluster_id"].value_counts()
    if cluster_sizes.empty:
        return _identity_unavailable(
            source,
            "Clustered-record membership contains no customer profiles.",
        )
    multi_cluster_ids = set(
        str(value) for value in cluster_sizes[cluster_sizes > 1].index
    )
    singleton_cluster_count = int((cluster_sizes == 1).sum())
    derived_metrics = {
        "total_records": int(len(clustered_membership)),
        "total_clusters": int(len(cluster_sizes)),
        "multi_record_clusters": int(len(multi_cluster_ids)),
        "singletons": singleton_cluster_count,
        "largest_cluster": int(cluster_sizes.max()),
    }
    cluster_summary_reconciles = summary_metrics == derived_metrics
    if not cluster_summary_reconciles and summary_issue is None:
        summary_issue = (
            "Cluster summary does not reconcile to current clustered-record "
            "membership."
        )

    # Clustered membership is the row-level output consumed by both the graph
    # and profile views. It remains authoritative when a JSON summary from a
    # previous or interrupted run is missing or stale.
    input_records = derived_metrics["total_records"]
    total_clusters = derived_metrics["total_clusters"]
    multi_clusters = derived_metrics["multi_record_clusters"]
    singletons = derived_metrics["singletons"]
    largest_cluster = derived_metrics["largest_cluster"]

    source_record_counts = (
        clustered_membership["source_file"].value_counts().sort_values(
            ascending=False
        )
    )
    identity_records_by_source = [
        {
            "key": str(source_file),
            "label": _identity_feed_label(source_file),
            "value": int(value),
        }
        for source_file, value in source_record_counts.items()
    ]
    if sum(row["value"] for row in identity_records_by_source) != input_records:
        return _identity_unavailable(
            source,
            "Identity-record source counts do not reconcile to the clustered input total.",
        )
    record_to_cluster = clustered_membership.set_index("record_id")[
        "cluster_id"
    ].to_dict()

    distribution = (
        cluster.get("size_distribution")
        if cluster_summary_reconciles
        else None
    )
    if not isinstance(distribution, dict):
        # The enhanced clustering contract omits a summary distribution but
        # publishes authoritative row-level cluster membership. Derive the
        # report bands from those reconciled cluster sizes.
        multi_sizes = cluster_sizes[cluster_sizes > 1]
        derived_distribution = {
            "2": int((multi_sizes == 2).sum()),
            "3-5": int(multi_sizes.between(3, 5).sum()),
            "6-10": int(multi_sizes.between(6, 10).sum()),
            "11-25": int(multi_sizes.between(11, 25).sum()),
            "26-50": int(multi_sizes.between(26, 50).sum()),
            "51-100": int(multi_sizes.between(51, 100).sum()),
            "101+": int((multi_sizes > 100).sum()),
        }
        distribution = {
            label: value
            for label, value in derived_distribution.items()
            if value > 0
        }
    depth_rows = []
    for label, raw_value in distribution.items():
        match = re.search(r"\d+", str(label))
        lower_bound = int(match.group(0)) if match else 0
        value = int(raw_value or 0)
        if lower_bound > 1 and value >= 0:
            depth_rows.append({"label": str(label).replace("-", "–"), "value": value})
    depth_rows.sort(
        key=lambda row: int(re.search(r"\d+", row["label"]).group(0))
        if re.search(r"\d+", row["label"])
        else 10**9
    )
    if source == "automotive" and clustered_records_path.exists():
        try:
            cluster_ids = pd.read_csv(
                clustered_records_path,
                usecols=["cluster_id"],
                dtype=str,
                low_memory=False,
            )["cluster_id"]
            cluster_sizes = cluster_ids.dropna().value_counts()
            multi_sizes = cluster_sizes[cluster_sizes > 1]
            detailed_depth = []
            for exact_size in sorted(
                int(value) for value in multi_sizes[multi_sizes < 26].unique()
            ):
                count = int((multi_sizes == exact_size).sum())
                if count:
                    detailed_depth.append(
                        {"label": str(exact_size), "value": count}
                    )
            ranged_bands = (
                ("26–30", 26, 30),
                ("31–35", 31, 35),
                ("36–40", 36, 40),
                (
                    f"41–{int(multi_sizes.max())}",
                    41,
                    int(multi_sizes.max()),
                ),
            )
            for label, lower, upper in ranged_bands:
                count = int(multi_sizes.between(lower, upper).sum())
                if count:
                    detailed_depth.append({"label": label, "value": count})
            if sum(row["value"] for row in detailed_depth) == multi_clusters:
                depth_rows = detailed_depth
        except Exception:
            # The reconciled summary bands remain the governed fallback if the
            # row-level cluster artifact cannot provide a finer distribution.
            pass
    if sum(row["value"] for row in depth_rows) != multi_clusters:
        return _identity_unavailable(
            source,
            "Cluster-depth bands do not reconcile to the multi-record cluster total.",
        )

    required_pair_columns = {
        "source_1",
        "source_2",
        "record_id_1",
        "record_id_2",
        "matched_fields",
    }
    optional_pair_columns = {
        "score",
        "max_possible",
        "final_confidence",
        "edge_type",
        "match_tier",
    }
    try:
        candidate_headers = set(
            pd.read_csv(candidate_path, nrows=0).columns.astype(str)
        )
        tier_columns = [
            column
            for column in ("edge_type", "match_tier")
            if column in candidate_headers
        ]
        if not tier_columns:
            return _identity_unavailable(
                source,
                "Candidate-pair evidence is missing its confidence tier.",
            )
        candidate_pairs = pd.read_csv(
            candidate_path,
            usecols=lambda column: (
                column in required_pair_columns
                or column in optional_pair_columns
            ),
            dtype=str,
            low_memory=False,
        )
    except Exception as exc:
        return _identity_unavailable(source, f"Candidate-pair evidence could not be read: {exc}")
    if not required_pair_columns.issubset(candidate_pairs.columns):
        return _identity_unavailable(
            source,
            "Candidate-pair evidence is missing record, confidence, identifier, "
            "or source-lineage columns.",
        )

    candidate_pairs = candidate_pairs.fillna("")
    # Legacy candidate artifacts populate ``match_tier`` while enhanced
    # artifacts populate ``edge_type``. Some transition tables contain both
    # columns with ``edge_type`` blank on every legacy row, so choose the first
    # populated value per row rather than choosing a column from the header.
    resolved_tier = pd.Series("", index=candidate_pairs.index, dtype=str)
    for tier_column in tier_columns:
        candidate_tier = (
            candidate_pairs[tier_column].astype(str).str.strip().str.lower()
        )
        resolved_tier = resolved_tier.mask(
            resolved_tier.eq("") & candidate_tier.ne(""),
            candidate_tier,
        )
    candidate_pairs["_tier"] = resolved_tier
    if bool(candidate_pairs["_tier"].eq("").any()):
        return _identity_unavailable(
            source,
            "Candidate-pair evidence contains unclassified confidence tiers.",
        )
    pair_count = int(len(candidate_pairs))
    average_match_confidence_pct = None
    confidence_measure_note = (
        "Candidate score and maximum-possible score are not both available."
    )
    if {"score", "max_possible"}.issubset(candidate_headers):
        raw_scores = pd.to_numeric(candidate_pairs["score"], errors="coerce")
        maximum_scores = pd.to_numeric(
            candidate_pairs["max_possible"],
            errors="coerce",
        )
        valid_scores = (
            raw_scores.notna()
            & maximum_scores.notna()
            & (raw_scores >= 0)
            & (maximum_scores > 0)
            & (raw_scores <= maximum_scores)
        )
        if bool(valid_scores.all()) and pair_count:
            average_match_confidence_pct = round(
                float((raw_scores / maximum_scores * 100).mean()),
                4,
            )
            confidence_measure_note = (
                "Mean normalized candidate-pair score across the current artifact."
            )
        elif pair_count == 0:
            confidence_measure_note = (
                "No candidate pairs are available for an average-confidence measure."
            )
        else:
            confidence_measure_note = (
                "One or more candidate scores are missing or outside the governed "
                "0-to-maximum range."
            )
    elif "final_confidence" in candidate_headers:
        final_confidence = pd.to_numeric(
            candidate_pairs["final_confidence"],
            errors="coerce",
        )
        valid_confidence = (
            final_confidence.notna()
            & (final_confidence >= 0)
            & (final_confidence <= 100)
        )
        if bool(valid_confidence.all()) and pair_count:
            average_match_confidence_pct = round(
                float(final_confidence.mean()),
                4,
            )
            confidence_measure_note = (
                "Mean final candidate-pair confidence across the current "
                "enhanced artifact."
            )
        elif pair_count == 0:
            confidence_measure_note = (
                "No candidate pairs are available for an average-confidence measure."
            )
        else:
            confidence_measure_note = (
                "One or more final candidate confidences are missing or outside "
                "the governed 0-to-100 range."
            )
    tier_counts = (
        candidate_pairs["_tier"]
        .value_counts()
        .to_dict()
    )
    confidence_tiers = [
        {
            "key": key,
            "label": _IDENTITY_TIER_LABELS[key],
            "value": int(tier_counts.pop(key, 0)),
        }
        for key in _IDENTITY_TIER_ORDER
    ]
    for key, value in sorted(tier_counts.items()):
        if key:
            confidence_tiers.append(
                {"key": key, "label": key.replace("_", " ").title(), "value": int(value)}
            )
    for row in confidence_tiers:
        category_pairs = candidate_pairs.loc[
            candidate_pairs["_tier"].eq(row["key"])
        ]
        example_counts = (
            category_pairs["matched_fields"]
            .fillna("")
            .astype(str)
            .str.strip()
        )
        example_counts = example_counts[example_counts.ne("")].value_counts()
        row["percentage"] = (
            round(len(category_pairs) / pair_count * 100, 4)
            if pair_count
            else 0
        )
        row["example_combination"] = (
            str(example_counts.index[0])
            if len(example_counts)
            else "No pairs in this category"
        )
    if sum(row["value"] for row in confidence_tiers) != pair_count:
        return _identity_unavailable(
            source,
            "Confidence-tier counts do not reconcile to the candidate-pair total.",
        )

    source_1 = candidate_pairs["source_1"].astype(str).str.strip()
    source_2 = candidate_pairs["source_2"].astype(str).str.strip()
    valid_sources = (source_1 != "") & (source_2 != "")
    if not bool(valid_sources.all()):
        return _identity_unavailable(
            source,
            "Candidate-pair source lineage is incomplete.",
        )

    same_source_pairs = int((source_1 == source_2).sum())
    cross_source_pairs = pair_count - same_source_pairs
    participation = pd.concat([source_1, source_2], ignore_index=True).value_counts()
    top_sources = [str(value) for value in participation.head(5).index]

    first_is_lower = source_1 <= source_2
    route_frame = pd.DataFrame(
        {
            "left": source_1.where(first_is_lower, source_2),
            "right": source_2.where(first_is_lower, source_1),
        }
    )
    route_counts = route_frame.value_counts().to_dict()
    matrix = []
    displayed_route_counts = []
    for row_index, row_source in enumerate(top_sources):
        matrix_row = []
        for column_index, column_source in enumerate(top_sources):
            if column_index < row_index:
                matrix_row.append(None)
                continue
            route_key = tuple(sorted((row_source, column_source)))
            value = int(route_counts.get(route_key, 0))
            matrix_row.append(value)
            displayed_route_counts.append((row_source, column_source, value))
        matrix.append(matrix_row)

    matrix_pair_count = sum(value for _, _, value in displayed_route_counts)
    top_route = max(displayed_route_counts, key=lambda item: item[2], default=None)
    weak_candidates = next(
        (row["value"] for row in confidence_tiers if row["key"] == "weak"),
        0,
    )
    resolved_records = input_records - singletons
    try:
        left_clusters = (
            candidate_pairs["record_id_1"]
            .astype(str)
            .str.strip()
            .map(record_to_cluster)
        )
        right_clusters = (
            candidate_pairs["record_id_2"]
            .astype(str)
            .str.strip()
            .map(record_to_cluster)
        )
        if not bool(left_clusters.notna().all() and right_clusters.notna().all()):
            raise ValueError(
                "Candidate-pair records do not all map to clustered-record membership."
            )
        in_profile_pair = (
            (left_clusters == right_clusters)
            & left_clusters.isin(multi_cluster_ids)
        )
        exact_pair = (
            candidate_pairs["_tier"]
            .eq("exact")
        )
        profiles_with_exact_matches = len(
            set(left_clusters[in_profile_pair & exact_pair].astype(str))
        )
        if profiles_with_exact_matches > multi_clusters:
            raise ValueError(
                "Profiles with exact matches exceed the multi-record profile count."
            )

        profile_match_fields = pd.DataFrame(
            {
                "cluster_id": left_clusters[in_profile_pair].astype(str),
                "matched_fields": (
                    candidate_pairs.loc[in_profile_pair, "matched_fields"]
                    .astype(str)
                    .str.lower()
                ),
            }
        )
        email_profiles = set(
            profile_match_fields.loc[
                profile_match_fields["matched_fields"].str.contains(
                    r"(?:^|\|)email(?:\(|\||$)",
                    regex=True,
                    na=False,
                ),
                "cluster_id",
            ]
        )
        phone_profiles = set(
            profile_match_fields.loc[
                profile_match_fields["matched_fields"].str.contains(
                    r"(?:^|\|)phone(?:\(|\||$)",
                    regex=True,
                    na=False,
                ),
                "cluster_id",
            ]
        ) - email_profiles
        profiles_with_matched_fields = set(
            profile_match_fields.loc[
                profile_match_fields["matched_fields"].str.strip() != "",
                "cluster_id",
            ]
        )
        additional_profiles = (
            profiles_with_matched_fields
            - email_profiles
            - phone_profiles
        )
        unclassified_profiles = (
            multi_cluster_ids
            - email_profiles
            - phone_profiles
            - additional_profiles
        )
        identifier_rows = [
            {
                "key": "email",
                "label": "Email",
                "value": len(email_profiles),
            },
            {
                "key": "phone",
                "label": "Phone",
                "value": len(phone_profiles),
            },
            {
                "key": "additional",
                "label": "Additional identifiers",
                "value": len(additional_profiles),
            },
        ]
        identifier_rows = [
            row for row in identifier_rows if row["value"] > 0
        ]
        if unclassified_profiles:
            identifier_rows.append(
                {
                    "key": "unclassified",
                    "label": "Identifier evidence not classified",
                    "value": len(unclassified_profiles),
                }
            )
        if sum(row["value"] for row in identifier_rows) != multi_clusters:
            raise ValueError(
                "In-cluster identifier-evidence counts do not reconcile to "
                "multi-record profiles."
            )
        identifier_resolution = {
            "data_available": True,
            "reason": None,
            "evidence_priority": ["email", "phone", "additional"],
            "rows": identifier_rows,
        }
    except Exception as exc:
        return _identity_unavailable(
            source,
            f"Profile-grain match evidence could not be reconciled: {exc}",
        )

    payload = {
        "source_system": source,
        "data_available": True,
        "artifact_signature": str(hash(signature)),
        "summary": {
            "input_records": input_records,
            "total_clusters": total_clusters,
            "multi_record_clusters": multi_clusters,
            "singletons": singletons,
            "profiles_with_exact_matches": profiles_with_exact_matches,
            "largest_cluster": largest_cluster,
            "resolved_records": resolved_records,
            "identity_coverage_pct": round(
                resolved_records / input_records * 100, 4
            ) if input_records else None,
            "multi_record_cluster_pct": round(
                multi_clusters / total_clusters * 100, 4
            ) if total_clusters else None,
            "candidate_pairs": pair_count,
            "same_source_pairs": same_source_pairs,
            "cross_source_pairs": cross_source_pairs,
            "average_records_per_identity": round(
                resolved_records / multi_clusters, 4
            ) if multi_clusters else None,
            "average_match_confidence_pct": average_match_confidence_pct,
            "average_match_confidence_note": confidence_measure_note,
            "cluster_summary_reconciles": cluster_summary_reconciles,
            "cluster_summary_note": (
                None if cluster_summary_reconciles else summary_issue
            ),
            "repeated_record_rows": repeated_record_rows,
        },
        "cluster_depth": depth_rows,
        "confidence_tiers": confidence_tiers,
        "identity_records_by_source": identity_records_by_source,
        "source_linkage": {
            "headers": [
                {
                    "key": feed,
                    "label": _identity_feed_label(feed),
                    "participation": int(participation.get(feed, 0)),
                }
                for feed in top_sources
            ],
            "matrix": matrix,
            "represented_pairs": matrix_pair_count,
            "coverage_pct": round(
                matrix_pair_count / pair_count * 100, 4
            ) if pair_count else None,
            "top_route": (
                {
                    "label": (
                        f"{_identity_feed_label(top_route[0])} ↔ "
                        f"{_identity_feed_label(top_route[1])}"
                    ),
                    "value": top_route[2],
                }
                if top_route
                else None
            ),
        },
        "review": {
            "weak_candidates": weak_candidates,
            "pending": None,
            "accepted": None,
            "rejected": None,
        },
        "weak_match_explanation": (
            (
                f"Weak matches represent {weak_candidates / pair_count * 100:.1f}% "
                "of current candidate pairs. These pairs satisfy only the "
                "low-strength identifier evidence published in matched_fields "
                "and should be reviewed before threshold changes are made."
            )
            if pair_count and weak_candidates
            else None
        ),
        "identifier_resolution": identifier_resolution,
        "explain_report": {
            "summary": (
                "Cluster measures come from current row-level clustered membership. "
                "Profile-grain exact matches and identifier evidence reconcile candidate "
                "pairs to final clustered membership. Identity-record source counts come "
                "from every clustered input row. Confidence and feed-linkage measures are "
                "aggregated from every row in the same source candidate-pair artifact. "
                + (
                    "The cluster summary reconciles to that membership."
                    if cluster_summary_reconciles
                    else f"The optional cluster summary is diagnostic only: {summary_issue}"
                )
            ),
            "sources": [
                str(cluster_path.relative_to(ROOT)),
                str(clustered_records_path.relative_to(ROOT)),
                str(candidate_path.relative_to(ROOT)),
            ],
            "decision_note": (
                "Pending, accepted, and rejected remain unavailable until thresholds "
                "and reviewer outcomes are persisted."
            ),
        },
    }
    if not uc_enabled():
        _IDENTITY_REPORT_CACHE[source] = {"signature": signature, "payload": payload}
    return payload


def _build_identity_graph_report(source):
    source = normalize_source_system(source, "media")

    def load_report():
        snapshot = _read_source_report_snapshot(
            "identity-report",
            source,
            _IDENTITY_REPORT_REVISION,
        )
        if snapshot is not None:
            return snapshot
        payload = _compute_identity_graph_report(source)
        _write_source_report_snapshot(
            "identity-report",
            source,
            _IDENTITY_REPORT_REVISION,
            payload,
        )
        return payload

    return _cached_source_report(
        "identity-report",
        source,
        _IDENTITY_REPORT_REVISION,
        load_report,
        "CODEX_IDENTITY_REPORT_CACHE_SECONDS",
    )


@app.get("/api/reporting/identity-graph")
def identity_graph_report():
    source = normalize_source_system(
        request.args.get("source") or request.args.get("source_system"),
        "media",
    )
    return jsonify(_build_identity_graph_report(source))


def _identity_mask_email(value):
    text = str(value or "").strip()
    if not text or "@" not in text:
        return None
    local, domain = text.rsplit("@", 1)
    if not local or not domain:
        return None
    return f"{local[:1]}***@{domain}"


def _identity_mask_phone(value):
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits:
        return None
    return f"•••• {digits[-4:]}" if len(digits) > 4 else digits


def _identity_display_name(row):
    full_name = str(row.get("full_name") or "").strip()
    if full_name:
        return full_name
    first_name = str(row.get("first_name") or "").strip()
    last_name = str(row.get("last_name") or "").strip()
    combined = " ".join(value for value in (first_name, last_name) if value)
    if combined:
        return combined
    profile_name = str(row.get("profile_name") or "").strip()
    return profile_name or None


@app.get("/api/reporting/identity-graph/single-record-profiles")
def identity_graph_single_record_profiles():
    source = normalize_source_system(
        request.args.get("source") or request.args.get("source_system"),
        "media",
    )
    try:
        page = max(int(request.args.get("page", 1)), 1)
        page_size = min(max(int(request.args.get("page_size", 25)), 1), 100)
    except (TypeError, ValueError):
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": "Page and page size must be positive integers.",
            }
        ), 400

    report = _build_identity_graph_report(source)
    if not report.get("data_available"):
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": report.get("error") or "Identity reporting is unavailable.",
            }
        ), 404

    clustered_records_path = (
        LEGACY_ROOT / "clustering_output" / source / "clustered_records.csv"
    )
    if not clustered_records_path.exists():
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": "Clustered-record membership is unavailable.",
            }
        ), 404

    try:
        available_columns = set(
            pd.read_csv(clustered_records_path, nrows=0).columns.astype(str)
        )
        required_columns = {"record_id", "cluster_id", "source_file"}
        if not required_columns.issubset(available_columns):
            return jsonify(
                {
                    "source_system": source,
                    "data_available": False,
                    "error": (
                        "The clustered-record artifact does not contain the "
                        "record, profile, and source columns required for drill-down."
                    ),
                }
            ), 404

        optional_columns = {
            "full_name",
            "first_name",
            "last_name",
            "profile_name",
            "email",
            "phone",
        }
        selected_columns = list(
            required_columns | (optional_columns & available_columns)
        )
        records = pd.read_csv(
            clustered_records_path,
            usecols=selected_columns,
            dtype=str,
            low_memory=False,
        ).fillna("")
        records["record_id"] = records["record_id"].astype(str).str.strip()
        records["cluster_id"] = records["cluster_id"].astype(str).str.strip()
        if bool(
            ((records["record_id"] == "") | (records["cluster_id"] == "")).any()
        ):
            raise ValueError(
                "Clustered records contain blank record or profile identifiers."
            )

        profile_sizes = records["cluster_id"].value_counts()
        singleton_ids = set(str(value) for value in profile_sizes[profile_sizes == 1].index)
        single_records = records[records["cluster_id"].isin(singleton_ids)].copy()
        expected_total = int(report["summary"]["singletons"])
        if len(single_records) != expected_total:
            raise ValueError(
                "Single-record profile rows do not reconcile to the report summary."
            )

        single_records = single_records.sort_values(
            by=["cluster_id", "record_id"],
            kind="stable",
        )
        total_pages = max((expected_total + page_size - 1) // page_size, 1)
        if page > total_pages:
            page = total_pages
        start = (page - 1) * page_size
        page_records = single_records.iloc[start:start + page_size]
        rows = []
        for _, record in page_records.iterrows():
            row = record.to_dict()
            rows.append(
                {
                    "profile_id": str(row.get("cluster_id") or ""),
                    "record_id": str(row.get("record_id") or ""),
                    "customer_name": _identity_display_name(row),
                    "email": _identity_mask_email(row.get("email")),
                    "phone": _identity_mask_phone(row.get("phone")),
                    "source": _identity_feed_label(row.get("source_file")),
                }
            )

        return jsonify(
            {
                "source_system": source,
                "data_available": True,
                "total": expected_total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "rows": rows,
                "privacy_note": (
                    "Email and phone values are masked in reporting drill-downs."
                ),
            }
        )
    except Exception as exc:
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": f"Single-record profile drill-down is unavailable: {exc}",
            }
        ), 500


def _identity_clean_profile_value(value):
    text = str(value or "").strip()
    if text.lower() in {"", "nan", "none", "null", "n/a", "na"}:
        return ""
    return text


def _identity_profile_values(rows, columns, split_collections=False):
    values = []
    for row in rows:
        for column in columns:
            value = _identity_clean_profile_value(row.get(column))
            if not value:
                continue
            candidates = value.split("|") if split_collections else [value]
            for candidate in candidates:
                candidate = _identity_clean_profile_value(candidate)
                if candidate and candidate not in values:
                    values.append(candidate)
    return values


def _identity_profile_drilldown_payload(
    source,
    profile_type,
    page,
    page_size,
    source_table="",
):
    """Return one source-backed row per resolved customer profile.

    Profile membership and counts come exclusively from the clustered-record
    artifact. The golden-record artifact is used only to enrich multi-record
    profile rows with attributes already resolved for that same cluster.
    """
    report = _build_identity_graph_report(source)
    if not report.get("data_available"):
        raise FileNotFoundError(
            report.get("error") or "Identity reporting is unavailable."
        )

    clustered_records_path = (
        LEGACY_ROOT / "clustering_output" / source / "clustered_records.csv"
    )
    if not clustered_records_path.exists():
        raise FileNotFoundError("Clustered-record membership is unavailable.")

    available_columns = set(
        pd.read_csv(clustered_records_path, nrows=0).columns.astype(str)
    )
    required_columns = {"record_id", "cluster_id", "source_file"}
    if not required_columns.issubset(available_columns):
        raise ValueError(
            "The clustered-record artifact does not contain the record, "
            "profile, and source columns required for drill-down."
        )

    optional_columns = {
        "full_name",
        "first_name",
        "last_name",
        "profile_name",
        "email",
        "phone",
    }
    records = pd.read_csv(
        clustered_records_path,
        usecols=list(required_columns | (optional_columns & available_columns)),
        dtype=str,
        low_memory=False,
    ).fillna("")
    records["record_id"] = records["record_id"].astype(str).str.strip()
    records["cluster_id"] = records["cluster_id"].astype(str).str.strip()
    records["_source_table"] = records["source_file"].map(
        lambda value: Path(str(value or "unknown")).name
    )
    if bool(
        ((records["record_id"] == "") | (records["cluster_id"] == "")).any()
    ):
        raise ValueError(
            "Clustered records contain blank record or profile identifiers."
        )

    profile_sizes = records["cluster_id"].value_counts()
    if profile_type == "multi":
        selected_sizes = profile_sizes[profile_sizes > 1]
        expected_total = int(report["summary"]["multi_record_clusters"])
    else:
        selected_sizes = profile_sizes[profile_sizes == 1]
        expected_total = int(report["summary"]["singletons"])
    if len(selected_sizes) != expected_total:
        raise ValueError(
            f"{profile_type.title()}-record profile rows do not reconcile "
            "to the report summary."
        )

    eligible_records = records[
        records["cluster_id"].isin(selected_sizes.index)
    ].copy()
    table_breakdown = [
        {
            "source_table": table,
            "source_label": _identity_feed_label(table),
            "profile_count": int(profile_count),
        }
        for table, profile_count in (
            eligible_records.groupby("_source_table")["cluster_id"]
            .nunique()
            .sort_values(ascending=False)
            .items()
        )
    ]
    source_table = Path(str(source_table or "").strip()).name
    if source_table:
        matching_profile_ids = set(
            eligible_records.loc[
                eligible_records["_source_table"].str.lower()
                == source_table.lower(),
                "cluster_id",
            ].astype(str)
        )
        selected_sizes = selected_sizes[
            selected_sizes.index.astype(str).isin(matching_profile_ids)
        ]

    profile_ids = sorted(str(value) for value in selected_sizes.index)
    filtered_total = len(profile_ids)
    total_pages = max((filtered_total + page_size - 1) // page_size, 1)
    page = min(page, total_pages)
    start = (page - 1) * page_size
    page_profile_ids = profile_ids[start:start + page_size]
    page_records = records[records["cluster_id"].isin(page_profile_ids)].copy()

    golden_by_cluster = {}
    golden_records_path = (
        LEGACY_ROOT / "golden_records_output" / source / "golden_records.csv"
    )
    if golden_records_path.exists():
        golden_columns = set(
            pd.read_csv(golden_records_path, nrows=0).columns.astype(str)
        )
        selected_golden_columns = {
            "cluster_id",
            "golden_id",
            "full_name",
            "first_name",
            "last_name",
            "profile_name",
            "email",
            "phone",
            "all_names",
            "all_emails",
            "all_phones",
        } & golden_columns
        if "cluster_id" in selected_golden_columns:
            golden_rows = pd.read_csv(
                golden_records_path,
                usecols=list(selected_golden_columns),
                dtype=str,
                low_memory=False,
            ).fillna("")
            golden_rows["cluster_id"] = (
                golden_rows["cluster_id"].astype(str).str.strip()
            )
            golden_rows = golden_rows[
                golden_rows["cluster_id"].isin(page_profile_ids)
            ].drop_duplicates(subset=["cluster_id"], keep="first")
            golden_by_cluster = {
                str(row["cluster_id"]): row
                for row in golden_rows.to_dict(orient="records")
            }

    rows = []
    for cluster_id in page_profile_ids:
        member_rows = page_records[
            page_records["cluster_id"] == cluster_id
        ].to_dict(orient="records")
        golden_row = golden_by_cluster.get(cluster_id, {})
        attribute_rows = [golden_row, *member_rows]

        names = _identity_profile_values(
            attribute_rows,
            ("full_name", "profile_name", "all_names"),
            split_collections=True,
        )
        if not names:
            first_names = _identity_profile_values(
                attribute_rows, ("first_name",)
            )
            last_names = _identity_profile_values(
                attribute_rows, ("last_name",)
            )
            combined_name = " ".join(
                value for value in (
                    first_names[0] if first_names else "",
                    last_names[0] if last_names else "",
                )
                if value
            ).strip()
            if combined_name:
                names = [combined_name]

        email = next(
            (
                masked
                for value in _identity_profile_values(
                    attribute_rows,
                    ("email", "all_emails"),
                    split_collections=True,
                )
                if (masked := _identity_mask_email(value))
            ),
            None,
        )
        phone = next(
            (
                masked
                for value in _identity_profile_values(
                    attribute_rows,
                    ("phone", "all_phones"),
                    split_collections=True,
                )
                if (masked := _identity_mask_phone(value))
            ),
            None,
        )
        source_labels = sorted(
            {
                _identity_feed_label(row.get("source_file"))
                for row in member_rows
                if _identity_clean_profile_value(row.get("source_file"))
            }
        )
        fallback_name = (
            f"{source_labels[0]} source record"
            if len(source_labels) == 1
            else "Multi-source customer profile"
        )
        golden_id = _identity_clean_profile_value(golden_row.get("golden_id"))
        rows.append(
            {
                "profile_id": golden_id or cluster_id,
                "cluster_id": cluster_id,
                "record_id": (
                    _identity_clean_profile_value(member_rows[0].get("record_id"))
                    if profile_type == "single" and member_rows
                    else None
                ),
                "record_count": int(selected_sizes.loc[cluster_id]),
                "customer_name": names[0] if names else fallback_name,
                "email": email,
                "phone": phone,
                "source": " · ".join(source_labels),
                "has_name": bool(names),
            }
        )

    return {
        "source_system": source,
        "data_available": True,
        "profile_type": profile_type,
        "total": filtered_total,
        "overall_total": expected_total,
        "source_table": source_table or None,
        "table_breakdown": table_breakdown,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "rows": rows,
        "privacy_note": (
            "Email and phone values are masked. A dash means the governed "
            "profile and its clustered source records do not publish that attribute."
        ),
    }


@app.get("/api/reporting/identity-graph/profiles")
def identity_graph_profiles():
    source = normalize_source_system(
        request.args.get("source") or request.args.get("source_system"),
        "media",
    )
    profile_type = str(request.args.get("profile_type") or "single").strip().lower()
    source_table = str(request.args.get("source_table") or "").strip()
    if profile_type not in {"multi", "single"}:
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": "Profile type must be either multi or single.",
            }
        ), 400
    try:
        page = max(int(request.args.get("page", 1)), 1)
        page_size = min(max(int(request.args.get("page_size", 25)), 1), 100)
    except (TypeError, ValueError):
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": "Page and page size must be positive integers.",
            }
        ), 400

    try:
        return jsonify(
            _identity_profile_drilldown_payload(
                source,
                profile_type,
                page,
                page_size,
                source_table,
            )
        )
    except FileNotFoundError as exc:
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": str(exc),
            }
        ), 404
    except Exception as exc:
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": (
                    f"{profile_type.title()}-record profile drill-down "
                    f"is unavailable: {exc}"
                ),
            }
        ), 500


def _profile_depth_rows(values, source):
    numeric = pd.to_numeric(values, errors="coerce").fillna(0).astype(int)
    if source == "sports":
        bands = [
            ("1", numeric == 1),
            ("2-5", numeric.between(2, 5)),
            ("6-10", numeric.between(6, 10)),
            ("11-25", numeric.between(11, 25)),
            ("26-50", numeric.between(26, 50)),
            ("51-100", numeric.between(51, 100)),
            ("100+", numeric > 100),
        ]
    elif source == "automotive":
        bands = [
            ("17", numeric == 17),
            ("25", numeric == 25),
            ("26-30", numeric.between(26, 30)),
            ("31-35", numeric.between(31, 35)),
            ("36-40", numeric.between(36, 40)),
            ("41-46", numeric.between(41, 46)),
        ]
    else:
        bands = [
            ("1", numeric == 1),
            ("2", numeric == 2),
            ("3", numeric == 3),
            ("4", numeric == 4),
            ("5", numeric == 5),
            ("6-10", numeric.between(6, 10)),
            ("11-25", numeric.between(11, 25)),
            ("26-50", numeric.between(26, 50)),
            ("51-100", numeric.between(51, 100)),
            ("100+", numeric > 100),
        ]

    rows = [
        {"label": label, "value": int(mask.sum())}
        for label, mask in bands
        if int(mask.sum()) > 0
    ]
    measured_profiles = int((numeric > 0).sum())
    if sum(row["value"] for row in rows) == measured_profiles:
        return rows

    fallback_bands = [
        ("1", numeric == 1),
        ("2-5", numeric.between(2, 5)),
        ("6-10", numeric.between(6, 10)),
        ("11-25", numeric.between(11, 25)),
        ("26-50", numeric.between(26, 50)),
        ("51-100", numeric.between(51, 100)),
        ("100+", numeric > 100),
    ]
    return [
        {"label": label, "value": int(mask.sum())}
        for label, mask in fallback_bands
        if int(mask.sum()) > 0
    ]


def _profile_coverage_rows(golden, source):
    field_groups = {
        "media": [
            ("Email", ["email"]),
            ("Name", ["full_name", "first_name", "last_name"]),
            ("Phone", ["phone"]),
            ("Address", ["address"]),
        ],
        "sports": [
            (
                "Sports Account ID",
                [
                    "account_id",
                    "fan_account_id",
                    "ticketing_account_id",
                    "loyalty_member_id",
                    "commerce_customer_id",
                    "streaming_account_id",
                    "fantasy_account_id",
                    "oauth_user_id",
                    "authenticated_user_id",
                    "resolved_profile_id",
                    "username",
                ],
            ),
            ("Email", ["email"]),
            ("Device", ["device_id"]),
            ("First or last name", ["first_name", "last_name", "full_name"]),
        ],
        "automotive": [
            ("Name", ["full_name", "first_name", "last_name"]),
            ("Address", ["address"]),
            ("Customer ID", ["customer_id"]),
            ("Device ID", ["device_id"]),
        ],
    }.get(source, [])

    total = int(len(golden))
    rows = []
    for label, fields in field_groups:
        present = pd.Series(False, index=golden.index)
        available_fields = [field for field in fields if field in golden.columns]
        for field in available_fields:
            values = golden[field]
            present |= values.notna() & values.astype(str).str.strip().ne("")
        count = int(present.sum())
        rows.append(
            {
                "label": label,
                "value": count,
                "pct": round(count / total * 100, 1) if total else None,
            }
        )
    return rows


def _friendly_profile_source_label(value):
    """Return a business-readable label for a governed source artifact."""
    filename = Path(str(value or "")).name
    stem = re.sub(r"\.csv$", "", filename, flags=re.IGNORECASE)
    stem = re.sub(r"^(aut|auto|med|spt|tel)[_-]+", "", stem, flags=re.IGNORECASE)
    overrides = {
        "app_events": "App Events",
        "commerce_orders": "Commerce Orders",
        "customer_support": "Customer Support",
        "email_engagement": "Email Engagement",
        "fan_accounts": "Fan Accounts",
        "fantasy_gaming_accounts": "Fantasy Gaming",
        "loyalty_members": "Loyalty Membership",
        "ott_streaming_sessions": "Streaming Sessions",
        "subscription_billing": "Subscription Billing",
        "ticket_orders": "Ticket Orders",
    }
    normalized = stem.lower()
    return overrides.get(
        normalized,
        re.sub(r"[_-]+", " ", stem).strip().title() or "Governed Source",
    )


def _profile_source_contribution_rows(source_files, total_profiles):
    """Count profiles represented by each governed contributing source."""
    if source_files.empty or total_profiles <= 0:
        return []

    counts = {}
    for value in source_files:
        represented = {
            item.strip()
            for item in str(value or "").split("|")
            if item.strip()
        }
        for artifact in represented:
            counts[artifact] = counts.get(artifact, 0) + 1

    rows = [
        {
            "label": _friendly_profile_source_label(artifact),
            "source_artifact": Path(artifact).name,
            "count": int(count),
            "pct": round(count / total_profiles * 100, 1),
        }
        for artifact, count in counts.items()
    ]
    rows.sort(key=lambda row: (-row["count"], row["label"]))
    return rows


def _profile_breadth_rows(values, source):
    counts = values.fillna("").astype(str).map(
        lambda value: len({item.strip() for item in value.split("|") if item.strip()})
    )
    if source == "automotive":
        bands = [
            ("1-10 sources", counts.between(1, 10)),
            ("11-13 sources", counts.between(11, 13)),
            ("14-16 sources", counts.between(14, 16)),
            ("17-20 sources", counts.between(17, 20)),
            ("21+ sources", counts >= 21),
        ]
        return [{"label": label, "value": int(mask.sum())} for label, mask in bands if int(mask.sum()) > 0]

    distribution = counts.value_counts().sort_index()
    return [
        {
            "label": f"{int(count)} source" if int(count) == 1 else f"{int(count)} sources",
            "value": int(value),
        }
        for count, value in distribution.items()
        if int(count) > 0
    ]


def _profile_activity_date_columns(source):
    return {
        "media": [
            "event_timestamp",
            "session_start",
            "session_end",
            "send_date",
            "open_date",
            "click_date",
        ],
        "sports": [
            "event_timestamp",
            "session_start",
            "session_end",
            "order_date",
            "send_date",
            "open_date",
            "click_date",
            "last_activity_date",
        ],
        "automotive": [
            "event_date",
            "order_date",
            "open_date",
            "opened_date",
            "appointment_date",
            "service_date",
        ],
        "telecom": [
            "event_timestamp",
            "session_start",
            "session_end",
            "order_date",
            "open_date",
            "click_date",
            "last_activity_date",
        ],
    }.get(source, [])


def _profile_activity_context(clustered, golden_cluster_ids, source):
    """Return the canonical profile activity summary and its profile evidence.

    The customer-profile KPI and its record-level drill-down both consume this
    context so the 30-day window, active membership, and freshness flag cannot
    drift between the two API contracts.
    """
    date_columns = _profile_activity_date_columns(source)
    parsed = {
        column: pd.to_datetime(clustered[column], errors="coerce")
        for column in date_columns
        if column in clustered.columns
    }
    if "cluster_id" not in clustered.columns:
        parsed = {}

    activity_row_mask = pd.Series(False, index=clustered.index)
    for values in parsed.values():
        activity_row_mask |= values.notna()
    if "cluster_id" in clustered.columns:
        activity_row_mask &= clustered["cluster_id"].astype(str).isin(golden_cluster_ids)
    interaction_records = int(activity_row_mask.sum())
    valid_maxima = [values.max() for values in parsed.values() if values.notna().any()]
    if not valid_maxima:
        return {
            "summary": {
                "active_profiles": None,
                "inactive_profiles": None,
                "active_pct": None,
                "inactive_pct": None,
                "activity_window": None,
                "activity_as_of": None,
                "activity_current": False,
                "activity_age_days": None,
                "interaction_records": interaction_records,
                "activity_fields": list(parsed.keys()),
            },
            "active_cluster_ids": set(),
            "latest_activity_by_cluster": {},
        }

    as_of = max(valid_maxima)
    start = as_of - pd.Timedelta(days=29)
    active_clusters = set()
    for values in parsed.values():
        mask = values.between(start, as_of, inclusive="both")
        active_clusters.update(
            clustered.loc[mask, "cluster_id"].dropna().astype(str).tolist()
        )
    active_clusters = active_clusters.intersection(golden_cluster_ids)

    parsed_frame = pd.DataFrame(parsed, index=clustered.index)
    latest_per_row = parsed_frame.max(axis=1)
    cluster_ids = clustered["cluster_id"].fillna("").astype(str).str.strip()
    latest_by_cluster = (
        latest_per_row.groupby(cluster_ids, sort=False)
        .max()
        .dropna()
    )
    latest_activity_by_cluster = {
        str(cluster_id): timestamp
        for cluster_id, timestamp in latest_by_cluster.items()
        if str(cluster_id) in golden_cluster_ids
    }

    active = len(active_clusters)
    total = len(golden_cluster_ids)
    inactive = max(total - active, 0)
    activity_age_days = int((pd.Timestamp.now().normalize() - as_of.normalize()).days)
    activity_current = 0 <= activity_age_days <= 45
    return {
        "summary": {
            "active_profiles": int(active),
            "inactive_profiles": int(inactive),
            "active_pct": round(active / total * 100, 1) if total else None,
            "inactive_pct": round(inactive / total * 100, 1) if total else None,
            "activity_window": f"{start.date().isoformat()} to {as_of.date().isoformat()}",
            "activity_as_of": as_of.date().isoformat(),
            "activity_current": activity_current,
            "activity_age_days": activity_age_days,
            "interaction_records": interaction_records,
            "activity_fields": list(parsed.keys()),
        },
        "active_cluster_ids": active_clusters,
        "latest_activity_by_cluster": latest_activity_by_cluster,
    }


def _profile_activity(clustered, golden_cluster_ids, source):
    return _profile_activity_context(
        clustered,
        golden_cluster_ids,
        source,
    )["summary"]


_AUTOMOTIVE_PROFILE_EVENT_SOURCE_PATTERNS = (
    "aut_campaign_interactions",
    "aut_dtc_events",
    "aut_loyalty_transactions",
    "aut_mobile_app_sessions",
    "aut_nps_surveys",
    "aut_sales_transactions",
    "aut_service_appointments",
    "aut_service_line_items",
    "aut_service_orders",
    "aut_support_cases",
    "aut_telematics_monthly_summary",
    "aut_vehicle_health_reports",
    "aut_warranty_claims",
    "aut_website_sessions",
)


def _profile_event_type_distribution(
    clustered,
    golden_cluster_ids,
    source,
    sports_event_path=None,
):
    """Count governed, typed customer-event rows linked to current profiles.

    Each source event is counted at most once and must have both an explicit
    categorical type and a supported event timestamp. Sports types are restored
    from the raw campaign-event artifact through a one-to-one record-ID join
    because the clustered conversion_event_type column contains timestamps.
    """
    unavailable = {
        "total": None,
        "rows": [],
        "fields": [],
        "grain": None,
        "scope": None,
    }
    if clustered.empty or "cluster_id" not in clustered.columns:
        return unavailable

    scoped = clustered[
        clustered["cluster_id"].fillna("").astype(str).isin(golden_cluster_ids)
    ].copy()
    missing_tokens = {"", "nan", "none", "null", "n/a", "na"}

    if source == "sports":
        required_clustered = {"record_id", "source_file"}
        if (
            sports_event_path is None
            or not sports_event_path.exists()
            or not required_clustered.issubset(scoped.columns)
        ):
            return unavailable
        try:
            raw_events = pd.read_csv(
                sports_event_path,
                usecols=[
                    "campaign_event_id",
                    "conversion_event_type",
                    "converted_at",
                ],
                low_memory=False,
            )
        except Exception:
            return unavailable

        raw_events["campaign_event_id"] = (
            raw_events["campaign_event_id"].fillna("").astype(str).str.strip()
        )
        raw_events["conversion_event_type"] = (
            raw_events["conversion_event_type"].fillna("").astype(str).str.strip()
        )
        raw_type_valid = ~raw_events["conversion_event_type"].str.lower().isin(
            missing_tokens
        )
        raw_time_valid = pd.to_datetime(
            raw_events["converted_at"],
            errors="coerce",
        ).notna()
        raw_typed = raw_events[
            raw_type_valid
            & raw_time_valid
            & raw_events["campaign_event_id"].ne("")
        ][["campaign_event_id", "conversion_event_type"]].copy()

        source_file_keys = (
            scoped["source_file"]
            .fillna("")
            .astype(str)
            .str.replace("\\\\", "/", regex=False)
            .str.rsplit("/", n=1)
            .str[-1]
            .str.replace(r"\.csv$", "", regex=True)
            .str.lower()
        )
        linked_campaign_rows = scoped[
            source_file_keys.eq(sports_event_path.stem.lower())
        ][["record_id"]].copy()
        linked_campaign_rows["record_id"] = (
            linked_campaign_rows["record_id"].fillna("").astype(str).str.strip()
        )
        linked_campaign_rows = linked_campaign_rows[
            linked_campaign_rows["record_id"].ne("")
        ]
        if (
            raw_typed.empty
            or raw_typed["campaign_event_id"].duplicated().any()
            or linked_campaign_rows["record_id"].duplicated().any()
        ):
            return unavailable
        try:
            typed_rows = linked_campaign_rows.merge(
                raw_typed,
                left_on="record_id",
                right_on="campaign_event_id",
                how="inner",
                validate="one_to_one",
            )
        except Exception:
            return unavailable
        event_types = typed_rows["conversion_event_type"]
        fields = [
            f"{sports_event_path.name} \u00b7 conversion_event_type",
            f"{sports_event_path.name} \u00b7 converted_at",
        ]
        grain = (
            "One raw Sports campaign conversion event joined one-to-one by "
            "record ID to a current resolved profile"
        )
        scope = "Typed Sports campaign conversion events"
    else:
        if source == "automotive":
            if "source_file" not in scoped.columns:
                return unavailable
            source_names = (
                scoped["source_file"]
                .fillna("")
                .astype(str)
                .str.replace("\\", "/", regex=False)
                .str.rsplit("/", n=1)
                .str[-1]
                .str.replace(r"\.csv$", "", regex=True)
                .str.lower()
            )
            governed_activity = source_names.map(
                lambda name: any(
                    pattern == name or pattern in name
                    for pattern in _AUTOMOTIVE_PROFILE_EVENT_SOURCE_PATTERNS
                )
            )
            scoped = scoped[governed_activity].copy()
            if scoped.empty:
                return unavailable

        candidate_fields = {
            "media": ["event_type"],
            "automotive": [
                "event_type",
                "interaction_type",
                "transaction_type",
                "campaign_type",
                "service_category",
                "contact_type",
            ],
            "telecom": ["event_type"],
        }.get(source, [])
        timestamp_fields = {
            "media": ["event_timestamp"],
            "automotive": [
                "event_date",
                "interaction_date",
                "transaction_date",
                "order_date",
                "click_date",
                "open_date",
                "created_date",
            ],
            "telecom": ["event_timestamp", "event_date", "order_date"],
        }.get(source, [])
        available_fields = [
            field for field in candidate_fields if field in scoped.columns
        ]
        available_timestamps = [
            field for field in timestamp_fields if field in scoped.columns
        ]
        if not available_fields or not available_timestamps:
            return unavailable

        timestamp_valid = pd.Series(False, index=scoped.index)
        for field in available_timestamps:
            timestamp_valid |= pd.to_datetime(
                scoped[field],
                errors="coerce",
            ).notna()

        event_types = pd.Series("", index=scoped.index, dtype=object)
        for field in available_fields:
            values = scoped[field].fillna("").astype(str).str.strip()
            type_valid = ~values.str.lower().isin(missing_tokens)
            if source == "automotive":
                type_valid &= values.str.lower().ne("sent")
            fill = event_types.eq("") & type_valid & timestamp_valid
            event_types.loc[fill] = values.loc[fill]

        event_types = event_types[event_types.ne("")]
        typed_rows = pd.DataFrame({"event_type": event_types})
        if "record_id" in scoped.columns:
            record_ids = (
                scoped.loc[event_types.index, "record_id"]
                .fillna("")
                .astype(str)
                .str.strip()
            )
            source_files = (
                scoped.loc[event_types.index, "source_file"]
                .fillna("")
                .astype(str)
                .str.strip()
                if "source_file" in scoped.columns
                else pd.Series(source, index=event_types.index, dtype=object)
            )
            source_files = source_files.where(source_files.ne(""), source)
            fallback_ids = pd.Series(
                event_types.index.astype(str),
                index=event_types.index,
                dtype=object,
            )
            typed_rows["event_key"] = (
                source_files
                + "|"
                + record_ids.where(record_ids.ne(""), fallback_ids)
            )
            typed_rows = typed_rows.drop_duplicates("event_key", keep="last")
        event_types = typed_rows["event_type"]
        fields = [*available_fields, *available_timestamps]
        grain = (
            "One unique source-file + record-id row with a nonblank governed "
            "event type and supported event timestamp"
        )
        scope = (
            "Explicit Media app events"
            if source == "media"
            else "Automotive customer response events; Sent rows excluded"
            if source == "automotive"
            else "Explicit typed customer events"
        )

    event_types = event_types.map(
        lambda value: re.sub(r"[_-]+", " ", str(value)).strip().title()
    )
    if event_types.empty:
        return unavailable
    counts = event_types.value_counts()
    rows = [
        {
            "label": str(label),
            "value": int(count),
        }
        for label, count in counts.items()
    ]
    rows.sort(key=lambda row: (-row["value"], row["label"]))
    if len(rows) > 8:
        rows = [
            *rows[:7],
            {
                "label": "Other",
                "value": int(sum(row["value"] for row in rows[7:])),
            },
        ]

    return {
        "total": int(len(event_types)),
        "rows": rows,
        "fields": fields,
        "grain": grain,
        "scope": scope,
    }


def _profile_engagement_distribution(clustered, golden_cluster_ids, source):
    """Build a source-backed, profile-grain outreach response distribution.

    The rate is deliberately binary at profile grain: a measured profile is
    engaged when it has at least one supported response in the source outreach
    artifact. Profiles without qualifying outreach evidence are unmeasured,
    rather than being silently classified as disengaged.
    """
    unavailable = {
        "average": None,
        "profile_count": None,
        "engaged_profiles": None,
        "unmeasured_profiles": None,
        "coverage_pct": None,
        "rows": [],
        "formula": None,
        "window": None,
        "as_of": None,
        "current": False,
        "fields": [],
        "grain": None,
        "scope": None,
    }
    if (
        clustered.empty
        or "cluster_id" not in clustered.columns
        or "source_file" not in clustered.columns
    ):
        return unavailable

    source_contract = {
        "media": {
            "artifact": "med_email_engagement.csv",
            "required": {"send_date"},
            "date_fields": ["send_date", "open_date", "click_date"],
            "fields": ["send_date", "opened", "clicked"],
            "scope": "Customer profiles with a valid Media email send",
            "grain": "One resolved customer profile with qualifying email outreach evidence",
        },
        "sports": {
            "artifact": "spt_marketing_campaign_events.csv",
            "required": {"send_date"},
            "date_fields": ["send_date", "open_date", "click_date"],
            "fields": ["send_date", "open_date", "click_date"],
            "scope": "Customer profiles with a valid Sports campaign send",
            "grain": "One resolved customer profile with qualifying campaign outreach evidence",
        },
        "automotive": {
            "artifact": "aut_campaign_interactions.csv",
            "required": set(),
            "date_fields": [],
            "fields": [],
            "scope": "Customer profiles with a valid Automotive campaign interaction",
            "grain": "One resolved customer profile with qualifying campaign interaction evidence",
        },
    }.get(source)
    if not source_contract:
        return unavailable

    # UC-backed preprocessing stores canonical source keys without a local CSV
    # extension. Treat path, filename, and extensionless forms as the same
    # governed artifact for every supported source system.
    source_keys = (
        clustered["source_file"]
        .fillna("")
        .astype(str)
        .str.replace("\\", "/", regex=False)
        .str.rsplit("/", n=1)
        .str[-1]
        .str.lower()
        .str.replace(r"\.csv$", "", regex=True)
    )
    artifact_key = Path(source_contract["artifact"]).stem.lower()
    artifact_mask = source_keys.eq(artifact_key)

    scoped = clustered[
        clustered["cluster_id"].fillna("").astype(str).isin(golden_cluster_ids)
        & artifact_mask
    ].copy()

    if source == "automotive" and not scoped.empty:
        # A migration snapshot can contain canonical and legacy aliases in the
        # same table. Coalesce them per row so a populated canonical column on
        # one row does not hide a legacy value on another row.
        resolved_dates = pd.Series(pd.NaT, index=scoped.index, dtype="datetime64[ns]")
        resolved_types = pd.Series("", index=scoped.index, dtype=object)
        used_date_fields = []
        used_type_fields = []
        for field in ("interaction_date", "order_date"):
            if field not in scoped.columns:
                continue
            parsed = pd.to_datetime(scoped[field], errors="coerce")
            fill = resolved_dates.isna() & parsed.notna()
            if fill.any():
                used_date_fields.append(field)
            resolved_dates.loc[fill] = parsed.loc[fill]
        for field in ("interaction_type", "event_type"):
            if field not in scoped.columns:
                continue
            values = scoped[field].fillna("").astype(str).str.strip()
            populated = values.ne("")
            fill = resolved_types.eq("") & populated
            if fill.any():
                used_type_fields.append(field)
            resolved_types.loc[fill] = values.loc[fill]
        if not used_date_fields or not used_type_fields:
            return unavailable
        scoped["__engagement_date"] = resolved_dates
        scoped["__engagement_type"] = resolved_types
        source_contract = {
            **source_contract,
            "required": {"__engagement_date", "__engagement_type"},
            "date_fields": ["__engagement_date"],
            "fields": [*used_date_fields, *used_type_fields],
        }

    if (
        scoped.empty
        or not source_contract["required"].issubset(scoped.columns)
    ):
        return unavailable

    cluster_ids = scoped["cluster_id"].fillna("").astype(str).str.strip()
    if source == "automotive":
        eligibility_date = scoped["__engagement_date"]
        eligible_mask = cluster_ids.ne("") & eligibility_date.notna()
        scoped = scoped.loc[eligible_mask].copy()
        event_type = (
            scoped["__engagement_type"]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.lower()
        )
        stage = pd.Series(0, index=scoped.index, dtype=int)
        stage.loc[event_type.eq("open")] = 1
        stage.loc[event_type.eq("click")] = 2
        stage.loc[event_type.eq("conversion")] = 3
        stage_contract = [
            ("Converted", 3, "#24d69b"),
            ("Clicked", 2, "#2bd9f0"),
            ("Opened", 1, "#8f7cff"),
            ("Sent / no response", 0, "#4da3ff"),
        ]
        response_definition = (
            "an Open, Click, or Conversion interaction type"
        )
    else:
        eligibility_date = pd.to_datetime(scoped["send_date"], errors="coerce")
        eligible_mask = cluster_ids.ne("") & eligibility_date.notna()
        scoped = scoped.loc[eligible_mask].copy()

        def _truthy(field):
            if field not in scoped.columns:
                return pd.Series(False, index=scoped.index)
            return (
                scoped[field]
                .astype("string")
                .fillna("")
                .str.strip()
                .str.lower()
                .isin({"true", "1", "yes", "y"})
            )

        clicked = _truthy("clicked")
        if "click_date" in scoped.columns:
            clicked |= pd.to_datetime(
                scoped["click_date"], errors="coerce"
            ).notna()
        opened = _truthy("opened")
        if "open_date" in scoped.columns:
            opened |= pd.to_datetime(
                scoped["open_date"], errors="coerce"
            ).notna()

        stage = pd.Series(0, index=scoped.index, dtype=int)
        stage.loc[opened] = 1
        stage.loc[clicked] = 2
        stage_contract = [
            ("Clicked", 2, "#2bd9f0"),
            ("Opened only", 1, "#8f7cff"),
            ("No response", 0, "#4da3ff"),
        ]
        response_definition = "a valid open or click response"

    if scoped.empty:
        return unavailable
    stage.index = scoped.index
    profile_stage = stage.groupby(
        scoped["cluster_id"].fillna("").astype(str).str.strip(),
        sort=False,
    ).max()
    profile_stage = profile_stage[profile_stage.index != ""]
    measured_profiles = int(len(profile_stage))
    if measured_profiles <= 0:
        return unavailable

    rows = [
        {
            "label": label,
            "value": int(profile_stage.eq(stage_value).sum()),
            "color": color,
        }
        for label, stage_value, color in stage_contract
    ]
    rows = [row for row in rows if row["value"] > 0]
    engaged_profiles = int(profile_stage.gt(0).sum())

    parsed_dates = []
    for field in source_contract["date_fields"]:
        if field in scoped.columns:
            parsed = pd.to_datetime(scoped[field], errors="coerce").dropna()
            if not parsed.empty:
                parsed_dates.append(parsed)
    if not parsed_dates:
        return unavailable
    date_values = pd.concat(parsed_dates, ignore_index=True)
    window_start = date_values.min()
    window_end = date_values.max()
    window = (
        f"{window_start.date().isoformat()} to "
        f"{window_end.date().isoformat()}"
    )
    age_days = int(
        (pd.Timestamp.now().normalize() - window_end.normalize()).days
    )
    total_profiles = int(len(golden_cluster_ids))
    return {
        "average": round(
            engaged_profiles / measured_profiles * 100,
            1,
        ),
        "profile_count": measured_profiles,
        "engaged_profiles": engaged_profiles,
        "unmeasured_profiles": max(total_profiles - measured_profiles, 0),
        "coverage_pct": round(
            measured_profiles / total_profiles * 100,
            1,
        ) if total_profiles else None,
        "rows": rows,
        "formula": (
            "Average Engagement Rate = distinct measured customer profiles with "
            f"{response_definition} / distinct customer profiles with qualifying "
            "outreach evidence × 100. Each measured profile contributes once."
        ),
        "window": window,
        "as_of": window_end.date().isoformat(),
        "current": 0 <= age_days <= 45,
        "fields": source_contract["fields"],
        "grain": source_contract["grain"],
        "scope": source_contract["scope"],
    }


def _media_active_mrr_value(clustered, golden_cluster_ids):
    required = {"cluster_id", "source_file", "account_status", "billing_amount"}
    if not required.issubset(clustered.columns):
        return None
    source_keys = (
        clustered["source_file"]
        .fillna("")
        .astype(str)
        .str.replace("\\", "/", regex=False)
        .str.rsplit("/", n=1)
        .str[-1]
        .str.lower()
        .str.replace(r"\.csv$", "", regex=True)
    )
    rows = clustered[
        clustered["cluster_id"].astype(str).isin(golden_cluster_ids)
        & source_keys.eq("med_subscription_billing")
        & clustered["account_status"].astype(str).str.upper().eq("ACTIVE")
    ].copy()
    rows["profile_value"] = pd.to_numeric(rows["billing_amount"], errors="coerce").fillna(0)
    values = rows.groupby("cluster_id")["profile_value"].sum()
    tiers = [
        ("$0", values == 0, "#4da3ff"),
        ("$0.01-$9.99", (values > 0) & (values < 10), "#2bd9f0"),
        ("$10-$19.99", (values >= 10) & (values < 20), "#b493ff"),
        ("$20-$39.99", (values >= 20) & (values < 40), "#ff70d1"),
        ("$40+", values >= 40, "#24d69b"),
    ]
    return {
        "label": "Active MRR",
        "metric_type": "value_proxy",
        "currency": "USD",
        "source": "Active subscription billing rows · billing_amount",
        "total": round(float(values.sum()), 2),
        "coverage": int(len(values)),
        "tiers": [
            {
                "label": label,
                "value": int(mask.sum()),
                "amount": round(float(values[mask].sum()), 2),
                "color": color,
            }
            for label, mask, color in tiers
        ],
    }


def _media_profile_value(
    clustered,
    golden_cluster_ids,
    billing_source_path=None,
    history_path=None,
):
    """Return realized Media LTV, with the existing Active-MRR proxy as fallback."""
    billing_source_path = billing_source_path or (
        LEGACY_ROOT / "generated_data" / "media" / "med_subscription_billing.csv"
    )
    history_path = history_path or (
        LEGACY_ROOT
        / "generated_data"
        / "media"
        / "med_subscription_billing_history.csv"
    )
    required = {"cluster_id", "source_file", "record_id"}
    paths_available = (
        billing_source_path is not None
        and billing_source_path.exists()
        and history_path is not None
        and history_path.exists()
    )
    if not required.issubset(clustered.columns) or not paths_available:
        return _media_active_mrr_value(clustered, golden_cluster_ids)

    source_keys = (
        clustered["source_file"]
        .fillna("")
        .astype(str)
        .str.replace("\\", "/", regex=False)
        .str.rsplit("/", n=1)
        .str[-1]
        .str.lower()
        .str.replace(r"\.csv$", "", regex=True)
    )
    billing_profiles = clustered[
        clustered["cluster_id"].astype(str).isin(golden_cluster_ids)
        & source_keys.eq("med_subscription_billing")
    ][["cluster_id", "record_id"]].copy()
    billing_profiles["subscriber_id"] = (
        billing_profiles["record_id"].fillna("").astype(str).str.strip().str.upper()
    )
    billing_profiles = billing_profiles[
        billing_profiles["subscriber_id"].ne("")
    ].drop_duplicates("subscriber_id", keep="last")
    if billing_profiles.empty:
        return _media_active_mrr_value(clustered, golden_cluster_ids)

    billing_columns = set(
        pd.read_csv(billing_source_path, nrows=0).columns.astype(str)
    )
    if not {"subscriber_id", "account_id"}.issubset(billing_columns):
        return _media_active_mrr_value(clustered, golden_cluster_ids)
    billing_source = pd.read_csv(
        billing_source_path,
        usecols=["subscriber_id", "account_id"],
        low_memory=False,
    )
    for column in ("subscriber_id", "account_id"):
        billing_source[column] = (
            billing_source[column].fillna("").astype(str).str.strip().str.upper()
        )
    billing_source = billing_source[
        billing_source["subscriber_id"].ne("")
        & billing_source["account_id"].ne("")
    ].drop_duplicates("subscriber_id", keep="last")
    billing_profiles = billing_source.merge(
        billing_profiles[["subscriber_id", "cluster_id"]],
        on="subscriber_id",
        how="inner",
        validate="one_to_one",
    )
    if billing_profiles.empty:
        return _media_active_mrr_value(clustered, golden_cluster_ids)

    required_history_columns = {
        "billing_history_id",
        "subscriber_id",
        "account_id",
        "event_type",
        "event_status",
        "currency_code",
        "amount",
    }
    history_columns = set(pd.read_csv(history_path, nrows=0).columns.astype(str))
    if not required_history_columns.issubset(history_columns):
        return _media_active_mrr_value(clustered, golden_cluster_ids)
    history = pd.read_csv(
        history_path,
        usecols=sorted(required_history_columns),
        low_memory=False,
    )
    history["billing_history_id"] = (
        history["billing_history_id"].fillna("").astype(str).str.strip()
    )
    history["subscriber_id"] = (
        history["subscriber_id"].fillna("").astype(str).str.strip().str.upper()
    )
    history["account_id"] = (
        history["account_id"].fillna("").astype(str).str.strip().str.upper()
    )
    history = history[
        history["billing_history_id"].ne("")
        & history["subscriber_id"].ne("")
        & history["account_id"].ne("")
    ].drop_duplicates("billing_history_id", keep="last")
    history = history.merge(
        billing_profiles[["subscriber_id", "account_id", "cluster_id"]],
        on=["subscriber_id", "account_id"],
        how="inner",
        validate="many_to_one",
    )
    if history.empty:
        # Never blend a billing-history table from another Media dataset into
        # the current resolved profile universe.
        return _media_active_mrr_value(clustered, golden_cluster_ids)

    event_type = history["event_type"].fillna("").astype(str).str.strip().str.lower()
    event_status = history["event_status"].fillna("").astype(str).str.strip().str.lower()
    currency = history["currency_code"].fillna("").astype(str).str.strip().str.upper()
    history["realized_value"] = pd.to_numeric(history["amount"], errors="coerce")
    qualifying_event_types = {
        "payment_success",
        "renewal_success",
        "retry_success",
    }
    qualifying_mask = (
        event_type.isin(qualifying_event_types)
        & event_status.eq("success")
        & currency.eq("USD")
        & history["realized_value"].gt(0)
    )
    qualifying = history[qualifying_mask].copy()
    linked_profile_ids = pd.Index(history["cluster_id"].dropna().astype(str).unique())
    values = (
        qualifying.groupby("cluster_id")["realized_value"]
        .sum()
        .reindex(linked_profile_ids, fill_value=0.0)
        .astype(float)
    )
    if values.empty:
        return _media_active_mrr_value(clustered, golden_cluster_ids)

    tiers = [
        ("Low", "$0-$149.99", values < 150, "#4da3ff"),
        ("Medium", "$150-$499.99", (values >= 150) & (values < 500), "#7d8cff"),
        ("High", "$500+", values >= 500, "#24d69b"),
    ]
    source_totals = {
        label.replace("_", " ").title(): round(
            float(
                qualifying.loc[
                    event_type[qualifying.index].eq(label),
                    "realized_value",
                ].sum()
            ),
            2,
        )
        for label in sorted(qualifying_event_types)
    }
    return {
        "label": "Historical Realized Customer Lifetime Value",
        "metric_type": "ltv",
        "currency": "USD",
        "basis": "historical_realized",
        "source": (
            "Media Subscription Billing History · successful payment, renewal, "
            "and retry transactions"
        ),
        "total": round(float(values.sum()), 2),
        "average": round(float(values.mean()), 2),
        "median": round(float(values.median()), 2),
        "coverage": int(len(values)),
        "transaction_count": int(qualifying_mask.sum()),
        "excluded_transaction_count": int(len(history) - qualifying_mask.sum()),
        "source_totals": source_totals,
        "source_fields": [
            "Media Subscription Billing History · amount",
            "Media Subscription Billing History · event type and status",
        ],
        "formula": (
            "Historical realized LTV per customer profile = sum of positive USD "
            "amounts from successful payment_success, renewal_success, and "
            "retry_success events linked by subscriber ID to the resolved profile."
        ),
        "tier_method": "Low: <$150 · Medium: $150-$499.99 · High: $500+",
        "tiers": [
            {
                "label": label,
                "range": value_range,
                "value": int(mask.sum()),
                "amount": round(float(values[mask].sum()), 2),
                "color": color,
            }
            for label, value_range, mask, color in tiers
        ],
    }


def _sports_profile_value(clustered, golden_cluster_ids):
    required = {"cluster_id", "source_file", "record_id"}
    if not required.issubset(clustered.columns):
        return None
    transaction_sources = {
        "spt_ticket_orders",
        "spt_commerce_orders",
    }
    source_keys = (
        clustered["source_file"]
        .fillna("")
        .astype(str)
        .str.replace("\\", "/", regex=False)
        .str.rsplit("/", n=1)
        .str[-1]
        .str.lower()
        .str.replace(r"\.csv$", "", regex=True)
    )
    rows = clustered[
        clustered["cluster_id"].astype(str).isin(golden_cluster_ids)
        & source_keys.isin(transaction_sources)
    ].copy()
    rows["_source_key"] = source_keys.loc[rows.index]
    if rows.empty:
        return None

    # One source transaction contributes at most once, even if an upstream
    # artifact accidentally repeats the same row.
    record_ids = rows["record_id"].fillna("").astype(str).str.strip()
    fallback_ids = pd.Series(rows.index.astype(str), index=rows.index)
    rows["_transaction_key"] = (
        rows["_source_key"].astype(str)
        + "|"
        + record_ids.where(record_ids.ne(""), fallback_ids)
    )
    rows = rows.drop_duplicates("_transaction_key", keep="last")
    rows["realized_value"] = 0.0

    ticket_mask = rows["_source_key"].astype(str).eq("spt_ticket_orders")
    ticket_values = pd.to_numeric(
        rows.get("transaction_amount", pd.Series(index=rows.index, dtype=float)),
        errors="coerce",
    )
    valid_ticket_mask = ticket_mask & ticket_values.gt(0)
    rows.loc[valid_ticket_mask, "realized_value"] = ticket_values[valid_ticket_mask]

    commerce_status = rows.get(
        "order_status_code",
        pd.Series(index=rows.index, dtype=object),
    ).fillna("").astype(str).str.upper().str.strip()
    excluded_statuses = {
        "CANCELLED",
        "RETURNED",
        "REFUNDED",
        "VOIDED",
    }
    commerce_values = pd.to_numeric(
        rows.get("order_total_amount", pd.Series(index=rows.index, dtype=float)),
        errors="coerce",
    )
    commerce_mask = rows["_source_key"].astype(str).eq("spt_commerce_orders")
    valid_commerce_mask = (
        commerce_mask
        & ~commerce_status.isin(excluded_statuses)
        & commerce_values.gt(0)
    )
    rows.loc[valid_commerce_mask, "realized_value"] = commerce_values[valid_commerce_mask]

    qualifying_mask = valid_ticket_mask | valid_commerce_mask
    qualifying = rows[qualifying_mask].copy()
    values = qualifying.groupby("cluster_id")["realized_value"].sum()
    values = values[values > 0]
    if values.empty:
        return None

    lower_threshold = round(float(values.quantile(1 / 3)), 2)
    upper_threshold = round(float(values.quantile(2 / 3)), 2)
    tiers = [
        (
            "Low",
            f"$0.01-${lower_threshold:,.2f}",
            values <= lower_threshold,
            "#4da3ff",
        ),
        (
            "Medium",
            f">${lower_threshold:,.2f}-${upper_threshold:,.2f}",
            (values > lower_threshold) & (values <= upper_threshold),
            "#b493ff",
        ),
        (
            "High",
            f">${upper_threshold:,.2f}",
            values > upper_threshold,
            "#24d69b",
        ),
    ]
    source_totals = {
        "Ticket Orders": round(float(qualifying.loc[valid_ticket_mask, "realized_value"].sum()), 2),
        "Commerce Orders": round(float(qualifying.loc[valid_commerce_mask, "realized_value"].sum()), 2),
    }
    return {
        "label": "Historical Realized Customer Lifetime Value",
        "metric_type": "ltv",
        "currency": "USD",
        "basis": "historical_realized",
        "source": (
            "Ticket Orders · transaction amount + Commerce Orders · order total; "
            "returned, cancelled, refunded, and voided commerce orders excluded"
        ),
        "total": round(float(values.sum()), 2),
        "average": round(float(values.mean()), 2),
        "median": round(float(values.median()), 2),
        "coverage": int(len(values)),
        "transaction_count": int(qualifying_mask.sum()),
        "excluded_transaction_count": int((ticket_mask | commerce_mask).sum() - qualifying_mask.sum()),
        "source_totals": source_totals,
        "source_fields": [
            "Ticket Orders · transaction amount",
            "Commerce Orders · order total",
        ],
        "tiers": [
            {
                "label": label,
                "range": value_range,
                "value": int(mask.sum()),
                "amount": round(float(values[mask].sum()), 2),
                "color": color,
            }
            for label, value_range, mask, color in tiers
        ],
        "tier_method": (
            "Low, Medium, and High are determined from the 33rd and 67th "
            f"percentiles of positive realized Sports LTV: ${lower_threshold:,.2f} "
            f"and ${upper_threshold:,.2f}."
        ),
        "formula": (
            "Historical realized LTV per customer profile = sum of positive ticket "
            "transaction_amount values + sum of positive commerce order_total_amount "
            "values after excluding returned, cancelled, refunded, and voided orders. "
            "Each source_file + record_id transaction is counted once."
        ),
    }


def _automotive_profile_value(golden):
    customers_path = LEGACY_ROOT / "generated_data" / "automotive" / "aut_customers.csv"
    if not customers_path.exists():
        return None
    customers = pd.read_csv(customers_path, low_memory=False)
    required_customer_columns = {"customer_id", "estimated_clv"}
    required_golden_columns = {"golden_id", "customer_id"}
    if not required_customer_columns.issubset(customers.columns) or not required_golden_columns.issubset(golden.columns):
        return None
    customer_values = customers[["customer_id", "estimated_clv"]].copy()
    customer_values["customer_id"] = customer_values["customer_id"].astype(str)
    customer_values["estimated_clv"] = pd.to_numeric(
        customer_values["estimated_clv"], errors="coerce"
    )
    customer_values = customer_values.dropna(subset=["estimated_clv"]).drop_duplicates(
        subset=["customer_id"]
    )
    profile_links = golden[["golden_id", "customer_id"]].dropna().copy()
    profile_links["customer_id"] = profile_links["customer_id"].astype(str)
    joined = profile_links.merge(customer_values, on="customer_id", how="inner")
    values = joined.groupby("golden_id")["estimated_clv"].sum()
    values = values[values.notna() & values.ge(0)]
    if values.empty:
        return None
    lower_threshold = round(float(values.quantile(1 / 3)), 2)
    upper_threshold = round(float(values.quantile(2 / 3)), 2)
    tiers = [
        (
            "Low",
            f"$0-${lower_threshold:,.2f}",
            values <= lower_threshold,
            "#4da3ff",
        ),
        (
            "Medium",
            f">${lower_threshold:,.2f}-${upper_threshold:,.2f}",
            (values > lower_threshold) & (values <= upper_threshold),
            "#b493ff",
        ),
        (
            "High",
            f">${upper_threshold:,.2f}",
            values > upper_threshold,
            "#24d69b",
        ),
    ]
    return {
        "label": "Estimated CLV",
        "metric_type": "ltv",
        "currency": "USD",
        "basis": "estimated_clv",
        "source": "aut_customers.csv · estimated_clv joined to golden profiles by customer_id",
        "total": round(float(values.sum()), 2),
        "average": round(float(values.mean()), 2) if len(values) else None,
        "median": round(float(values.median()), 2) if len(values) else None,
        "coverage": int(len(values)),
        "source_fields": ["Automotive Customers · estimated CLV"],
        "tiers": [
            {
                "label": label,
                "range": value_range,
                "value": int(mask.sum()),
                "amount": round(float(values[mask].sum()), 2),
                "color": color,
            }
            for label, value_range, mask, color in tiers
        ],
        "tier_method": (
            "Low, Medium, and High are transparent source-derived tertiles of "
            f"nonnegative estimated CLV: ${lower_threshold:,.2f} and "
            f"${upper_threshold:,.2f}."
        ),
        "formula": (
            "Estimated CLV per customer profile = the source-provided estimated_clv "
            "joined by customer_id and aggregated to the resolved profile. The "
            "reporting layer does not recalculate or relabel that source estimate."
        ),
    }


def _duplicate_profile_risk(source, golden_ids):
    pairs_path = LEGACY_ROOT / "matching_output" / source / "candidate_pairs.csv"
    superseded_path = LEGACY_ROOT / "golden_records_output" / source / "superseded_ids.csv"
    if not pairs_path.exists() or not superseded_path.exists():
        return []
    superseded = pd.read_csv(
        superseded_path,
        usecols=lambda column: column in {"record_id", "golden_id"},
        dtype=str,
        low_memory=False,
    )
    if not {"record_id", "golden_id"}.issubset(superseded.columns):
        return []
    record_to_golden = dict(zip(superseded["record_id"], superseded["golden_id"]))
    pair_headers = set(pd.read_csv(pairs_path, nrows=0).columns.astype(str))
    tier_column = (
        "edge_type"
        if "edge_type" in pair_headers
        else "match_tier"
        if "match_tier" in pair_headers
        else None
    )
    if tier_column is None:
        return []
    pairs = pd.read_csv(
        pairs_path,
        usecols=lambda column: column
        in {"record_id_1", "record_id_2", tier_column},
        dtype=str,
        low_memory=False,
    )
    if not {"record_id_1", "record_id_2", tier_column}.issubset(pairs.columns):
        return []
    pairs["tier"] = pairs[tier_column]
    rank = {"exact": 1, "strong": 1, "medium": 2, "weak": 3}
    profile_risk = {}
    for row in pairs.itertuples(index=False):
        tier_rank = rank.get(str(row.tier or "").strip().lower(), 0)
        if not tier_rank:
            continue
        for record_id in (row.record_id_1, row.record_id_2):
            golden_id = record_to_golden.get(str(record_id))
            if golden_id in golden_ids:
                profile_risk[golden_id] = max(profile_risk.get(golden_id, 0), tier_rank)
    counts = {
        0: max(len(golden_ids) - len(profile_risk), 0),
        1: sum(1 for value in profile_risk.values() if value == 1),
        2: sum(1 for value in profile_risk.values() if value == 2),
        3: sum(1 for value in profile_risk.values() if value == 3),
    }
    return [
        {"label": "No candidate signal", "value": counts[0], "color": "#4da3ff"},
        {"label": "Low", "value": counts[1], "color": "#24d69b"},
        {"label": "Moderate", "value": counts[2], "color": "#ffb547"},
        {"label": "High", "value": counts[3], "color": "#ff70d1"},
    ]


def _complete_profile_universe(golden, clustered, source):
    """Return one truthful profile row for every resolved identity cluster.

    The golden-record artifact contains the enriched subset produced by the
    golden-record step. The clustering artifact is the authoritative identity
    universe and can contain additional single-record clusters. Those clusters
    are retained as limited-attribute profiles instead of disappearing from
    reporting denominators.
    """
    if (
        clustered.empty
        or "cluster_id" not in clustered.columns
        or clustered["cluster_id"].dropna().empty
    ):
        result = golden.copy()
        result["profile_scope"] = "golden_artifact"
        result["limited_attributes"] = False
        return result

    cluster_rows = clustered.copy()
    cluster_rows["cluster_id"] = (
        cluster_rows["cluster_id"].fillna("").astype(str).str.strip()
    )
    cluster_rows = cluster_rows[cluster_rows["cluster_id"].ne("")]
    actual_counts = cluster_rows.groupby("cluster_id", sort=False).size()
    if "source_file" in cluster_rows.columns:
        actual_sources = cluster_rows.groupby("cluster_id", sort=False)["source_file"].agg(
            lambda values: "|".join(
                sorted(
                    {
                        str(value).strip()
                        for value in values
                        if str(value).strip()
                    }
                )
            )
        )
    else:
        actual_sources = pd.Series("", index=actual_counts.index, dtype=object)

    existing = golden.copy()
    if "cluster_id" not in existing.columns:
        existing["cluster_id"] = ""
    existing["cluster_id"] = existing["cluster_id"].fillna("").astype(str).str.strip()
    existing = existing[existing["cluster_id"].ne("")].drop_duplicates(
        subset=["cluster_id"], keep="first"
    )
    # Cluster membership is the authoritative current identity universe. A
    # golden-record table can briefly lag it (for example after a prior
    # partial run), so stale golden rows must not inflate reporting totals.
    existing = existing[existing["cluster_id"].isin(actual_counts.index)]
    existing["profile_scope"] = "golden_artifact"
    existing["limited_attributes"] = False

    existing_cluster_ids = set(existing["cluster_id"])
    missing_cluster_ids = [
        cluster_id
        for cluster_id in actual_counts.index
        if cluster_id not in existing_cluster_ids
    ]
    if missing_cluster_ids:
        first_rows = (
            cluster_rows.drop_duplicates(subset=["cluster_id"], keep="first")
            .set_index("cluster_id", drop=False)
        )
        synthetic = pd.DataFrame(index=missing_cluster_ids)
        for column in existing.columns:
            if column in first_rows.columns:
                synthetic[column] = first_rows.reindex(missing_cluster_ids)[column].values
            else:
                synthetic[column] = ""
        synthetic["cluster_id"] = missing_cluster_ids
        synthetic["golden_id"] = [
            cluster_id.replace("-CL-", "-GR-")
            for cluster_id in missing_cluster_ids
        ]
        synthetic["source_system"] = source
        synthetic["profile_scope"] = "cluster_singleton"
        synthetic["limited_attributes"] = True

        first_names = synthetic.get(
            "first_name", pd.Series("", index=synthetic.index, dtype=object)
        ).fillna("").astype(str).str.strip()
        last_names = synthetic.get(
            "last_name", pd.Series("", index=synthetic.index, dtype=object)
        ).fillna("").astype(str).str.strip()
        combined_names = (first_names + " " + last_names).str.strip()
        if "full_name" not in synthetic.columns:
            synthetic["full_name"] = ""
        synthetic["full_name"] = (
            synthetic["full_name"].fillna("").astype(str).str.strip()
        )
        synthetic.loc[synthetic["full_name"].eq(""), "full_name"] = combined_names

        for target, source_candidates in (
            ("ticketing_account_id", ("ticket_account_id",)),
            ("account_id", ("account_id", "ticket_account_id")),
            ("address", ("address", "line1", "shipping_address")),
            ("city", ("city", "shipping_city")),
            ("state", ("state", "state_of_residence", "shipping_state")),
            ("zip", ("zip", "shipping_zip")),
            ("subscription_tier", ("subscription_tier", "subscription_tier_code")),
        ):
            if target not in synthetic.columns:
                synthetic[target] = ""
            synthetic[target] = synthetic[target].fillna("").astype(str)
            blank = synthetic[target].fillna("").astype(str).str.strip().eq("")
            for source_column in source_candidates:
                if source_column not in first_rows.columns:
                    continue
                candidate_values = (
                    first_rows.reindex(missing_cluster_ids)[source_column]
                    .fillna("")
                    .astype(str)
                )
                fill_mask = blank & candidate_values.str.strip().ne("")
                synthetic.loc[fill_mask, target] = candidate_values[fill_mask].values
                blank = synthetic[target].fillna("").astype(str).str.strip().eq("")

        for target, source_column in (
            ("all_emails", "email"),
            ("all_phones", "phone"),
            ("all_names", "full_name"),
            ("all_devices", "device_id"),
        ):
            if target not in synthetic.columns:
                synthetic[target] = ""
            if source_column in synthetic.columns:
                blank = synthetic[target].fillna("").astype(str).str.strip().eq("")
                synthetic.loc[blank, target] = (
                    synthetic.loc[blank, source_column].fillna("").astype(str)
                )
        existing = pd.DataFrame.from_records(
            [
                *existing.to_dict(orient="records"),
                *synthetic.to_dict(orient="records"),
            ]
        )

    existing["record_count"] = (
        existing["cluster_id"].map(actual_counts).fillna(0).astype(int)
    )
    existing["source_files"] = (
        existing["cluster_id"].map(actual_sources).fillna("").astype(str)
    )
    existing["diversity_score"] = existing["source_files"].map(
        lambda value: len(
            {
                item.strip()
                for item in str(value or "").split("|")
                if item.strip()
            }
        )
    )
    return existing.reset_index(drop=True)


def _compute_customer_profile_report(source):
    base = LEGACY_ROOT / "golden_records_output" / source
    golden_path = base / "golden_records.csv"
    golden_summary_path = base / "golden_record_summary.json"
    household_summary_path = base / "household_summary.json"
    cluster_summary_path = (
        LEGACY_ROOT / "clustering_output" / source / "cluster_summary.json"
    )
    clustered_path = LEGACY_ROOT / "clustering_output" / source / "clustered_records.csv"
    sports_event_path = (
        LEGACY_ROOT
        / "generated_data"
        / "sports"
        / "spt_marketing_campaign_events.csv"
        if source == "sports"
        else None
    )
    media_billing_source_path = (
        LEGACY_ROOT
        / "generated_data"
        / "media"
        / "med_subscription_billing.csv"
        if source == "media"
        else None
    )
    media_billing_history_path = (
        LEGACY_ROOT
        / "generated_data"
        / "media"
        / "med_subscription_billing_history.csv"
        if source == "media"
        else None
    )
    extra_paths = [
        LEGACY_ROOT / "matching_output" / source / "candidate_pairs.csv",
        base / "superseded_ids.csv",
    ]
    if source == "automotive":
        extra_paths.append(LEGACY_ROOT / "generated_data" / "automotive" / "aut_customers.csv")
    if sports_event_path is not None:
        extra_paths.append(sports_event_path)
    if media_billing_source_path is not None:
        extra_paths.append(media_billing_source_path)
    if media_billing_history_path is not None:
        extra_paths.append(media_billing_history_path)
    paths = [
        golden_path,
        golden_summary_path,
        household_summary_path,
        cluster_summary_path,
        clustered_path,
        *extra_paths,
    ]
    signature = _artifact_signature(paths)
    cached = _CUSTOMER_REPORT_CACHE.get(source)
    if cached and cached.get("signature") == signature:
        return cached["payload"]

    # The two source-scoped Delta tables are the reporting contract. Summary
    # JSON files are useful lineage diagnostics, but they are optional and can
    # lag an otherwise valid atomic table replacement.
    if not golden_path.exists() or not clustered_path.exists():
        return {
            "source_system": source,
            "data_available": False,
            "summary": {},
            "coverage": [],
            "depth": [],
            "breadth": [],
            "household_distribution": [],
            "value_tiers": [],
            "engagement_distribution": [],
            "events_by_type": [],
            "duplicate_risk": [],
        }

    golden = pd.read_csv(golden_path, low_memory=False)
    golden_summary = _read_json_object(golden_summary_path)
    household_summary = _read_json_object(household_summary_path)
    cluster_summary = _read_json_object(cluster_summary_path)
    golden_summary_source = str(
        golden_summary.get("source_system") or ""
    ).strip().lower()
    if golden_summary_source and golden_summary_source != source:
        return {"source_system": source, "data_available": False, "summary": {}}

    clustered = pd.read_csv(clustered_path, low_memory=False)
    golden = _complete_profile_universe(golden, clustered, source)
    total = int(len(golden))
    clustered_profile_total = (
        int(clustered["cluster_id"].dropna().astype(str).nunique())
        if not clustered.empty and "cluster_id" in clustered.columns
        else total
    )
    declared_identity_cluster_total = (
        int(cluster_summary["total_clusters"])
        if (
            (
                not str(cluster_summary.get("source_system") or "").strip()
                or str(cluster_summary.get("source_system") or "").strip().lower() == source
            )
            and cluster_summary.get("total_clusters") is not None
        )
        else None
    )
    # The current clustered-record table is authoritative for resolved
    # profile membership. Keep the JSON-declared count separately so a stale
    # summary remains observable without making a valid report unavailable.
    identity_cluster_total = clustered_profile_total
    golden_cluster_ids = set(golden.get("cluster_id", pd.Series(dtype=str)).dropna().astype(str))
    golden_ids = set(golden.get("golden_id", pd.Series(dtype=str)).dropna().astype(str))
    has_record_counts = "record_count" in golden.columns
    record_counts = (
        pd.to_numeric(golden["record_count"], errors="coerce")
        if has_record_counts
        else pd.Series(dtype=float)
    )
    multi = int((record_counts > 1).sum()) if has_record_counts else None
    singleton = max(total - multi, 0) if multi is not None else None
    has_source_files = "source_files" in golden.columns
    source_files = (
        golden["source_files"].fillna("").astype(str)
        if has_source_files
        else pd.Series(dtype=str)
    )
    contributing_feeds = (
        len(
            {
                item.strip()
                for value in source_files
                for item in value.split("|")
                if item.strip()
            }
        )
        if has_source_files
        else None
    )
    source_contribution = (
        _profile_source_contribution_rows(source_files, total)
        if has_source_files
        else []
    )

    coverage = _profile_coverage_rows(golden, source)
    top_coverage = coverage[0] if coverage else {"label": "Attribute", "value": None, "pct": None}

    activity_context = (
        _profile_activity_context(clustered, golden_cluster_ids, source)
        if not clustered.empty
        else {
            "summary": {},
            "active_cluster_ids": set(),
            "latest_activity_by_cluster": {},
        }
    )
    activity = activity_context["summary"]
    engagement = (
        _profile_engagement_distribution(
            clustered,
            golden_cluster_ids,
            source,
        )
        if not clustered.empty
        else {}
    )
    event_types = (
        _profile_event_type_distribution(
            clustered,
            golden_cluster_ids,
            source,
            sports_event_path=sports_event_path,
        )
        if not clustered.empty
        else {
            "total": None,
            "rows": [],
            "fields": [],
            "grain": None,
            "scope": None,
        }
    )
    if source == "media":
        value = _media_profile_value(clustered, golden_cluster_ids)
    elif source == "sports":
        value = _sports_profile_value(clustered, golden_cluster_ids)
    elif source == "automotive":
        value = _automotive_profile_value(golden)
    else:
        value = None

    value = value or {}
    ltv_available = value.get("metric_type") == "ltv"
    household_available = (
        household_summary_path.exists()
        and isinstance(household_summary.get("size_distribution"), dict)
        and household_summary.get("total_households") is not None
    )
    household_distribution = [
        {"label": str(label), "value": int(number)}
        for label, number in (
            household_summary.get("size_distribution") if household_available else {}
        ).items()
    ]
    household_distribution.sort(key=lambda row: int(row["label"]) if row["label"].isdigit() else 999)

    summary = {
        "total_profiles": total,
        "multi_profiles": multi,
        "singleton_profiles": singleton,
        "largest_profile": (
            int(record_counts.max())
            if has_record_counts and not record_counts.dropna().empty
            else None
        ),
        "unified_profile_rate": (
            round(multi / total * 100, 1)
            if total and multi is not None
            else None
        ),
        "households": (
            int(household_summary.get("total_households"))
            if household_available
            else None
        ),
        "multi_member_households": (
            int(household_summary.get("multi_member"))
            if household_available and household_summary.get("multi_member") is not None
            else None
        ),
        "largest_household": (
            int(household_summary.get("largest_household"))
            if household_available and household_summary.get("largest_household") is not None
            else None
        ),
        "contributing_feeds": contributing_feeds,
        "profile_linked_records": (
            int(record_counts.fillna(0).sum())
            if has_record_counts
            else None
        ),
        "interaction_records": activity.get("interaction_records"),
        "interaction_fields": activity.get("activity_fields") or [],
        "total_customer_events": event_types.get("total"),
        "customer_event_fields": event_types.get("fields") or [],
        "customer_event_grain": event_types.get("grain"),
        "customer_event_scope": event_types.get("scope"),
        "top_coverage_label": top_coverage.get("label"),
        "top_coverage_count": top_coverage.get("value"),
        "top_coverage_pct": top_coverage.get("pct"),
        "active_profiles": activity.get("active_profiles"),
        "inactive_profiles": activity.get("inactive_profiles"),
        "active_pct": activity.get("active_pct"),
        "inactive_pct": activity.get("inactive_pct"),
        "activity_window": activity.get("activity_window"),
        "activity_as_of": activity.get("activity_as_of"),
        "activity_current": bool(activity.get("activity_current")),
        "activity_age_days": activity.get("activity_age_days"),
        "average_engagement": engagement.get("average"),
        "engagement_unit": (
            "percent" if engagement.get("average") is not None else None
        ),
        "engagement_profile_count": engagement.get("profile_count"),
        "engagement_coverage": engagement.get("profile_count"),
        "engagement_engaged_profiles": engagement.get("engaged_profiles"),
        "engagement_unmeasured_profiles": engagement.get("unmeasured_profiles"),
        "engagement_coverage_pct": engagement.get("coverage_pct"),
        "engagement_formula": engagement.get("formula"),
        "engagement_window": engagement.get("window"),
        "engagement_as_of": engagement.get("as_of"),
        "engagement_current": bool(engagement.get("current")),
        "engagement_grain": engagement.get("grain"),
        "engagement_scope": engagement.get("scope"),
        "engagement_source_fields": engagement.get("fields") or [],
        "total_ltv": value.get("total") if ltv_available else None,
        "average_ltv": value.get("average") if ltv_available else None,
        "median_ltv": value.get("median") if ltv_available else None,
        "ltv_label": value.get("label") if ltv_available else None,
        "ltv_currency": value.get("currency") if ltv_available else None,
        "ltv_basis": value.get("basis") if ltv_available else None,
        "ltv_transaction_count": (
            value.get("transaction_count") if ltv_available else None
        ),
        "ltv_excluded_transaction_count": (
            value.get("excluded_transaction_count") if ltv_available else None
        ),
        "ltv_source_totals": (
            value.get("source_totals") if ltv_available else None
        ),
        "ltv_source_fields": (
            value.get("source_fields") if ltv_available else []
        ),
        "ltv_formula": value.get("formula") if ltv_available else None,
        "value_total": value.get("total"),
        "value_label": value.get("label"),
        "value_currency": value.get("currency"),
        "value_metric_type": value.get("metric_type"),
        "value_coverage": value.get("coverage"),
        "value_source": value.get("source"),
        "value_tier_method": value.get("tier_method"),
        "profile_composition_reconciles": (
            multi is not None
            and singleton is not None
            and multi + singleton == total
        ),
        "identity_cluster_total": identity_cluster_total,
        "identity_cluster_summary_total": declared_identity_cluster_total,
        "identity_cluster_summary_reconciles": (
            declared_identity_cluster_total is None
            or declared_identity_cluster_total == clustered_profile_total
        ),
        "clustered_profile_total": clustered_profile_total,
        "profile_universe_reconciles": (
            total == identity_cluster_total == clustered_profile_total
        ),
        "limited_attribute_profiles": int(
            golden.get(
                "limited_attributes",
                pd.Series(False, index=golden.index, dtype=bool),
            ).fillna(False).astype(bool).sum()
        ),
    }
    payload = {
        "source_system": source,
        "data_available": total > 0,
        "artifact_signature": str(hash(signature)),
        "summary": summary,
        "coverage": coverage,
        "source_contribution": source_contribution,
        "depth": _profile_depth_rows(record_counts, source) if has_record_counts else [],
        "breadth": _profile_breadth_rows(source_files, source) if has_source_files else [],
        "household_distribution": household_distribution,
        "value_tiers": value.get("tiers") or [],
        "engagement_distribution": engagement.get("rows") or [],
        "events_by_type": event_types.get("rows") or [],
        "duplicate_risk": _duplicate_profile_risk(source, golden_ids),
        "explain_report": {
            "title": "Customer profile reporting evidence",
            "summary": (
                "Profile structure includes every source-scoped resolved identity "
                "cluster. Enriched golden-record attributes are retained where "
                "available; remaining single-record clusters are represented with "
                "their truthful source attributes."
            ),
            "activity": (
                "Active profiles are distinct profiles in the current identity "
                "universe with a supported activity date in the latest "
                "artifact-relative 30-day window."
            ),
            "activity_freshness": (
                "Active and inactive classifications are published only when the "
                "latest supported activity is no more than 45 days old. Stale "
                "activity windows are retained as evidence but are not presented "
                "as current KPI values."
            ),
            "interactions": (
                "Profile-linked interactions count resolved source rows containing "
                "at least one supported activity timestamp."
            ),
            "events": (
                f"{event_types.get('scope')}. "
                "Every event has an explicit categorical type, a supported "
                "timestamp, and a resolved-profile link. Each source event is "
                "counted at most once; source-file names and timestamps are not "
                "relabeled as event types."
                if event_types.get("scope")
                else "No governed typed customer-event contract is available."
            ),
            "engagement": (
                f"{engagement.get('scope')}. {engagement.get('formula')} "
                f"Evidence window: {engagement.get('window')}."
                if engagement.get("profile_count")
                else "No governed profile-level engagement contract is available."
            ),
            "source_contribution": (
                "Each source contribution is the count of resolved customer profiles whose "
                "lineage includes that governed source artifact. Percentages can "
                "overlap because one profile can contain multiple sources."
            ),
            "household_scope": (
                "Household measures describe only the retained source-scoped "
                "household artifact. They are not presented as complete coverage "
                "of every cluster in the resolved profile universe."
            ),
            "value": value.get("source") or "No governed profile value field is available.",
            "ltv_note": (
                "Media LTV is historical realized customer value calculated from "
                "qualifying linked subscription billing-history transactions when "
                "that governed table is available. Its existing Active MRR value "
                "proxy remains clearly labelled as a fallback. Sports LTV is "
                "historical realized customer value calculated from "
                "all qualifying linked ticket and commerce transactions; it is "
                "not predicted future value. Automotive LTV uses its governed "
                "estimated CLV field. Other value measures are not relabelled LTV."
            ),
            "sources": [str(path.relative_to(ROOT)) for path in paths if path.exists()],
        },
    }
    activity_profile_columns = [
        column
        for column in (
            "cluster_id",
            "golden_id",
            "full_name",
            "first_name",
            "last_name",
            "profile_name",
            "all_names",
            "email",
            "phone",
            "all_emails",
            "all_phones",
            "record_count",
        )
        if column in golden.columns
    ]
    _CUSTOMER_REPORT_CACHE[source] = {
        "signature": signature,
        "payload": payload,
        "activity_context": activity_context,
        "activity_profiles": golden[activity_profile_columns].copy(),
    }
    return payload


def _build_customer_profile_report(source):
    source = normalize_source_system(source, "media")

    def load_report():
        snapshot = _read_source_report_snapshot(
            "customer-report",
            source,
            _CUSTOMER_REPORT_REVISION,
        )
        if snapshot is not None:
            return snapshot
        payload = _compute_customer_profile_report(source)
        _write_source_report_snapshot(
            "customer-report",
            source,
            _CUSTOMER_REPORT_REVISION,
            payload,
        )
        return payload

    return _cached_source_report(
        "customer-report",
        source,
        _CUSTOMER_REPORT_REVISION,
        load_report,
        "CODEX_CUSTOMER_REPORT_CACHE_SECONDS",
    )


@app.get("/api/reporting/customer-profiles")
def customer_profiles_report():
    source = normalize_source_system(
        request.args.get("source") or request.args.get("source_system"), "media"
    )
    return jsonify(_build_customer_profile_report(source))


_CUSTOMER_PROFILE_MISSING_TOKENS = {
    "",
    "nan",
    "none",
    "null",
    "n/a",
    "na",
    "<na>",
}


def _customer_profile_clean_text(value):
    """Return a usable scalar identity value without exposing null sentinels."""
    text = str(value if value is not None else "").strip()
    return (
        text
        if text and text.lower() not in _CUSTOMER_PROFILE_MISSING_TOKENS
        else None
    )


def _customer_profile_contact_value(row, primary_column, collection_column):
    collection = _customer_profile_clean_text(row.get(collection_column)) or ""
    values = [
        _customer_profile_clean_text(row.get(primary_column)),
        *[
            _customer_profile_clean_text(value)
            for value in collection.split("|")
        ],
    ]
    return next((value for value in values if value), None)


def _customer_profile_display_name(row):
    """Prefer source names, including collected aliases, without inventing one."""
    direct_name = _customer_profile_clean_text(row.get("full_name"))
    if direct_name:
        return direct_name

    first_name = _customer_profile_clean_text(row.get("first_name"))
    last_name = _customer_profile_clean_text(row.get("last_name"))
    combined_name = " ".join(
        value for value in (first_name, last_name) if value
    ).strip()
    if combined_name:
        return combined_name

    profile_name = _customer_profile_clean_text(row.get("profile_name"))
    if profile_name:
        return profile_name

    all_names = _customer_profile_clean_text(row.get("all_names")) or ""
    return next(
        (
            name
            for name in (
                _customer_profile_clean_text(value)
                for value in all_names.split("|")
            )
            if name
        ),
        None,
    )


def _customer_profile_mask_phone(value):
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits:
        return None
    if len(digits) <= 4:
        return "*" * len(digits)
    return f"***-***-{digits[-4:]}"


def _build_customer_activity_profile_index(source):
    """Build a privacy-safe drill-down index that reconciles to profile KPIs."""
    base = LEGACY_ROOT / "golden_records_output" / source
    golden_path = base / "golden_records.csv"
    clustered_path = (
        LEGACY_ROOT / "clustering_output" / source / "clustered_records.csv"
    )
    report = _build_customer_profile_report(source)
    if not report.get("data_available"):
        raise FileNotFoundError("Customer profile reporting is unavailable.")
    if not golden_path.exists() or not clustered_path.exists():
        raise FileNotFoundError(
            "Customer profile membership and activity artifacts are unavailable."
        )

    signature = _artifact_signature([golden_path, clustered_path])
    cached = _CUSTOMER_ACTIVITY_PROFILE_CACHE.get(source)
    if cached and cached.get("signature") == signature:
        return cached["payload"]

    report_cache = _CUSTOMER_REPORT_CACHE.get(source) or {}
    cached_profiles = report_cache.get("activity_profiles")
    cached_activity = report_cache.get("activity_context")
    if isinstance(cached_profiles, pd.DataFrame) and isinstance(
        cached_activity,
        dict,
    ):
        profiles = cached_profiles.copy()
        activity = cached_activity
    else:
        golden_available = set(
            pd.read_csv(golden_path, nrows=0).columns.astype(str)
        )
        clustered_available = set(
            pd.read_csv(clustered_path, nrows=0).columns.astype(str)
        )
        if (
            "cluster_id" not in golden_available
            or "cluster_id" not in clustered_available
        ):
            raise ValueError(
                "The selected source does not contain the resolved profile "
                "membership required for activity drill-down."
            )

        profile_columns = {
            "cluster_id",
            "golden_id",
            "source_system",
            "full_name",
            "first_name",
            "last_name",
            "profile_name",
            "all_names",
            "email",
            "phone",
            "all_emails",
            "all_phones",
            "record_count",
        }
        activity_columns = {
            "cluster_id",
            "source_file",
            "full_name",
            "first_name",
            "last_name",
            "profile_name",
            "all_names",
            "email",
            "phone",
            *_profile_activity_date_columns(source),
        }
        golden = pd.read_csv(
            golden_path,
            usecols=list(profile_columns.intersection(golden_available)),
            dtype=str,
            low_memory=False,
        ).fillna("")
        clustered = pd.read_csv(
            clustered_path,
            usecols=list(activity_columns.intersection(clustered_available)),
            dtype=str,
            low_memory=False,
        ).fillna("")
        profiles = _complete_profile_universe(golden, clustered, source)
        profile_ids = set(
            profiles["cluster_id"].fillna("").astype(str).str.strip()
        )
        profile_ids.discard("")
        activity = _profile_activity_context(
            clustered,
            profile_ids,
            source,
        )

    profiles["cluster_id"] = (
        profiles["cluster_id"].fillna("").astype(str).str.strip()
    )
    profiles = profiles[profiles["cluster_id"].ne("")].drop_duplicates(
        subset=["cluster_id"],
        keep="first",
    )
    activity_summary = activity["summary"]
    if (
        activity_summary.get("active_profiles") is None
        or activity_summary.get("inactive_profiles") is None
    ):
        raise ValueError(
            "No supported profile activity dates are available for this source."
        )

    active_ids = activity["active_cluster_ids"]
    latest_by_cluster = activity["latest_activity_by_cluster"]
    source_label = {
        "media": "Media & OTT",
        "sports": "Sports",
        "automotive": "Automotive",
        "telecom": "Telecom",
    }.get(source, source.replace("_", " ").title())
    freshness = (
        "current"
        if activity_summary.get("activity_current")
        else "historical"
    )
    profiles["record_count"] = pd.to_numeric(
        profiles.get(
            "record_count",
            pd.Series(index=profiles.index, dtype=float),
        ),
        errors="coerce",
    )
    rows_by_status = {"active": [], "inactive": []}
    for row in profiles.to_dict(orient="records"):
        cluster_id = _customer_profile_clean_text(row.get("cluster_id")) or ""
        status = "active" if cluster_id in active_ids else "inactive"
        profile_id = (
            _customer_profile_clean_text(row.get("golden_id"))
            or cluster_id
        )
        email = _customer_profile_contact_value(row, "email", "all_emails")
        phone = _customer_profile_contact_value(row, "phone", "all_phones")
        masked_email = _identity_mask_email(email)
        masked_phone = _customer_profile_mask_phone(phone)
        customer_name = _customer_profile_display_name(row)
        customer_label = (
            customer_name
            or masked_email
            or masked_phone
            or profile_id
        )
        latest = latest_by_cluster.get(cluster_id)
        latest_date = (
            latest.date().isoformat()
            if latest is not None and not pd.isna(latest)
            else None
        )
        member_count = row.get("record_count")
        rows_by_status[status].append(
            {
                "profile_id": profile_id,
                "customer_name": customer_label,
                "email": masked_email,
                "phone": masked_phone,
                "member_record_count": (
                    int(member_count) if not pd.isna(member_count) else None
                ),
                "activity_status": status,
                "latest_supported_activity_date": latest_date,
                "activity_window": activity_summary.get("activity_window"),
                "source": source_label,
                "activity_current": bool(
                    activity_summary.get("activity_current")
                ),
                "activity_freshness": freshness,
            }
        )

    for rows in rows_by_status.values():
        rows.sort(key=lambda row: row["profile_id"])
        rows.sort(
            key=lambda row: row["latest_supported_activity_date"] or "",
            reverse=True,
        )

    expected_total = int(report.get("summary", {}).get("total_profiles") or 0)
    expected_active = int(activity_summary["active_profiles"])
    expected_inactive = int(activity_summary["inactive_profiles"])
    if (
        len(profiles) != expected_total
        or len(rows_by_status["active"]) != expected_active
        or len(rows_by_status["inactive"]) != expected_inactive
        or expected_active + expected_inactive != expected_total
    ):
        raise ValueError(
            "Profile activity drill-down does not reconcile to the reporting KPIs."
        )

    payload = {
        "source_system": source,
        "source": source_label,
        "activity_window": activity_summary.get("activity_window"),
        "activity_as_of": activity_summary.get("activity_as_of"),
        "activity_current": bool(activity_summary.get("activity_current")),
        "activity_freshness": freshness,
        "activity_age_days": activity_summary.get("activity_age_days"),
        "rows_by_status": rows_by_status,
    }
    _CUSTOMER_ACTIVITY_PROFILE_CACHE[source] = {
        "signature": signature,
        "payload": payload,
    }
    return payload


@app.get("/api/reporting/customer-profiles/activity-profiles")
def customer_profile_activity_profiles():
    source = normalize_source_system(
        request.args.get("source") or request.args.get("source_system"),
        "media",
    )
    status = str(request.args.get("status") or "").strip().lower()
    if status not in {"active", "inactive"}:
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": "Status must be either active or inactive.",
            }
        ), 400
    try:
        page = max(int(request.args.get("page", 1)), 1)
        page_size = min(max(int(request.args.get("page_size", 25)), 1), 100)
    except (TypeError, ValueError):
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": "Page and page size must be positive integers.",
            }
        ), 400

    try:
        index = _build_customer_activity_profile_index(source)
        rows = index["rows_by_status"][status]
        total = len(rows)
        total_pages = max((total + page_size - 1) // page_size, 1)
        page = min(page, total_pages)
        start = (page - 1) * page_size
        return jsonify(
            {
                "source_system": source,
                "source": index["source"],
                "data_available": True,
                "status": status,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "activity_window": index["activity_window"],
                "activity_as_of": index["activity_as_of"],
                "activity_current": index["activity_current"],
                "activity_freshness": index["activity_freshness"],
                "activity_age_days": index["activity_age_days"],
                "rows": rows[start:start + page_size],
                "privacy_note": (
                    "Email and phone values are masked in reporting drill-downs."
                ),
                "classification_note": (
                    "Active profiles have at least one supported activity date in "
                    "the artifact-relative 30-day window. All other profiles in "
                    "the same resolved identity universe are classified inactive."
                ),
            }
        )
    except FileNotFoundError as exc:
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": str(exc),
            }
        ), 404
    except Exception as exc:
        return jsonify(
            {
                "source_system": source,
                "data_available": False,
                "error": (
                    "Customer profile activity drill-down is unavailable: "
                    f"{exc}"
                ),
            }
        ), 500


def _audience_report_seed(source_system=None):
    source = normalize_source_system(source_system, "automotive")
    if source == "automotive":
        segment_rows = [
            {"name": "NPS Recovery", "size": 620, "health_score": 92, "conversion_rate": 14.8, "revenue": 92000, "roi": 5.8, "duplicate_risk": 8, "status": "Production Ready"},
            {"name": "Insurance Cross-Sell", "size": 590, "health_score": 88, "conversion_rate": 13.2, "revenue": 86000, "roi": 5.1, "duplicate_risk": 11, "status": "Production Ready"},
            {"name": "High LTV Owners", "size": 575, "health_score": 86, "conversion_rate": 12.6, "revenue": 104000, "roi": 5.5, "duplicate_risk": 10, "status": "Production Ready"},
            {"name": "Service Due", "size": 548, "health_score": 82, "conversion_rate": 10.9, "revenue": 74000, "roi": 4.6, "duplicate_risk": 14, "status": "Production Ready"},
            {"name": "EV Battery Health Risk", "size": 512, "health_score": 78, "conversion_rate": 9.7, "revenue": 66000, "roi": 4.1, "duplicate_risk": 18, "status": "Production Ready"},
            {"name": "High Fan Score Males 25-34", "size": 498, "health_score": 74, "conversion_rate": 8.8, "revenue": 51000, "roi": 3.4, "duplicate_risk": 21, "status": "Production Ready"},
            {"name": "Mobile App Engaged", "size": 476, "health_score": 72, "conversion_rate": 8.2, "revenue": 47000, "roi": 3.1, "duplicate_risk": 24, "status": "Production Ready"},
            {"name": "Loyalty VIP Owners", "size": 455, "health_score": 70, "conversion_rate": 7.9, "revenue": 69000, "roi": 3.8, "duplicate_risk": 19, "status": "Production Ready"},
            {"name": "Connected Services Upsell", "size": 440, "health_score": 68, "conversion_rate": 7.2, "revenue": 42000, "roi": 2.9, "duplicate_risk": 26, "status": "Production Ready"},
            {"name": "Trade-In Ready", "size": 530, "health_score": 64, "conversion_rate": 6.4, "revenue": 58000, "roi": 2.7, "duplicate_risk": 31, "status": "Ready for Activation"},
            {"name": "Warranty Service", "size": 505, "health_score": 61, "conversion_rate": 5.8, "revenue": 39000, "roi": 2.4, "duplicate_risk": 34, "status": "Ready for Activation"},
            {"name": "Open Recall Outreach", "size": 490, "health_score": 49, "conversion_rate": 4.6, "revenue": 26000, "roi": 1.9, "duplicate_risk": 42, "status": "Draft"},
            {"name": "Connected Trial Expiring", "size": 274, "health_score": 43, "conversion_rate": 3.9, "revenue": 18000, "roi": 1.4, "duplicate_risk": 48, "status": "Draft"},
        ]
    else:
        segment_rows = [
            {"name": "High Value", "size": 620, "health_score": 86, "conversion_rate": 12.1, "revenue": 76000, "roi": 4.8, "duplicate_risk": 12, "status": "Production Ready"},
            {"name": "Loyal Customers", "size": 560, "health_score": 81, "conversion_rate": 10.4, "revenue": 68000, "roi": 4.2, "duplicate_risk": 16, "status": "Production Ready"},
            {"name": "Service Ready", "size": 500, "health_score": 72, "conversion_rate": 8.2, "revenue": 44000, "roi": 3.1, "duplicate_risk": 25, "status": "Ready for Activation"},
            {"name": "Review Queue", "size": 420, "health_score": 48, "conversion_rate": 4.1, "revenue": 18000, "roi": 1.5, "duplicate_risk": 43, "status": "Draft"},
        ]

    total = len(segment_rows)
    status_counts = {
        "Production Ready": sum(1 for row in segment_rows if row["status"] == "Production Ready"),
        "Ready for Activation": sum(1 for row in segment_rows if row["status"] == "Ready for Activation"),
        "In QA Review": sum(1 for row in segment_rows if row["status"] == "In QA Review"),
        "Needs Review": sum(1 for row in segment_rows if row["status"] == "Needs Review"),
    }
    avg_health = round(sum(row["health_score"] for row in segment_rows) / total, 1) if total else 0
    avg_roi = round(sum(row["roi"] for row in segment_rows) / total, 1) if total else 0

    return {
        "status": "success",
        "source_system": source,
        "summary": {
            "total_segments": total,
            "production_ready": status_counts["Production Ready"],
            "ready_for_activation": status_counts["Ready for Activation"],
            "in_qa_review": status_counts["In QA Review"],
            "needs_review": status_counts["Needs Review"],
            "avg_segment_health_score": avg_health,
            "avg_roi_per_segment": avg_roi,
        },
        "charts": {
            "segment_health_score_distribution": [
                {"name": "Good", "value": sum(1 for row in segment_rows if row["health_score"] >= 75), "color": "#22c55e"},
                {"name": "Moderate", "value": sum(1 for row in segment_rows if 50 <= row["health_score"] < 75), "color": "#f59e0b"},
                {"name": "Poor", "value": sum(1 for row in segment_rows if row["health_score"] < 50), "color": "#ef4444"},
            ],
            "activation_readiness_funnel": [
                {"name": "Total", "value": total, "color": "#2563eb"},
                {"name": "Production Ready", "value": status_counts["Production Ready"], "color": "#22c55e"},
                {"name": "Ready for Activation", "value": status_counts["Ready for Activation"], "color": "#0ea5e9"},
                {"name": "QA / Review", "value": status_counts["In QA Review"] + status_counts["Needs Review"], "color": "#f59e0b"},
            ],
            "segment_conversion_rate_comparison": [{"name": row["name"], "value": row["conversion_rate"]} for row in segment_rows[:8]],
            "revenue_contribution_by_segment": [{"name": row["name"], "value": row["revenue"]} for row in segment_rows[:8]],
            "roi_per_segment": [{"name": row["name"], "value": row["roi"]} for row in segment_rows[:8]],
            "duplicate_profile_risk_distribution": [{"name": row["name"], "value": row["duplicate_risk"]} for row in segment_rows[:8]],
            "top_segment_sizes": [{"name": row["name"], "value": row["size"]} for row in segment_rows[:8]],
            "data_freshness_heatmap": {
                "segments": [row["name"] for row in segment_rows[:5]],
                "recency_buckets": ["0-1d", "2-7d", "8-14d", "15-30d", "30d+"],
                "values": [
                    [
                        max(0, min(100, round(row["health_score"] - bucket_index * 13 + row_index * 2)))
                        for bucket_index in range(5)
                    ]
                    for row_index, row in enumerate(segment_rows[:5])
                ],
            },
        },
        "insights": {
            "key_insights": [
                f"{status_counts['Production Ready']} of {total} segments are production ready.",
                f"Average health score is {avg_health} across retained reporting segments.",
                "Top segment sizes and ROI are concentrated in service, loyalty, and recovery audiences.",
            ],
            "recommended_actions": [
                "Prioritize Ready for Activation segments with ROI above portfolio average.",
                "Review high duplicate-risk segments before activation.",
                "Use health ranking to promote production-ready audiences into campaigns.",
            ],
            "health_ranking": sorted(segment_rows, key=lambda row: row["health_score"], reverse=True)[:5],
        },
    }


@app.get("/api/audiences-segments/report")
def audiences_segments_report():
    source_system = request.args.get("source") or request.args.get("source_system") or request.args.get("sourceSystem")
    return jsonify(_audience_report_seed(source_system))


@app.post("/api/copilot/journeys")
def save_copilot_journey():
    payload = request.get_json(silent=True) or {}
    journey = payload.get("journey")
    if not isinstance(journey, dict):
        return jsonify({"error": "journey payload is required"}), 400

    slug = slugify(str(journey.get("slug") or journey.get("name") or ""), "custom-journey")
    record = dict(journey)
    record["slug"] = slug

    output_path = CUSTOM_JOURNEYS_DIR / f"{slug}.json"
    write_json(output_path, record)

    return jsonify({"journey": record, "saved": True, "path": str(output_path.relative_to(ROOT))})


@app.post("/api/copilot/segments")
def save_copilot_segment():
    payload = request.get_json(silent=True) or {}
    segment = payload.get("segment")
    if not isinstance(segment, dict):
        return jsonify({"error": "segment payload is required"}), 400

    segment_id = slugify(str(segment.get("id") or segment.get("name") or ""), "custom-segment").replace("-", "_")
    record = dict(segment)
    record["id"] = segment_id

    output_path = CUSTOM_SEGMENTS_DIR / f"{segment_id}.json"
    write_json(output_path, record)

    return jsonify({"segment": record, "saved": True, "path": str(output_path.relative_to(ROOT))})


@app.post("/api/copilot/send-to-ajo")
def send_to_ajo():
    payload = request.get_json(silent=True) or {}
    request_config = payload.get("requestConfig") if isinstance(payload.get("requestConfig"), dict) else {}
    journey_payload = payload.get("journeyPayload") if isinstance(payload.get("journeyPayload"), dict) else {}

    collection_url = get_ajo_default("collection_url")
    sandbox_name = get_ajo_default("sandbox_name")

    authorization = (
        str(
            request_config.get("authorization")
            or request.headers.get("Authorization")
            or get_ajo_env_value("authorization_env")
        ).strip()
    )
    if authorization and not authorization.lower().startswith("bearer "):
        authorization = f"Bearer {authorization}"

    if not authorization:
        return (
            jsonify(
                {
                    "sent": False,
                    "error": "Missing Adobe Authorization token. Send an Authorization header or set AJO_AUTHORIZATION/AJO_BEARER_TOKEN in backend env.",
                }
            ),
            400,
        )

    api_key = _build_ajo_api_key(request_config, journey_payload)
    if not api_key:
        return (
            jsonify(
                {
                    "sent": False,
                    "error": "Missing Adobe API key. Set the source-specific AJO API key in the runtime secret configuration.",
                }
            ),
            400,
        )

    direct_payload = payload if isinstance(payload.get("header"), dict) and isinstance(payload.get("body"), dict) else None
    outgoing_payload = _build_ajo_payload(request_config.get("payload") or direct_payload, journey_payload)
    outgoing_body = json.dumps(outgoing_payload).encode("utf-8")
    outgoing_headers = {
        "Content-Type": "application/json",
        "Authorization": authorization,
        "x-gw-ims-org-id": get_ajo_default("ims_org_id"),
        "x-api-key": api_key,
        "x-sandbox-name": sandbox_name,
    }

    outgoing_request = urllib_request.Request(
        collection_url,
        data=outgoing_body,
        headers=outgoing_headers,
        method="POST",
    )

    try:
        with urllib_request.urlopen(outgoing_request, timeout=20) as response:
            response_bytes = response.read()
            response_text = response_bytes.decode("utf-8", errors="replace") if response_bytes else ""
            try:
                response_json = json.loads(response_text) if response_text else {}
            except json.JSONDecodeError:
                response_json = {"raw": response_text}

            return jsonify(
                {
                    "sent": True,
                    "statusCode": response.status,
                    "response": response_json,
                }
            )
    except urllib_error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(error_body) if error_body else {}
        except json.JSONDecodeError:
            parsed = {"raw": error_body}
        return jsonify({"sent": False, "statusCode": exc.code, "error": parsed}), 502
    except urllib_error.URLError as exc:
        return jsonify({"sent": False, "error": str(exc.reason)}), 502


# Load General Data through the configured runtime provider.
CSV_PATH = get_path("measurement_general_data")


@lru_cache(maxsize=1)
def load_measurement_data() -> pd.DataFrame:
    try:
        return MEASUREMENT_SERVICE.load_general_data(CSV_PATH)
    except FileNotFoundError as exc:
        raise DatabricksDataAccessError(
            "The governed campaign measurement artifact is not available."
        ) from exc

# -------------------------------
# Data Cleaning
# -------------------------------
#df["event_ts"] = pd.to_datetime(df["event_ts"], errors="coerce")
#df["event_name"] = df["event_name"].str.lower()
#df["bounce_classification"] = df["bounce_classification"].str.lower()
#print(df.columns)


# =========================================================
# 1 SUMMARY API (KPI CARDS)
# =========================================================
@app.route("/api/copilot/journey/measurement/generalsummary", methods=["GET"])
def get_measurement_summary():

    filtered_df = load_measurement_data().copy()

    # Normalize columns
    filtered_df["event_name"] = filtered_df["event_name"].astype(str).str.lower().str.strip()
    filtered_df["channel"] = filtered_df["channel"].astype(str).str.lower().str.strip()
    filtered_df["event_ts"] = pd.to_datetime(filtered_df["event_ts"], errors="coerce")

    # Optional: only email data for email KPIs
    email_df = filtered_df[filtered_df["channel"] == "email"].copy()

    # ---------------- KPI COUNTS ----------------
    Email_sent = (email_df["event_name"] == "sent").sum()
    Email_delivered = (email_df["event_name"] == "delivered").sum()
    Email_opened = (email_df["event_name"] == "opened").sum()
    Email_clicked = (email_df["event_name"] == "clicked").sum()
    Email_unsubscribed = (email_df["event_name"] == "unsubscribed").sum()
    Email_bounced = (email_df["event_name"] == "bounced").sum()

    revenue = email_df["revenue"].fillna(0).sum() if "revenue" in email_df.columns else 0

    def safe_div(n, d):
        return n / d if d != 0 else 0

    Email_delivery_rate = safe_div(Email_delivered, Email_sent)
    Email_open_rate = safe_div(Email_opened, Email_delivered)
    Click_Percentage = safe_div(Email_clicked, Email_delivered)
    Bounce_Rate = safe_div(Email_bounced, Email_sent)
    Unsubscribed_rate = safe_div(Email_unsubscribed, Email_delivered)

    # ---------------- DATE RANGES ----------------
    max_date = email_df["event_ts"].max()

    last_week_start = max_date - pd.Timedelta(days=7)
    prev_week_start = max_date - pd.Timedelta(days=14)

    last_week_df = email_df[
        (email_df["event_ts"] > last_week_start) &
        (email_df["event_ts"] <= max_date)
    ]

    prev_week_df = email_df[
        (email_df["event_ts"] > prev_week_start) &
        (email_df["event_ts"] <= last_week_start)
    ]

    # ---------------- HELPERS ----------------
    def compute_kpis(df):
        sent = (df["event_name"] == "sent").sum()
        delivered = (df["event_name"] == "delivered").sum()
        bounced = (df["event_name"] == "bounced").sum()

        return {
            "Bounce_Rate": safe_div(bounced, sent),
            "Email_delivery_rate": safe_div(delivered, sent),
            "Email_open_rate": safe_div((df["event_name"] == "opened").sum(), delivered),
            "Click_Percentage": safe_div((df["event_name"] == "clicked").sum(), delivered),
            "Unsubscribed_rate": safe_div((df["event_name"] == "unsubscribed").sum(), delivered)
        }

    def percent_change(curr, prev):
        return ((curr - prev) / prev * 100) if prev != 0 else 0

    last_kpis = compute_kpis(last_week_df)
    prev_kpis = compute_kpis(prev_week_df)

    kpi_changes = {
        k: percent_change(last_kpis[k], prev_kpis[k])
        for k in last_kpis
    }

    # ---------------- CHANNEL COUNTS ----------------
    Email_count = (filtered_df["channel"] == "email").sum()
    SMS_count = (filtered_df["channel"] == "sms").sum()
    Notification_count = (filtered_df["channel"] == "notification").sum()

    return jsonify({

    "Email_sent": int(Email_sent),

    "Email_delivered": int(Email_delivered),
    "Email_delivery_rate": round(float(Email_delivery_rate * 100), 2),
    "Email_delivery_growth_percent": round(float(kpi_changes["Email_delivery_rate"]), 2),

    "Email_opened": int(Email_opened),
    "Email_open_rate": round(float(Email_open_rate * 100), 2),
    "Email_open_growth_percent": round(float(kpi_changes["Email_open_rate"]), 2),

    "Email_clicked": int(Email_clicked),
    "Email_Click_percentage": round(float(Click_Percentage * 100), 2),
    "Click_percentage_growth_percent": round(float(kpi_changes["Click_Percentage"]), 2),

    "Email_unsubscribed": int(Email_unsubscribed),
    "Emails_unsubscribed_rate": round(float(Unsubscribed_rate * 100), 2),
    "Unsubscribed_growth_percent": round(float(kpi_changes["Unsubscribed_rate"]), 2),

    "Email_Bounced": int(Email_bounced),
    "Email_Bounce_rate": round(float(Bounce_Rate * 100), 2),
    "Bounce_growth_percent": round(float(kpi_changes["Bounce_Rate"]), 2),

    "revenue": round(float(revenue), 2),

    # ---------------- CHANNEL DISTRIBUTION ----------------
    "Email_channel_percent": round(
        float((Email_count / len(filtered_df)) * 100), 2
    ) if len(filtered_df) != 0 else 0,

    "SMS_channel_percent": round(
        float((SMS_count / len(filtered_df)) * 100), 2
    ) if len(filtered_df) != 0 else 0,

    "Notification_channel_percent": round(
        float((Notification_count / len(filtered_df)) * 100), 2
    ) if len(filtered_df) != 0 else 0

})
# ========================================================
# 3 CHANNEL MIX
# ========================================================
@app.route("/api/copilot/journey/measurement/channelmix", methods=["GET"])
def get_channel_mix():

    filtered_df = load_measurement_data().copy()

    total = len(filtered_df)

    CHANNEL_KEYWORDS = {
        "Email": ["email"],
        "SMS": ["sms"],
        "Push Notifications": ["push"],
        "WhatsApp": ["whatsapp"]
    }

    result = {}

    for channel, keywords in CHANNEL_KEYWORDS.items():

        count = filtered_df["channel"].apply(
            lambda x: any(
                kw in str(x).lower()
                for kw in keywords
            )
        ).sum()

        percentage = round((count / total) * 100, 2) if total > 0 else 0

        result[channel] = f"{percentage:.2f}%"

    return jsonify(result)

# ==========================================================
# deliverfunnel
# ============================================================

@app.route("/api/copilot/journey/measurement/deliverfunnel", methods=["GET"])
def get_channel_metrics():
 
    filtered_df = load_measurement_data().copy()
    total = len(filtered_df)
 
    METRICS = {
        "sent":      ["sent"],
        "delivered": ["delivered"],
        "opened":    ["opened"],
        "clicked":   ["clicked"],
        "bounced":   ["bounced"],
    }
 
    result = {}
    for metric, keywords in METRICS.items():
        count = int(filtered_df["event_name"].apply(
            lambda x: any(kw in str(x).lower() for kw in keywords)
        ).sum())
        result[metric] = {
            "count":      count,
            "percentage": f"{round((count / total * 100), 2)}%" if total > 0 else "0%"
        }
 
    result["revenue"] = round(
        filtered_df["revenue"].fillna(0).sum(), 2
    ) if "revenue" in filtered_df.columns else 0
 
    return jsonify(result)
 

# =========================================================
# 2 Heatmap
# =========================================================

@app.route("/api/submission_rate", methods=["GET"])
def submission_rate():
    heatmap_df = load_measurement_data().copy()
    heatmap_df["event_ts"] = pd.to_datetime(
        heatmap_df["event_ts"],
        format="%d-%m-%Y %H:%M",
        errors="coerce",
    )

    # 1. By Channel
    by_channel = heatmap_df.groupby("channel").agg(
        delivered=("event_name", lambda x: (x == "delivered").sum()),
        submitted=("event_name", lambda x: (x == "submission").sum())
    ).reset_index()

    by_channel["submission_rate"] = (
        (by_channel["submitted"] / by_channel["delivered"]) * 100
    ).replace([float("inf"), -float("inf")], 0).fillna(0).round(2)

# Add % sign
    by_channel["submission_rate"] = by_channel["submission_rate"].astype(str) + "%"

    # 2. By Country
    by_country = heatmap_df.groupby("country_code").agg(
        delivered=("event_name", lambda x: (x == "delivered").sum()),
        submitted=("event_name", lambda x: (x == "submission").sum())
    ).reset_index()

    by_country["submission_rate"] = (
        (by_country["submitted"] / by_country["delivered"]) * 100
    ).replace([float("inf"), -float("inf")], 0).fillna(0).round(2)

# Add % sign
    by_country["submission_rate"] = by_country["submission_rate"].astype(str) + "%"

    # By Device
    by_device = heatmap_df.groupby("device_platform", dropna=False).agg(
        delivered=("event_name", lambda x: (x == "delivered").sum()),
        submitted=("event_name", lambda x: (x == "submission").sum())
    ).reset_index()

    by_device["submission_rate"] = (
        (by_device["submitted"] / by_device["delivered"]) * 100
    ).replace([float("inf"), -float("inf")], 0).fillna(0).round(2)

# Add % sign
    by_device["submission_rate"] = by_device["submission_rate"].astype(str) + "%"

    return jsonify({
        "by_channel": by_channel.to_dict(orient="records"),
        "by_country": by_country.to_dict(orient="records"),
        "by_device": by_device.to_dict(orient="records")
    })

# =========================================================
# 2 CAMPAIGN BREAKDOWN
# =========================================================
@app.route("/api/copilot/journey/measurement/generalcampaign", methods=["GET"])
def campaign_summary():
    df = load_measurement_data()
    result = df.groupby(
        ["campaign_id", "campaign_name"]
    ).agg(

        sent=("event_name",
              lambda x: ((x == "sent") &
                         (df.loc[x.index, "channel"] == "email")).sum()),

        delivered=("event_name",
                    lambda x: ((x == "delivered") &
                               (df.loc[x.index, "channel"] == "email")).sum()),

        opened=("event_name",
                 lambda x: ((x == "opened") &
                            (df.loc[x.index, "channel"] == "email")).sum()),

        clicked=("event_name",
                  lambda x: ((x == "clicked") &
                             (df.loc[x.index, "channel"] == "email")).sum()),

        unsubscribed=("event_name",
                       lambda x: ((x == "unsubscribed") &
                                  (df.loc[x.index, "channel"] == "email")).sum()),

        bounced=("event_name",
                  lambda x: ((x == "bounced") &
                             (df.loc[x.index, "channel"] == "email")).sum()),

        hard_bounce=("bounce_classification",
                     lambda x: (x == "hard").sum()),

        soft_bounce=("bounce_classification",
                     lambda x: (x == "soft").sum()),

        revenue=("revenue", "sum")

    ).reset_index()

    # Round revenue
    result["revenue"] = result["revenue"].round(2)

    # Campaign Status
    result["status"] = "Ended"

    # KPI Rates (  REMOVED *100)
    result["Email_delivery_rate"] = (
        (result["delivered"] / result["sent"])
    ).replace([float("inf")], 0).fillna(0).round(2)

    result["Email_open_rate"] = (
        (result["opened"] / result["delivered"])
    ).replace([float("inf")], 0).fillna(0).round(2)

    result["Email_click_rate"] = (
        (result["clicked"] / result["delivered"])
    ).replace([float("inf")], 0).fillna(0).round(2)

    result["Email_unsubscribed_rate"] = (
        (result["unsubscribed"] / result["delivered"])
    ).replace([float("inf")], 0).fillna(0).round(2)

    result["Email_bounce_rate"] = (
        (result["bounced"] / result["sent"])
    ).replace([float("inf")], 0).fillna(0).round(2)

    # Rate columns (kept for consistency; no formatting applied)
    rate_columns = [
        "Email_delivery_rate",
        "Email_open_rate",
        "Email_click_rate",
        "Email_unsubscribed_rate",
        "Email_bounce_rate"
    ]

    # ---------------------------------
    # RENAME COLUMNS
    # ---------------------------------
    result = result.rename(columns={
        "campaign_id": "Campaign id",
        "campaign_name": "Campaign Name",
        "sent": "Email sent",
        "delivered": "Email delivered",
        "opened": "Email opened",
        "clicked": "Email clicked",
        "unsubscribed": "Email unsubscribed",
        "bounced": "Email bounced",
        "hard_bounce": "Email hard bounce",
        "soft_bounce": "Email soft bounce"
    })

    response = {
        "total_campaigns": int(result.shape[0]),
        "data": result.to_dict(orient="records")
    }

    return jsonify(response)

# =========================================================
# 2.1 CAMPAIGN API
# =========================================================
@app.route("/api/copilot/journey/measurement/generalcampaign/<campaign_id>", methods=["GET"])
def get_campaign_kpis_by_name(campaign_id):

    try:
        df = load_measurement_data()

        # Case-insensitive filter
        filtered_df = df[
            df["campaign_id"].str.lower() == campaign_id.lower()
        ].copy()

        if filtered_df.empty:
            return jsonify({
                "error": f"Campaign '{campaign_id}' not found"
            }), 404

        # KPI aggregation
        result = filtered_df.groupby(
            ["campaign_id", "campaign_name"]
        ).agg(

            sent=("event_name",
                  lambda x: ((x == "sent") &
                             (filtered_df.loc[x.index, "channel"] == "email")).sum()),

            delivered=("event_name",
                        lambda x: ((x == "delivered") &
                                   (filtered_df.loc[x.index, "channel"] == "email")).sum()),

            opened=("event_name",
                     lambda x: ((x == "opened") &
                                (filtered_df.loc[x.index, "channel"] == "email")).sum()),

            clicked=("event_name",
                      lambda x: ((x == "clicked") &
                                 (filtered_df.loc[x.index, "channel"] == "email")).sum()),

            unsubscribed=("event_name",
                           lambda x: ((x == "unsubscribed") &
                                      (filtered_df.loc[x.index, "channel"] == "email")).sum()),

            bounced=("event_name",
                      lambda x: ((x == "bounced") &
                                 (filtered_df.loc[x.index, "channel"] == "email")).sum()),

            hard_bounce=("bounce_classification",
                         lambda x: (x == "hard").sum()),

            soft_bounce=("bounce_classification",
                         lambda x: (x == "soft").sum()),

            revenue=("revenue",
                     lambda x: round(x.fillna(0).sum(), 2)),

            campaign_end_date=("campaign_end_date", "max")

        ).reset_index()

        # Campaign status from end date
        today = pd.Timestamp.today().normalize()

        result["status"] = result["campaign_end_date"].apply(
            lambda x: "Live" if x >= today else "Ended"
        )

        # KPI Rates
        result["Email_delivery_rate"] = (
            (result["delivered"] / result["sent"])
        ).replace([float("inf")], 0).fillna(0).round(2)

        result["Email_open_rate"] = (
            (result["opened"] / result["delivered"])
        ).replace([float("inf")], 0).fillna(0).round(2)

        result["Email_click_rate"] = (
            (result["clicked"] / result["delivered"])
        ).replace([float("inf")], 0).fillna(0).round(2)

        result["Email_unsubscribed_rate"] = (
            (result["unsubscribed"] / result["delivered"])
        ).replace([float("inf")], 0).fillna(0).round(2)

        result["Email_bounce_rate"] = (
            (result["bounced"] / result["sent"])
        ).replace([float("inf")], 0).fillna(0).round(2)

        # Rename columns
        result = result.rename(columns={
            "campaign_id": "Campaign_id",
            "campaign_name": "Campaign name",
            "sent": "Email sent",
            "delivered": "Email delivered",
            "opened": "Email opened",
            "clicked": "Email clicked",
            "unsubscribed": "Email unsubscribed",
            "bounced": "Email bounced",
            "hard_bounce": "Email hard bounce",
            "soft_bounce": "Email soft bounce",
            "revenue": "revenue",
            "status": "status"
        })

        #   Remove helper column (ONLY ONCE)
        result = result.drop(columns=["campaign_end_date"])

        #   Replace NaN (ONLY ONCE)
        result = result.fillna(0)

        #   Return object directly
        # return jsonify(result.to_dict(orient="records"))
        data = result.to_dict(orient="records")
        return jsonify(data[0])

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500
    
# # =========================================================
# # 3 TREND API (LINE CHART)
# # =========================================================
@app.route("/api/copilot/journey/measurement/generaltrend", methods=["GET"])
def get_measurement_trend():

    filtered_df = load_measurement_data().copy()

    #   EXACT SAME NORMALIZATION
    filtered_df["event_name"] = filtered_df["event_name"].astype(str).str.lower().str.strip()
    filtered_df["channel"] = filtered_df["channel"].astype(str).str.lower().str.strip()
    filtered_df["event_ts"] = pd.to_datetime(filtered_df["event_ts"], errors="coerce")

    #   EXACT SAME FILTER (DO NOT CHANGE)
    email_df = filtered_df[filtered_df["channel"] == "email"].copy()

    #   Extract date AFTER filtering (important)
    email_df["date"] = email_df["event_ts"].dt.date

    #   SAME LOGIC (no changes)
    sent_df = email_df[email_df["event_name"] == "sent"]
    delivered_df = email_df[email_df["event_name"] == "delivered"]
    opened_df = email_df[email_df["event_name"] == "opened"]
    clicked_df = email_df[email_df["event_name"] == "clicked"]

    #   KEEP "date" column internally
    trend = pd.DataFrame({
        "date": email_df["date"].drop_duplicates()
    })

    trend["Email sent"] = trend["date"].map(sent_df["date"].value_counts()).fillna(0).astype(int)
    trend["Email delivered"] = trend["date"].map(delivered_df["date"].value_counts()).fillna(0).astype(int)
    trend["Email opened"] = trend["date"].map(opened_df["date"].value_counts()).fillna(0).astype(int)
    trend["Email clicked"] = trend["date"].map(clicked_df["date"].value_counts()).fillna(0).astype(int)

    #   Revenue logic unchanged
    revenue_df = email_df.groupby("date")["revenue"].sum().fillna(0).round(2)
    trend["Revenue"] = trend["date"].map(revenue_df).fillna(0)

    #   Sort (must still use "date")
    trend = trend.sort_values("date")

    #   Convert date to string
    trend["date"] = pd.to_datetime(trend["date"]).dt.strftime("%a, %d %b %Y 00:00:00 GMT")

    #   Rename ONLY at the end
    trend = trend.rename(columns={
        "date": "Email sent date",
        "Revenue": "revenue"
    })

    return jsonify(trend.to_dict(orient="records"))
# # =========================================================
# # 3.1 Campaign Level General Trend
# # =========================================================

@app.route("/api/copilot/journey/measurement/generaltrend/<campaign_id>", methods=["GET"])
def get_measurement_trend_by_campaign(campaign_id):

    filtered_df = load_measurement_data().copy()

    #   SAME NORMALIZATION AS WORKING API
    filtered_df["campaign_id"] = filtered_df["campaign_id"].astype(str).str.lower().str.strip()
    filtered_df["event_name"] = filtered_df["event_name"].astype(str).str.lower().str.strip()
    filtered_df["channel"] = filtered_df["channel"].astype(str).str.lower().str.strip()
    filtered_df["event_ts"] = pd.to_datetime(filtered_df["event_ts"], errors="coerce")

    #   FILTER CAMPAIGN (STRICT)
    filtered_df = filtered_df[
        filtered_df["campaign_id"] == campaign_id.lower().strip()
    ].copy()

    if filtered_df.empty:
        return jsonify({"error": f"Campaign '{campaign_id}' not found"}), 404

    #   SAME FILTER AS SUMMARY (DO NOT CHANGE)
    email_df = filtered_df[filtered_df["channel"] == "email"].copy()

    #   CREATE DATE AFTER FILTERING
    email_df["date"] = email_df["event_ts"].dt.date

    #   STRICT COUNTING (NO GROUP LAMBDA)
    sent_df = email_df[email_df["event_name"] == "sent"]
    delivered_df = email_df[email_df["event_name"] == "delivered"]
    opened_df = email_df[email_df["event_name"] == "opened"]
    clicked_df = email_df[email_df["event_name"] == "clicked"]

    #   BUILD BASE DATE FRAME
    trend = pd.DataFrame({
        "date": email_df["date"].drop_duplicates()
    })
    #   ADD campaign_id and Campaign Name (constant per campaign)
    campaign_id_value = filtered_df["campaign_id"].iloc[0]
    campaign_name_value = filtered_df["campaign_name"].iloc[0]

    #   COUNTS
    trend["campaign_id"] = campaign_id_value
    trend["Campaign Name"] = campaign_name_value
    trend["Email sent"] = trend["date"].map(sent_df["date"].value_counts()).fillna(0).astype(int)
    trend["Email delivered"] = trend["date"].map(delivered_df["date"].value_counts()).fillna(0).astype(int)
    trend["Email opened"] = trend["date"].map(opened_df["date"].value_counts()).fillna(0).astype(int)
    trend["Email clicked"] = trend["date"].map(clicked_df["date"].value_counts()).fillna(0).astype(int)

    #   REVENUE (unchanged)
    valid_events = ["sent", "delivered", "opened", "clicked"]

    revenue_df = email_df[
        email_df["event_name"].isin(valid_events)
    ].groupby("date")["revenue"].sum().fillna(0).round(2)

    trend["Revenue"] = trend["date"].map(revenue_df).fillna(0)

    

   

    #   SORT
    trend = trend.sort_values("date")

    #   FORMAT DATE (GMT format)
    trend["date"] = pd.to_datetime(trend["date"]).dt.strftime("%a, %d %b %Y 00:00:00 GMT")

    #   RENAME OUTPUT KEYS (LAST STEP)
    trend = trend.rename(columns={
        "date": "Email sent date",
        "Revenue": "revenue"
    })

    return jsonify(trend.to_dict(orient="records"))

# =========================================================
# 4 DISTRIBUTION API (PIE CHART)
# =========================================================
@app.route("/api/copilot/journey/measurement/generaldistribution", methods=["GET"])
def get_measurement_distribution():

    filtered_df = load_measurement_data().copy()

    # Normalize values
    filtered_df["event_name"] = filtered_df["event_name"].astype(str).str.lower().str.strip()
    filtered_df["channel"] = filtered_df["channel"].astype(str).str.lower().str.strip()

    # Only email channel
    email_df = filtered_df[filtered_df["channel"] == "email"].copy()

    # Counts
    Email_clicked = (email_df["event_name"] == "clicked").sum()
    Email_opened = (email_df["event_name"] == "opened").sum()
    Email_unsubscribed = (email_df["event_name"] == "unsubscribed").sum()
    Email_bounced = (email_df["event_name"] == "bounced").sum()

    return jsonify([
        {
            "metric": "Email clicked",
            "value": int(Email_clicked)
        },
        {
            "metric": "Email opened",
            "value": int(Email_opened)
        },
        {
            "metric": "Email unsubscribed",
            "value": int(Email_unsubscribed)
        },
        {
            "metric": "Email bounced",
            "value": int(Email_bounced)
        }
    ])

# =========================================================
# 4.1 DISTRIBUTION API BY CAMPAIGN (PIE CHART)
# =========================================================
@app.route("/api/copilot/journey/measurement/generaldistribution/<campaign_id>", methods=["GET"])
def get_measurement_distribution_by_campaign(campaign_id):

    filtered_df = load_measurement_data().copy()

    filtered_df["campaign_id"] = filtered_df["campaign_id"].astype(str).str.lower().str.strip()
    filtered_df["event_name"] = filtered_df["event_name"].astype(str).str.lower().str.strip()
    filtered_df["channel"] = filtered_df["channel"].astype(str).str.lower().str.strip()

    filtered_df = filtered_df[
        filtered_df["campaign_id"] == campaign_id.lower().strip()
    ].copy()

    if filtered_df.empty:
        return jsonify({"error": f"Campaign '{campaign_id}' not found"}), 404

    email_df = filtered_df[filtered_df["channel"] == "email"].copy()

    #   EXISTING LOGIC (unchanged)
    Email_sent = (email_df["event_name"] == "sent").sum()
    Email_delivered = (email_df["event_name"] == "delivered").sum()
    Email_opened = (email_df["event_name"] == "opened").sum()
    Email_clicked = (email_df["event_name"] == "clicked").sum()
    Email_unsubscribed = (email_df["event_name"] == "unsubscribed").sum()
    Email_bounced = (email_df["event_name"] == "bounced").sum()

    revenue = email_df["revenue"].fillna(0).sum() if "revenue" in email_df.columns else 0

    def safe_div(n, d):
        return n / d if d != 0 else 0

    Open_Rate = safe_div(Email_opened, Email_delivered)
    CTR = safe_div(Email_clicked, Email_delivered)
    Unsubscribe_Rate = safe_div(Email_unsubscribed, Email_delivered)

    #   GET Campaign Name (no logic change)
    campaign_name = filtered_df["campaign_name"].iloc[0]

    return jsonify([
        {
            "Campaign ID": campaign_id,
            "Campaign Name": campaign_name,

            "Emails Sent": int(Email_sent),
            "Emails Delivered": int(Email_delivered),
            "Emails Opened": int(Email_opened),
            "Emails Clicked": int(Email_clicked),
            "Unsubscribed": int(Email_unsubscribed),
            "Bounced": int(Email_bounced),

            "Revenue": round(float(revenue), 2),

            #   FORMAT AS %
            "Open Rate": "{:.2f}%".format(Open_Rate * 100),
            "CTR": "{:.2f}%".format(CTR * 100),
            "Unsubscribe Rate": "{:.2f}%".format(Unsubscribe_Rate * 100)
        }
    ])
# =========================================================
# MERGED: Measurement Listing (replaces 7 calls)
# =========================================================
@app.route("/api/copilot/journey/measurement/listing", methods=["GET"])
def get_measurement_listing():

    filtered_df = load_measurement_data().copy()
    filtered_df["event_name"] = filtered_df["event_name"].astype(str).str.lower().str.strip()
    filtered_df["channel"] = filtered_df["channel"].astype(str).str.lower().str.strip()
    filtered_df["event_ts"] = pd.to_datetime(filtered_df["event_ts"], errors="coerce")
    email_df = filtered_df[filtered_df["channel"] == "email"].copy()

    def safe_div(n, d):
        return n / d if d != 0 else 0

    # ── Summary ──────────────────────────────────────────
    Email_sent         = (email_df["event_name"] == "sent").sum()
    Email_delivered    = (email_df["event_name"] == "delivered").sum()
    Email_opened       = (email_df["event_name"] == "opened").sum()
    Email_clicked      = (email_df["event_name"] == "clicked").sum()
    Email_unsubscribed = (email_df["event_name"] == "unsubscribed").sum()
    Email_bounced      = (email_df["event_name"] == "bounced").sum()
    revenue            = email_df["revenue"].fillna(0).sum() if "revenue" in email_df.columns else 0

    max_date       = email_df["event_ts"].max()
    last_week_df   = email_df[(email_df["event_ts"] > max_date - pd.Timedelta(days=7))  & (email_df["event_ts"] <= max_date)]
    prev_week_df   = email_df[(email_df["event_ts"] > max_date - pd.Timedelta(days=14)) & (email_df["event_ts"] <= max_date - pd.Timedelta(days=7))]

    def compute_kpis(d):
        s = (d["event_name"] == "sent").sum()
        dl = (d["event_name"] == "delivered").sum()
        return {
            "Email_delivery_rate":  safe_div(dl, s),
            "Email_open_rate":      safe_div((d["event_name"] == "opened").sum(), dl),
            "Click_Percentage":     safe_div((d["event_name"] == "clicked").sum(), dl),
            "Bounce_Rate":          safe_div((d["event_name"] == "bounced").sum(), s),
            "Unsubscribed_rate":    safe_div((d["event_name"] == "unsubscribed").sum(), dl),
        }

    lk = compute_kpis(last_week_df)
    pk = compute_kpis(prev_week_df)
    pct = lambda c, p: ((c - p) / p * 100) if p != 0 else 0

    summary = {
        "Email_sent": int(Email_sent),
        "Email_delivered": int(Email_delivered),
        "Email_delivery_rate": round(safe_div(Email_delivered, Email_sent) * 100, 2),
        "Email_delivery_growth_percent": round(pct(lk["Email_delivery_rate"], pk["Email_delivery_rate"]), 2),
        "Email_opened": int(Email_opened),
        "Email_open_rate": round(safe_div(Email_opened, Email_delivered) * 100, 2),
        "Email_open_growth_percent": round(pct(lk["Email_open_rate"], pk["Email_open_rate"]), 2),
        "Email_clicked": int(Email_clicked),
        "Email_Click_percentage": round(safe_div(Email_clicked, Email_delivered) * 100, 2),
        "Click_percentage_growth_percent": round(pct(lk["Click_Percentage"], pk["Click_Percentage"]), 2),
        "Email_unsubscribed": int(Email_unsubscribed),
        "Emails_unsubscribed_rate": round(safe_div(Email_unsubscribed, Email_delivered) * 100, 2),
        "Unsubscribed_growth_percent": round(pct(lk["Unsubscribed_rate"], pk["Unsubscribed_rate"]), 2),
        "Email_Bounced": int(Email_bounced),
        "Email_Bounce_rate": round(safe_div(Email_bounced, Email_sent) * 100, 2),
        "Bounce_growth_percent": round(pct(lk["Bounce_Rate"], pk["Bounce_Rate"]), 2),
        "revenue": round(float(revenue), 2),
        "Email_channel_percent": round(float((filtered_df["channel"] == "email").sum() / len(filtered_df) * 100), 2) if len(filtered_df) else 0,
        "SMS_channel_percent":   round(float((filtered_df["channel"] == "sms").sum()   / len(filtered_df) * 100), 2) if len(filtered_df) else 0,
        "Notification_channel_percent": round(float((filtered_df["channel"] == "notification").sum() / len(filtered_df) * 100), 2) if len(filtered_df) else 0,
    }

    # ── Campaign list ─────────────────────────────────────
    camp = filtered_df.groupby(["campaign_id", "campaign_name"]).agg(
        sent=("event_name", lambda x: ((x == "sent") & (filtered_df.loc[x.index, "channel"] == "email")).sum()),
        delivered=("event_name", lambda x: ((x == "delivered") & (filtered_df.loc[x.index, "channel"] == "email")).sum()),
        opened=("event_name", lambda x: ((x == "opened") & (filtered_df.loc[x.index, "channel"] == "email")).sum()),
        clicked=("event_name", lambda x: ((x == "clicked") & (filtered_df.loc[x.index, "channel"] == "email")).sum()),
        unsubscribed=("event_name", lambda x: ((x == "unsubscribed") & (filtered_df.loc[x.index, "channel"] == "email")).sum()),
        bounced=("event_name", lambda x: ((x == "bounced") & (filtered_df.loc[x.index, "channel"] == "email")).sum()),
        hard_bounce=("bounce_classification", lambda x: (x == "hard").sum()),
        soft_bounce=("bounce_classification", lambda x: (x == "soft").sum()),
        revenue=("revenue", "sum"),
    ).reset_index()
    camp["status"] = "Ended"
    camp["Email_delivery_rate"]    = (camp["delivered"] / camp["sent"]).replace(float("inf"), 0).fillna(0).round(2)
    camp["Email_open_rate"]        = (camp["opened"] / camp["delivered"]).replace(float("inf"), 0).fillna(0).round(2)
    camp["Email_click_rate"]       = (camp["clicked"] / camp["delivered"]).replace(float("inf"), 0).fillna(0).round(2)
    camp["Email_unsubscribed_rate"]= (camp["unsubscribed"] / camp["delivered"]).replace(float("inf"), 0).fillna(0).round(2)
    camp["Email_bounce_rate"]      = (camp["bounced"] / camp["sent"]).replace(float("inf"), 0).fillna(0).round(2)
    camp["revenue"] = camp["revenue"].round(2)
    campaigns = camp.rename(columns={
        "campaign_id": "Campaign id", "campaign_name": "Campaign Name",
        "sent": "Email sent", "delivered": "Email delivered",
        "opened": "Email opened", "clicked": "Email clicked",
        "unsubscribed": "Email unsubscribed", "bounced": "Email bounced",
        "hard_bounce": "Email hard bounce", "soft_bounce": "Email soft bounce",
    }).to_dict(orient="records")

    # ── Trend ─────────────────────────────────────────────
    email_df["date"] = email_df["event_ts"].dt.date
    trend_base = pd.DataFrame({"date": email_df["date"].drop_duplicates()})
    for evt, col in [("sent","Email sent"),("delivered","Email delivered"),("opened","Email opened"),("clicked","Email clicked")]:
        trend_base[col] = trend_base["date"].map(email_df[email_df["event_name"]==evt]["date"].value_counts()).fillna(0).astype(int)
    if "revenue" in email_df.columns:
        trend_base["revenue"] = trend_base["date"].map(email_df.groupby("date")["revenue"].sum()).fillna(0)
    trend_base = trend_base.sort_values("date")
    trend_base["date"] = pd.to_datetime(trend_base["date"]).dt.strftime("%a, %d %b %Y 00:00:00 GMT")
    trend = trend_base.rename(columns={"date": "Email sent date"}).to_dict(orient="records")

    # ── Distribution ──────────────────────────────────────
    distribution = [
        {"metric": "Email clicked",      "value": int((email_df["event_name"] == "clicked").sum())},
        {"metric": "Email opened",       "value": int((email_df["event_name"] == "opened").sum())},
        {"metric": "Email unsubscribed", "value": int((email_df["event_name"] == "unsubscribed").sum())},
        {"metric": "Email bounced",      "value": int((email_df["event_name"] == "bounced").sum())},
    ]

    # ── Channel mix ───────────────────────────────────────
    total = len(filtered_df)
    channel_mix = {
        "Email":             f"{round((filtered_df['channel'].str.contains('email')).sum() / total * 100, 2)}%" if total else "0%",
        "SMS":               f"{round((filtered_df['channel'].str.contains('sms')).sum()   / total * 100, 2)}%" if total else "0%",
        "Push Notifications":f"{round((filtered_df['channel'].str.contains('push')).sum()  / total * 100, 2)}%" if total else "0%",
        "WhatsApp":          f"{round((filtered_df['channel'].str.contains('whatsapp')).sum() / total * 100, 2)}%" if total else "0%",
    }

    # ── Delivery funnel ───────────────────────────────────
    funnel = {}
    for metric in ["sent", "delivered", "opened", "clicked", "bounced"]:
        count = int((filtered_df["event_name"] == metric).sum())
        funnel[metric] = {"count": count, "percentage": f"{round(count / total * 100, 2)}%" if total else "0%"}
    if "revenue" in filtered_df.columns:
        funnel["revenue"] = round(filtered_df["revenue"].fillna(0).sum(), 2)

    # ── Submission rate ───────────────────────────────────
    hdf = load_measurement_data().copy()
    hdf["event_ts"] = pd.to_datetime(hdf["event_ts"], format="%d-%m-%Y %H:%M", errors="coerce")

    def sub_rate(group_col):
        g = hdf.groupby(group_col).agg(
            delivered=("event_name", lambda x: (x == "delivered").sum()),
            submitted=("event_name", lambda x: (x == "submission").sum()),
        ).reset_index()
        g["submission_rate"] = ((g["submitted"] / g["delivered"]) * 100).replace([float("inf"), -float("inf")], 0).fillna(0).round(2).astype(str) + "%"
        return g.to_dict(orient="records")

    submission = {
        "by_channel": sub_rate("channel"),
        "by_country": sub_rate("country_code"),
        "by_device":  sub_rate("device_platform"),
    }

    return jsonify({
        "summary":      summary,
        "campaigns":    {"total_campaigns": len(campaigns), "data": campaigns},
        "trend":        trend,
        "distribution": distribution,
        "channel_mix":  channel_mix,
        "funnel":       funnel,
        "submission":   submission,
    })


# =========================================================
# MERGED: Measurement Detail (replaces 3 calls)
# =========================================================
@app.route("/api/copilot/journey/measurement/detail/<campaign_id>", methods=["GET"])
def get_measurement_detail(campaign_id):

    filtered_df = load_measurement_data().copy()
    filtered_df["campaign_id"] = filtered_df["campaign_id"].astype(str).str.lower().str.strip()
    filtered_df["event_name"]  = filtered_df["event_name"].astype(str).str.lower().str.strip()
    filtered_df["channel"]     = filtered_df["channel"].astype(str).str.lower().str.strip()
    filtered_df["event_ts"]    = pd.to_datetime(filtered_df["event_ts"], errors="coerce")
    filtered_df["campaign_end_date"] = pd.to_datetime(filtered_df["campaign_end_date"], format="%d-%m-%Y", errors="coerce")

    cdf = filtered_df[filtered_df["campaign_id"] == campaign_id.lower().strip()].copy()
    if cdf.empty:
        return jsonify({"error": f"Campaign '{campaign_id}' not found"}), 404

    email_df = cdf[cdf["channel"] == "email"].copy()

    def safe_div(n, d):
        return n / d if d != 0 else 0

    # ── Campaign KPIs ─────────────────────────────────────
    s  = (email_df["event_name"] == "sent").sum()
    dl = (email_df["event_name"] == "delivered").sum()
    o  = (email_df["event_name"] == "opened").sum()
    cl = (email_df["event_name"] == "clicked").sum()
    un = (email_df["event_name"] == "unsubscribed").sum()
    bo = (email_df["event_name"] == "bounced").sum()
    hb = (cdf["bounce_classification"] == "hard").sum()
    sb = (cdf["bounce_classification"] == "soft").sum()
    rev = round(email_df["revenue"].fillna(0).sum(), 2) if "revenue" in email_df.columns else 0
    end_date = cdf["campaign_end_date"].max()
    status = "Live" if pd.notna(end_date) and end_date >= pd.Timestamp.today().normalize() else "Ended"

    campaign_kpis = {
        "Campaign_id":          campaign_id,
        "Campaign name":        cdf["campaign_name"].iloc[0],
        "status":               status,
        "Email sent":           int(s),
        "Email delivered":      int(dl),
        "Email opened":         int(o),
        "Email clicked":        int(cl),
        "Email unsubscribed":   int(un),
        "Email bounced":        int(bo),
        "Email hard bounce":    int(hb),
        "Email soft bounce":    int(sb),
        "revenue":              rev,
        "Email_delivery_rate":  round(safe_div(dl, s), 2),
        "Email_open_rate":      round(safe_div(o, dl), 2),
        "Email_click_rate":     round(safe_div(cl, dl), 2),
        "Email_unsubscribed_rate": round(safe_div(un, dl), 2),
        "Email_bounce_rate":    round(safe_div(bo, s), 2),
        "Open Rate":            "{:.2f}%".format(safe_div(o, dl) * 100),
        "CTR":                  "{:.2f}%".format(safe_div(cl, dl) * 100),
        "Unsubscribe Rate":     "{:.2f}%".format(safe_div(un, dl) * 100),
    }

    # ── Trend ─────────────────────────────────────────────
    email_df["date"] = email_df["event_ts"].dt.date
    trend_base = pd.DataFrame({"date": email_df["date"].drop_duplicates()})
    trend_base["campaign_id"]   = cdf["campaign_id"].iloc[0]
    trend_base["Campaign Name"] = cdf["campaign_name"].iloc[0]
    for evt, col in [("sent","Email sent"),("delivered","Email delivered"),("opened","Email opened"),("clicked","Email clicked")]:
        trend_base[col] = trend_base["date"].map(email_df[email_df["event_name"]==evt]["date"].value_counts()).fillna(0).astype(int)
    if "revenue" in email_df.columns:
        trend_base["revenue"] = trend_base["date"].map(
            email_df[email_df["event_name"].isin(["sent","delivered","opened","clicked"])].groupby("date")["revenue"].sum()
        ).fillna(0)
    trend_base = trend_base.sort_values("date")
    trend_base["date"] = pd.to_datetime(trend_base["date"]).dt.strftime("%a, %d %b %Y 00:00:00 GMT")
    trend = trend_base.rename(columns={"date": "Email sent date"}).to_dict(orient="records")

    # ── Distribution ──────────────────────────────────────
    distribution = [{
        "Campaign ID":   campaign_id,
        "Campaign Name": cdf["campaign_name"].iloc[0],
        "Emails Sent":        int(s),
        "Emails Delivered":   int(dl),
        "Emails Opened":      int(o),
        "Emails Clicked":     int(cl),
        "Unsubscribed":       int(un),
        "Bounced":            int(bo),
        "Revenue":            rev,
        "Open Rate":          "{:.2f}%".format(safe_div(o, dl) * 100),
        "CTR":                "{:.2f}%".format(safe_div(cl, dl) * 100),
        "Unsubscribe Rate":   "{:.2f}%".format(safe_div(un, dl) * 100),
    }]

    return jsonify({
        "campaign":     campaign_kpis,
        "trend":        trend,
        "distribution": distribution,
    })


_FRONTEND_ASSET_PATTERN = re.compile(r"""(?:src|href)=["'](/?assets/[^"'?#]+)""")


def _frontend_bundle_missing_files(directory):
    """Return files referenced by index.html that are absent from the bundle."""
    index_path = directory / "index.html"
    if not index_path.is_file():
        return ["index.html"]
    try:
        index_html = index_path.read_text(encoding="utf-8")
    except OSError:
        return ["index.html"]
    referenced_assets = {
        asset_path.lstrip("/")
        for asset_path in _FRONTEND_ASSET_PATTERN.findall(index_html)
    }
    return sorted(
        relative_path
        for relative_path in referenced_assets
        if not (directory / relative_path).is_file()
    )


def _frontend_dist_candidates():
    """Return supported bundle locations for local and Databricks source layouts."""
    configured = get_directory("frontend_dist")
    override = os.getenv("CODEX_FRONTEND_DIST", "").strip()
    candidates = []
    if override:
        override_path = Path(override)
        candidates.append(override_path if override_path.is_absolute() else ROOT / override_path)
    candidates.extend(
        [
            configured,
            ROOT / "dist",
            ROOT.parent / "dist",
            Path.cwd() / "dist",
            Path.cwd() / "Source-Code" / "dist",
        ]
    )

    unique_candidates = []
    seen = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique_candidates.append(resolved)
    return unique_candidates


def _resolve_frontend_dist():
    diagnostics = {}
    for candidate in _frontend_dist_candidates():
        missing = _frontend_bundle_missing_files(candidate)
        diagnostics[str(candidate)] = missing
        if not missing:
            return candidate, [], diagnostics

    configured = get_directory("frontend_dist").resolve()
    return configured, diagnostics.get(str(configured), ["index.html"]), diagnostics


FRONTEND_DIST, FRONTEND_BUNDLE_MISSING, FRONTEND_BUNDLE_DIAGNOSTICS = _resolve_frontend_dist()
if FRONTEND_BUNDLE_MISSING:
    print(
        "Frontend bundle is incomplete. "
        f"Selected={FRONTEND_DIST}; missing={FRONTEND_BUNDLE_MISSING}; "
        f"searched={list(FRONTEND_BUNDLE_DIAGNOSTICS)}"
    )
else:
    print(f"Frontend bundle ready: {FRONTEND_DIST}")


def _frontend_unavailable():
    return jsonify(
        {
            "error": "Frontend bundle is incomplete",
            "missing": FRONTEND_BUNDLE_MISSING,
            "frontend_dist": str(FRONTEND_DIST),
        }
    ), 503


def _serve_frontend_index():
    if FRONTEND_BUNDLE_MISSING:
        return _frontend_unavailable()
    response = send_from_directory(FRONTEND_DIST, "index.html")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response


@app.get("/")
def serve_index():
    return _serve_frontend_index()


@app.get("/assets/<path:filename>")
def serve_assets(filename):
    if FRONTEND_BUNDLE_MISSING:
        return _frontend_unavailable()
    response = send_from_directory(FRONTEND_DIST / "assets", filename, max_age=31536000)
    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


@app.get("/<path:frontend_path>")
def serve_frontend(frontend_path):
    if frontend_path.startswith("api/"):
        return jsonify({"error": "API endpoint not found"}), 404

    requested_file = FRONTEND_DIST / frontend_path
    if requested_file.is_file():
        return send_from_directory(FRONTEND_DIST, frontend_path)

    return _serve_frontend_index()


print(
    f"[STARTUP] WSGI application ready in "
    f"{time.perf_counter() - _STARTUP_STARTED:.1f}s.",
    flush=True,
)


if __name__ == "__main__":
    print(f"Unified EXL CDP backend starting... ROOT={ROOT}")
    app.run(
        host="0.0.0.0",
        debug=False,
        port=int(os.getenv("DATABRICKS_APP_PORT", os.getenv("PORT", "8000"))),
        use_reloader=False,
    )
