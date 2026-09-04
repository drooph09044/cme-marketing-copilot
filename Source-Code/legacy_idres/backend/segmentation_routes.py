"""
segmentation_routes.py
AI Segmentation Blueprint — plugs into app.py

Register in app.py:
    from segmentation_routes import segmentation_bp
    app.register_blueprint(segmentation_bp)

Endpoints:
    POST /api/segment/generate   — NL query → rule tree → execute → save
    GET  /api/segment/list       — list all saved AI segments
    GET  /api/segment/<id>       — get single segment JSON
    GET  /api/segment/schema     — get schema for a domain (for frontend)
"""

import io
import json
import os
import sys
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from flask import Blueprint, current_app, request, jsonify
from segment_lifecycle import SegmentLifecycleStore

# ── Paths ─────────────────────────────────────────────────────
_THIS_FILE  = Path(__file__).resolve()
_BACKEND    = _THIS_FILE.parent                        # backend/
_ROOT       = _BACKEND.parent                          # legacy_idres/
_SEG_DIR    = _ROOT / "Segmentation"               # segmentation folder
_SEGS_SAVE  = _ROOT / "data" / "ai_segments"          # saved segments
_SEGMENT_LIFECYCLE = SegmentLifecycleStore(
    _BACKEND / "copilot_segments.json",
    _SEGS_SAVE,
    default_source="media",
)

# Add segmentation folder to path so imports work
if str(_SEG_DIR) not in sys.path:
    sys.path.insert(0, str(_SEG_DIR))

# Schema paths
STREAMING_SCHEMA_PATH  = _SEG_DIR / "schema.json"
AUTOMOTIVE_SCHEMA_PATH = _SEG_DIR / "automotive_schema.json"

segmentation_bp = Blueprint("segmentation", __name__)
_SEGMENT_JOBS = {}
_SEGMENT_JOBS_LOCK = threading.Lock()
_SEGMENT_JOB_SLOTS = threading.BoundedSemaphore(
    max(1, min(int(os.getenv("CODEX_SEGMENT_JOB_WORKERS", "2")), 4))
)
_SEGMENT_JOB_TTL_SECONDS = max(
    300,
    int(os.getenv("CODEX_SEGMENT_JOB_TTL_SECONDS", "1800")),
)


# ── Helpers ───────────────────────────────────────────────────
def _load_schema(domain: str) -> dict:
    path = (
        AUTOMOTIVE_SCHEMA_PATH
        if domain == "automotive"
        else STREAMING_SCHEMA_PATH
    )
    # Schema files ship with the application code.  Databricks compatibility
    # redirects JSON data artifacts to Volumes, so use OS/io primitives here
    # to deliberately read this local code asset.
    if not os.path.isfile(path):
        raise FileNotFoundError(
            f"Schema not found: {path}. "
            f"Run {'automotive_' if domain == 'automotive' else ''}schema_generator.py first."
        )
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def _flatten_filters(node: dict, chips: list = None) -> list:
    """Convert rule tree to flat filter chips for frontend display."""
    if chips is None:
        chips = []
    if not node:
        return chips

    if "attribute" in node:
        op_map = {
            "EQ":          "=",
            "NEQ":         "≠",
            "IN":          "in",
            "CONTAINS":    "contains",
            "GT":          ">",
            "GTE":         "≥",
            "LT":          "<",
            "LTE":         "≤",
            "IN_LAST":     "in last",
            "NOT_IN_LAST": "not in last",
            "NOT_IN":      "not in",
            "BEFORE":      "before",
            "AFTER":       "after",
        }
        op  = op_map.get(node.get("operator", "EQ"), node.get("operator", ""))
        val = str(node.get("value", ""))
        if node.get("unit"):
            val = f"{val} {node['unit']}"

        chips.append({
            "attribute": node.get("attribute", ""),
            "operator":  op,
            "value":     val,
            "table":     node.get("table", ""),
            "label":     f"{node.get('attribute', '')} {op} {val}",
        })

    for c in node.get("conditions", []):
        _flatten_filters(c, chips)
    return chips


def _ai_error_response(exc: Exception):
    """Translate Gemini and response-format failures into stable JSON."""
    raw_status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    try:
        status = int(raw_status)
    except (TypeError, ValueError):
        status = 0

    error_upper = str(exc).upper()
    if (
        status in {429, 500, 502, 503, 504}
        or "UNAVAILABLE" in error_upper
        or "UPSTREAM" in error_upper
        or "TIMEOUT" in error_upper
        or "TIMED OUT" in error_upper
        or "DEADLINE_EXCEEDED" in error_upper
        or "HIGH DEMAND" in error_upper
        or "RESOURCE_EXHAUSTED" in error_upper
    ):
        return jsonify(
            {
                "error": "The AI service is temporarily unavailable. Please try again shortly.",
                "code": "AI_UPSTREAM_UNAVAILABLE",
                "retryable": True,
            }
        ), 503

    if isinstance(exc, (json.JSONDecodeError, ValueError)):
        return jsonify(
            {
                "error": "The AI service returned an invalid segment definition. Please try again.",
                "code": "AI_RESPONSE_INVALID",
                "retryable": True,
            }
        ), 502

    if isinstance(exc, EnvironmentError):
        return jsonify(
            {
                "error": "The Gemini API key is not configured for this application.",
                "code": "AI_NOT_CONFIGURED",
                "retryable": False,
            }
        ), 503

    return jsonify(
        {
            "error": "Unable to generate the segment with AI.",
            "code": "AI_GENERATION_FAILED",
            "retryable": False,
        }
    ), 502


# ── Routes ────────────────────────────────────────────────────

def _cleanup_segment_jobs(now=None):
    now = float(now or time.time())
    with _SEGMENT_JOBS_LOCK:
        expired = [
            job_id
            for job_id, job in _SEGMENT_JOBS.items()
            if now - float(job.get("updated_at_epoch") or now) > _SEGMENT_JOB_TTL_SECONDS
        ]
        for job_id in expired:
            _SEGMENT_JOBS.pop(job_id, None)


def _update_segment_job(job_id, **values):
    with _SEGMENT_JOBS_LOCK:
        job = _SEGMENT_JOBS.get(job_id)
        if job is None:
            return
        job.update(values)
        job["updated_at_epoch"] = time.time()


def _run_segment_job(flask_app, job_id, body):
    with _SEGMENT_JOB_SLOTS:
        started = time.perf_counter()
        _update_segment_job(job_id, status="running")
        try:
            # Recreate a request context for the existing implementation. The
            # browser request has already returned 202, so Gemini and UC work
            # cannot be cut off by the Databricks proxy request deadline.
            with flask_app.test_request_context(
                "/api/segment/generate?sync=1",
                method="POST",
                json=body,
            ):
                response = flask_app.make_response(_generate_segment_sync())
                payload = response.get_json(silent=True)
                if not isinstance(payload, dict):
                    payload = {
                        "error": "Segment generation returned an invalid response.",
                        "code": "SEGMENT_RESPONSE_INVALID",
                    }

            elapsed = round(time.perf_counter() - started, 2)
            if 200 <= response.status_code < 300 and not payload.get("error"):
                _update_segment_job(
                    job_id,
                    status="completed",
                    result=payload,
                    elapsed_seconds=elapsed,
                    http_status=200,
                )
            else:
                _update_segment_job(
                    job_id,
                    status="failed",
                    error=payload,
                    elapsed_seconds=elapsed,
                    http_status=response.status_code,
                )
        except Exception as exc:
            import traceback

            traceback.print_exc()
            _update_segment_job(
                job_id,
                status="failed",
                error={
                    "error": "Segment generation failed while processing the background job.",
                    "code": "SEGMENT_JOB_FAILED",
                    "details": str(exc),
                    "retryable": True,
                },
                elapsed_seconds=round(time.perf_counter() - started, 2),
                http_status=500,
            )


@segmentation_bp.route("/api/segment/generate", methods=["POST"])
def generate_segment():
    body = request.get_json(silent=True) or {}
    query = str(body.get("query") or "").strip()
    domain = str(body.get("domain") or "streaming").strip().lower()
    if not query:
        return jsonify({"error": "query is required"}), 400
    if domain not in ("streaming", "automotive"):
        return jsonify({"error": "domain must be 'streaming' or 'automotive'"}), 400

    async_requested = (
        request.args.get("async")
        or body.get("async")
        or ""
    )
    if str(async_requested).strip().lower() not in {"1", "true", "yes"}:
        return _generate_segment_sync()

    _cleanup_segment_jobs()
    job_id = uuid.uuid4().hex
    now = time.time()
    with _SEGMENT_JOBS_LOCK:
        _SEGMENT_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "created_at_epoch": now,
            "updated_at_epoch": now,
        }

    flask_app = current_app._get_current_object()
    threading.Thread(
        target=_run_segment_job,
        args=(flask_app, job_id, dict(body)),
        name=f"segment-job-{job_id[:8]}",
        daemon=True,
    ).start()
    return jsonify(
        {
            "job_id": job_id,
            "status": "queued",
            "status_url": f"/api/segment/generate/status/{job_id}",
            "message": "Segment generation started.",
        }
    ), 202


@segmentation_bp.route("/api/segment/generate/status/<job_id>", methods=["GET"])
def segment_generation_status(job_id):
    _cleanup_segment_jobs()
    with _SEGMENT_JOBS_LOCK:
        job = dict(_SEGMENT_JOBS.get(job_id) or {})
    if not job:
        return jsonify(
            {
                "error": "Segment generation job was not found or has expired.",
                "code": "SEGMENT_JOB_NOT_FOUND",
                "retryable": False,
            }
        ), 404

    status = job.get("status")
    if status in {"queued", "running"}:
        return jsonify(
            {
                "job_id": job_id,
                "status": status,
                "elapsed_seconds": round(
                    max(0.0, time.time() - float(job.get("created_at_epoch") or time.time())),
                    2,
                ),
            }
        ), 202
    if status == "completed":
        return jsonify(
            {
                "job_id": job_id,
                "status": "completed",
                "elapsed_seconds": job.get("elapsed_seconds", 0),
                "result": job.get("result") or {},
            }
        )

    error = dict(job.get("error") or {})
    error.update(
        {
            "job_id": job_id,
            "status": "failed",
            "elapsed_seconds": job.get("elapsed_seconds", 0),
        }
    )
    return jsonify(error), int(job.get("http_status") or 500)


def _generate_segment_sync():
    """
    POST /api/segment/generate
    Body: {
        "query":  "High LTV sports fans who haven't streamed in 60 days",
        "domain": "streaming" | "automotive",
        "name":   "optional custom name"
    }
    Returns: {
        segment_id, name, description, domain,
        count, filters (flat chips), root (full rule tree),
        sql_view, rows (sample 10), created_at
    }
    """
    try:
        body   = request.get_json() or {}
        query  = body.get("query", "").strip()
        domain = body.get("domain", "streaming").strip().lower()
        name   = body.get("name", "").strip()

        if not query:
            return jsonify({"error": "query is required"}), 400

        if domain not in ("streaming", "automotive"):
            return jsonify({"error": "domain must be 'streaming' or 'automotive'"}), 400
        source_system = _SEGMENT_LIFECYCLE.normalize_source(
            body.get("source_system") or body.get("sourceSystem"),
            "automotive" if domain == "automotive" else "media",
        )

        # Load schema
        try:
            schema = _load_schema(domain)
        except FileNotFoundError as e:
            return jsonify({"error": str(e)}), 503

        # Generate rule tree via Gemini
        from segment_generator_gemini import SegmentGenerator
        try:
            segment = SegmentGenerator(schema).generate(query)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            return _ai_error_response(exc)
        segment["domain"] = domain

        # Override name if provided
        if name:
            segment["name"] = name

        # Execute rule tree on data
        if domain == "automotive":
            from automotive_rule_engine import AutomotiveRuleEngine, clear_cache
            engine = AutomotiveRuleEngine()
        else:
            from rule_engine import RuleEngine, clear_cache
            engine = RuleEngine()

        # Reuse bounded source DataFrames across requests. Clearing on every
        # AI click forced the App to download the same UC tables repeatedly
        # and often pushed the request past the Databricks proxy timeout.
        if str(os.getenv("CODEX_SEGMENT_CLEAR_CACHE", "0")).lower() in {"1", "true", "yes"}:
            clear_cache()
        result = engine.execute(segment)

        # Generate SQL VIEW
        from sql_generator import SQLGenerator
        sql_view = SQLGenerator().generate(segment)

        # Flatten rule tree to filter chips for frontend
        filters = _flatten_filters(segment.get("root", {}))

        # Save outputs
        now = datetime.utcnow().isoformat() + "Z"
        sid = segment["segment_id"]
        _SEGS_SAVE.mkdir(parents=True, exist_ok=True)

        export_df = result.get("export_df")
        csv_rows  = 0
        if export_df is not None and not export_df.empty:
            # segmentation_uc_bootstrap writes this CSV to the configured UC
            # Volume in Databricks mode, bypassing table-style CSV routing.
            csv_path = _SEGS_SAVE / f"{sid}.csv"
            export_df.to_csv(csv_path, index=False)
            csv_rows = len(export_df)

        meta = {
            "segment_id":     sid,
            "name":           segment.get("name", ""),
            "description":    segment.get("description", ""),
            "query":          query,
            "domain":         domain,
            "source_system":  source_system,
            "root":           segment.get("root", {}),
            "sql_view":       sql_view,
            "count":          result["count"],
            "created_at":     now,
            "last_refreshed": now,
            "pipeline_status": body.get("pipeline_status") or "Draft",
            "activation_status": "inactive",
            "journey_builder_status": "not_published",
        }
        json_path = _SEGS_SAVE / f"{sid}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        # Clean sample rows (remove NaN)
        rows = []
        for row in result.get("rows", []):
            rows.append({
                k: (None if isinstance(v, float) and v != v else v)
                for k, v in row.items()
            })

        return jsonify({
            "segment_id":  sid,
            "name":        segment.get("name", ""),
            "description": segment.get("description", ""),
            "domain":      domain,
            "source_system": source_system,
            "count":       result["count"],
            "filters":     filters,
            "root":        segment.get("root", {}),
            "sql_view":    sql_view,
            "rows":        rows,
            "csv_rows":    csv_rows,
            "created_at":  now,
            "pipeline_status": meta["pipeline_status"],
            "activation_status": meta["activation_status"],
            "journey_builder_status": meta["journey_builder_status"],
            "warnings":    segment.get("validation_warnings", []),
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify(
            {
                "error": "Segment generation failed while processing or saving the result.",
                "code": "SEGMENT_PROCESSING_FAILED",
                "details": str(e),
            }
        ), 500


@segmentation_bp.route("/api/segment/list", methods=["GET"])
def list_segments():
    """
    GET /api/segment/list
    Optional: ?domain=streaming|automotive
    Returns list of all saved AI segments.
    """
    domain = request.args.get("domain", "").strip().lower()
    source_system = _SEGMENT_LIFECYCLE.normalize_source(
        request.args.get("source")
        or request.args.get("source_system")
        or request.args.get("sourceSystem"),
        "all",
    )
    segments = []

    segment_files = []
    for path in _SEGS_SAVE.glob("*.json"):
        try:
            segment_files.append((path.stat().st_mtime, path))
        except FileNotFoundError:
            # Volume listings can change between enumeration and stat.
            continue

    for _mtime, f in sorted(segment_files, key=lambda item: item[0], reverse=True):
        try:
            with open(f, encoding="utf-8") as fp:
                seg = json.load(fp)
            if domain and seg.get("domain", "streaming") != domain:
                continue
            seg = _SEGMENT_LIFECYCLE.present(seg, origin="AI custom segment")
            if (
                source_system != "all"
                and seg.get("source_system") not in {source_system, "all"}
            ):
                continue
            # Add flat filters for frontend display
            seg["filters"] = _flatten_filters(seg.get("root", {}))
            segments.append(seg)
        except Exception:
            continue

    return jsonify({"segments": segments, "total": len(segments)})


@segmentation_bp.route("/api/segment/<segment_id>", methods=["GET"])
def get_segment(segment_id):
    """
    GET /api/segment/<segment_id>
    Returns single segment JSON with filters and sample CSV rows.
    """
    json_path = _SEGS_SAVE / f"{segment_id}.json"
    if not json_path.exists():
        return jsonify({"error": "Segment not found"}), 404

    with open(json_path, encoding="utf-8") as f:
        seg = json.load(f)

    seg = _SEGMENT_LIFECYCLE.present(seg, origin="AI custom segment")
    seg["filters"] = _flatten_filters(seg.get("root", {}))

    # Load member samples from local storage or the configured UC Volume.
    csv_path = _SEGS_SAVE / f"{segment_id}.csv"
    if csv_path.exists():
        import csv
        rows = []
        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= 50:
                    break
                rows.append(row)
        seg["rows"]    = rows
        seg["columns"] = list(rows[0].keys()) if rows else []

    return jsonify(seg)


@segmentation_bp.route("/api/segment/schema", methods=["GET"])
def get_schema():
    """
    GET /api/segment/schema?domain=streaming|automotive
    Returns the schema for a domain (tables + columns).
    Useful for frontend to show available filters.
    """
    domain = request.args.get("domain", "streaming").strip().lower()
    try:
        schema = _load_schema(domain)
        return jsonify(schema)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503


@segmentation_bp.route("/api/segment/examples", methods=["GET"])
def get_examples():
    """
    GET /api/segment/examples?domain=streaming|automotive
    Returns example queries for the TRY AN EXAMPLE chips in frontend.
    """
    domain = request.args.get("domain", "streaming").strip().lower()

    examples = {
        "streaming": [
            "High LTV sports fans who haven't streamed in 60 days",
            "Active subscribers with high engagement watching kids content",
            "Lapsing customers with medium LTV likely to churn",
            "Low engagement subscribers who opened emails but never streamed",
            "Consented high value customers ready for email activation",
            "Inactive users with documentary or news affinity for win-back",
            "Find all potential Yankees fans",
            "Newsletter subscribers who haven't engaged in 90 days",
        ],
        "automotive": [
            "Find customers who have not replaced battery in 5 years",
            "Find customers with more than 50000 miles and no tire change",
            "Households with multiple vehicles",
            "Customers eligible for premium service upsell",
            "Customers who have not serviced vehicle in 9 months",
        ],
    }

    return jsonify({
        "domain":   domain,
        "examples": examples.get(domain, []),
    })
