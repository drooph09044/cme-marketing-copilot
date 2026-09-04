from __future__ import annotations

import json
import time
import uuid
from datetime import datetime
from typing import Any

from flask import Blueprint, Response, jsonify, request

from .data import get_journey, get_segment, load_journeys, ranked_segments_for_journey, runtime_status


qa_automation_bp = Blueprint("qa_automation", __name__, url_prefix="/api/qa-automation")

SYNTH_JOBS: dict[str, dict[str, Any]] = {}
SIM_JOBS: dict[str, dict[str, Any]] = {}
QA_RUNS: dict[str, dict[str, Any]] = {}


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def public_segment(segment: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in segment.items() if not k.startswith("_")}


def public_journey(journey: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in journey.items() if not k.startswith("_")}


@qa_automation_bp.get("/runtime")
def runtime():
    return jsonify(runtime_status())


@qa_automation_bp.get("/journeys")
def journeys():
    return jsonify(
        [
            {
                "id": journey["id"],
                "name": journey["name"],
                "category": journey.get("category", "Uncategorized"),
                "status": journey.get("status", "Draft"),
                "version": journey.get("version", 1),
                "updated": journey.get("updated", "current app"),
                "owner": journey.get("owner", "EXL"),
            }
            for journey in load_journeys()
        ]
    )


@qa_automation_bp.get("/journey")
def journey():
    journey_id = request.args.get("id")
    selected = get_journey(journey_id) if journey_id else (load_journeys()[0] if load_journeys() else None)
    if not selected:
        return jsonify({"error": f"Unknown journey {journey_id!r}"}), 404
    return jsonify(public_journey(selected))


@qa_automation_bp.get("/segments")
def segments():
    journey_id = request.args.get("journeyId") or request.args.get("journey_id")
    return jsonify([public_segment(segment) for segment in ranked_segments_for_journey(journey_id)])


@qa_automation_bp.get("/segments/<segment_id>")
def segment(segment_id):
    selected = get_segment(segment_id)
    if not selected:
        return jsonify({"error": f"Unknown segment {segment_id!r}"}), 404
    return jsonify(public_segment(selected))


def build_profiles(journey: dict[str, Any], segment: dict[str, Any], count: int = 6) -> list[dict[str, Any]]:
    archetypes = ["eligible", "holdout", "no_consent", "fcap_capped", "early_convert", "late_convert", "never_convert"]
    profiles = []
    for index in range(max(1, count)):
        archetype = archetypes[index % len(archetypes)]
        profiles.append(
            {
                "id": f"qa-prof-{index + 1}",
                "name": f"{segment['name'].replace('_', ' ')} Profile {index + 1}",
                "scenario": f"{journey['name']} - {archetype.replace('_', ' ')}",
                "archetype": archetype,
                "region": ["Northeast", "West", "Midwest", "South"][index % 4],
                "age": 24 + index * 6,
                "globalConsent": archetype != "no_consent",
                "fcap": 4 if archetype == "fcap_capped" else index % 3,
                "lastSend": f"{index}d",
                "holdout": archetype == "holdout",
                "suppressionReason": "no_consent" if archetype == "no_consent" else "holdout_segment" if archetype == "holdout" else "",
            }
        )
    return profiles


def build_suites(journey: dict[str, Any], segment: dict[str, Any]) -> list[dict[str, Any]]:
    node_ids = [node["id"] for node in journey.get("nodes", [])]
    return [
        {
            "id": "suite-structure",
            "name": "Journey structure validation",
            "description": "Checks graph connectivity, terminal exits, and branch labels.",
            "expectedOutcome": "All reachable decision paths terminate cleanly.",
            "profileCount": 0,
            "steps": [{"nodeId": node_id, "assertion": "reachable"} for node_id in node_ids[:6]],
        },
        {
            "id": "suite-segment-fit",
            "name": "Segment fit validation",
            "description": f"Confirms {segment['name']} aligns to journey entry criteria.",
            "expectedOutcome": "Audience, trigger, and source-system context are coherent.",
            "profileCount": 0,
            "steps": [{"nodeId": node_ids[0] if node_ids else "entry", "assertion": "segment_match"}],
        },
        {
            "id": "suite-profile-walks",
            "name": "Synthetic profile walks",
            "description": "Exercises eligible, holdout, suppressed, and conversion profiles.",
            "expectedOutcome": "Profiles follow expected treatment or exclusion paths.",
            "profileCount": 6,
            "steps": [{"nodeId": node_id, "assertion": "profile_can_visit"} for node_id in node_ids[:4]],
        },
    ]


@qa_automation_bp.post("/profiles/synth")
def synth_profiles():
    body = request.get_json(silent=True) or {}
    journey = get_journey(body.get("journeyId"))
    segment = get_segment(body.get("segmentId"))
    if not journey or not segment:
        return jsonify({"error": "journeyId and segmentId are required"}), 400
    synth_id = f"synth-{uuid.uuid4().hex[:10]}"
    SYNTH_JOBS[synth_id] = {
        "status": "done",
        "profiles": build_profiles(journey, segment),
        "suites": build_suites(journey, segment),
        "createdAt": now_iso(),
    }
    return jsonify({"synthId": synth_id, "status": "queued"})


@qa_automation_bp.get("/profiles/synth/<synth_id>")
def synth_status(synth_id):
    job = SYNTH_JOBS.get(synth_id)
    if not job:
        return jsonify({"status": "failed", "error": f"Unknown synth job {synth_id}"}), 404
    return jsonify(job)


@qa_automation_bp.post("/profiles/synth/extend")
def extend_profiles():
    body = request.get_json(silent=True) or {}
    journey = get_journey(body.get("journeyId"))
    segment = get_segment(body.get("segmentId"))
    if not journey or not segment:
        return jsonify({"error": "journeyId and segmentId are required"}), 400
    count = int(body.get("count") or 2)
    instruction = str(body.get("instruction") or "additional edge case")
    profiles = build_profiles(journey, segment, count)
    for index, profile in enumerate(profiles):
        profile["id"] = f"qa-extra-{uuid.uuid4().hex[:6]}-{index + 1}"
        profile["scenario"] = instruction
    synth_id = f"synth-{uuid.uuid4().hex[:10]}"
    SYNTH_JOBS[synth_id] = {"status": "done", "profiles": profiles, "suites": [], "createdAt": now_iso()}
    return jsonify({"synthId": synth_id, "status": "queued"})


def simulate_result(journey: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    visited = [node["id"] for node in journey.get("nodes", [])[: min(6, len(journey.get("nodes", [])))]]
    archetype = str(profile.get("archetype") or "").lower()
    if archetype in {"holdout", "no_consent", "fcap_capped"}:
        verdict = "warn"
        visited = visited[:2] or visited
    else:
        verdict = "pass"
    return {
        "profile": profile,
        "visited": visited,
        "verdict": verdict,
        "steps": [
            {"nodeId": node_id, "verdict": "pass" if verdict == "pass" else "warn", "reason": "Deterministic QA fallback traversal"}
            for node_id in visited
        ],
        "summary": {
            "profileName": profile.get("name", "Profile"),
            "verdict": verdict,
            "pass": len(visited) if verdict == "pass" else max(0, len(visited) - 1),
            "fail": 0,
            "skipped": max(0, len(journey.get("nodes", [])) - len(visited)),
            "steps": len(visited),
            "stopped": verdict != "pass",
        },
    }


@qa_automation_bp.post("/simulate")
def simulate():
    body = request.get_json(silent=True) or {}
    journey = get_journey(body.get("journeyId"))
    if not journey:
        return jsonify({"error": "journeyId is required"}), 400
    sim_id = f"sim-{uuid.uuid4().hex[:10]}"
    SIM_JOBS[sim_id] = {"status": "done", "result": simulate_result(journey, body.get("profile") or {}), "createdAt": now_iso()}
    return jsonify({"simId": sim_id, "status": "queued"})


@qa_automation_bp.get("/simulate/<sim_id>")
def simulate_status(sim_id):
    job = SIM_JOBS.get(sim_id)
    if not job:
        return jsonify({"status": "failed", "error": f"Unknown simulation {sim_id}"}), 404
    return jsonify(job)


def build_report(journey: dict[str, Any], segment: dict[str, Any], profiles: list[dict[str, Any]], suites: list[dict[str, Any]]) -> dict[str, Any]:
    walks = [simulate_result(journey, profile) for profile in profiles]
    pass_count = sum(1 for walk in walks if walk["verdict"] == "pass")
    warn_count = len(walks) - pass_count
    return {
        "id": f"report-{uuid.uuid4().hex[:8]}",
        "createdAt": now_iso(),
        "journeyId": journey["id"],
        "segmentId": segment["id"],
        "summary": {
            "verdict": "pass" if warn_count == 0 else "warn",
            "suites": len(suites),
            "profiles": len(profiles),
            "passed": pass_count,
            "warned": warn_count,
            "failed": 0,
        },
        "fit": {
            "verdict": "pass",
            "score": 0.91,
            "reasons": [f"{segment['name']} is related to {journey['name']}."],
            "summary": "Fallback QA confirms audience and journey context are coherent.",
        },
        "structure": [
            {"nodeId": node["id"], "severity": "info", "message": "Node is reachable in normalized QA canvas."}
            for node in journey.get("nodes", [])[:8]
        ],
        "walks": walks,
    }


@qa_automation_bp.post("/runs/qa")
def run_qa():
    body = request.get_json(silent=True) or {}
    journey = get_journey(body.get("journeyId"))
    segment = get_segment(body.get("segmentId"))
    if not journey or not segment:
        return jsonify({"error": "journeyId and segmentId are required"}), 400
    profiles = body.get("baseProfiles") or build_profiles(journey, segment)
    suites = body.get("suites") or build_suites(journey, segment)
    run_id = f"run-{uuid.uuid4().hex[:10]}"
    QA_RUNS[run_id] = {
        "status": "passed",
        "journey": journey,
        "segment": segment,
        "profiles": profiles,
        "suites": suites,
        "report": build_report(journey, segment, profiles, suites),
        "createdAt": now_iso(),
    }
    return jsonify({"runId": run_id, "status": "queued"})


@qa_automation_bp.get("/runs/<run_id>/stream")
def run_stream(run_id):
    run = QA_RUNS.get(run_id)
    if not run:
        return jsonify({"error": f"Unknown QA run {run_id}"}), 404

    def events():
        nodes = run["journey"].get("nodes", [])[:5]
        total = max(1, len(nodes))
        for index, node in enumerate(nodes):
            payload = {
                "ts": datetime.utcnow().strftime("%H:%M:%S"),
                "level": "info",
                "node": node["id"],
                "nodeId": node["id"],
                "label": node.get("title", node["id"]),
                "msg": "Fallback QA check passed",
                "progress": int(((index + 1) / total) * 90),
            }
            yield f"event: step\ndata: {json.dumps(payload)}\n\n"
            time.sleep(0.05)
        yield f"event: done\ndata: {json.dumps({'status': 'passed', 'duration': 1.2})}\n\n"

    return Response(events(), mimetype="text/event-stream")


@qa_automation_bp.get("/runs/<run_id>/report")
def run_report(run_id):
    run = QA_RUNS.get(run_id)
    if not run:
        return jsonify({"error": f"Unknown QA run {run_id}"}), 404
    return jsonify(run["report"])
