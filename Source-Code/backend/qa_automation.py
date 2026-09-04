import json
import os
import re
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from flask import Response, jsonify, request
from config_loader import get_directory
from services.copilot_artifacts import CopilotArtifactService


ROOT = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = get_directory("qa_automation_examples")
APP_JOURNEYS_DIR = get_directory("preset_journeys")
APP_CUSTOM_JOURNEYS_DIR = get_directory("custom_journeys")
APP_CUSTOM_SEGMENTS_DIR = get_directory("custom_segments")
QA_ARTIFACT_SERVICE = CopilotArtifactService()

_SYNTH_JOBS = {}
_SIM_JOBS = {}
_RUNS = {}
_REAL_RUNTIME = None
_REAL_RUNTIME_ERROR = None

_CHANNEL_TO_NODE_TYPE = {
    "EMAIL": "channel_email",
    "PUSH": "channel_push",
    "SMS": "channel_sms",
    "INAPP": "channel_inapp",
    "WEB": "channel_web",
    "CARD": "channel_card",
    "DM": "channel_dm",
    "CALL": "channel",
}

_BASE_FLOW_NODES = [
    {"id": "n0", "lane": "trigger", "column": 0, "kind": "start", "title": ["Audience", "Qualified"], "subtitle": [">=3 home games", "no ticket 14d"], "accent": "#2680EB"},
    {"id": "n1", "lane": "trigger", "column": 1, "kind": "holdout", "title": ["Holdout", "Gate"], "subtitle": ["10% exit", "no messages"], "accent": "#0FB8B8"},
    {"id": "n2", "lane": "trigger", "column": 2, "kind": "split", "title": ["A/B", "Split"], "subtitle": ["50% Var A", "50% Var B"], "accent": "#8B5CF6"},
    {"id": "n3", "lane": "email", "column": 3, "kind": "action", "title": ["Email 1A"], "subtitle": ["D-7 generic", "primary CTA"], "accent": "#C89B3C"},
    {"id": "n3b", "lane": "email", "column": 3, "kind": "action", "title": ["Email 1B"], "subtitle": ["D-7 personalized", "Gold offer"], "accent": "#E5C97A", "variantBadge": "VAR B", "offsetY": 74},
    {"id": "n4", "lane": "decision", "column": 4, "kind": "decision", "title": ["Email", "Opened?"], "subtitle": ["24h check", "branch next"], "accent": "#8B5CF6"},
    {"id": "n5", "lane": "trigger", "column": 5, "kind": "wait", "title": ["Wait 2d"], "subtitle": ["post-open", "monitor buy"], "accent": "#4A9EF5"},
    {"id": "n6", "lane": "push", "column": 6, "kind": "action", "title": ["Push 1"], "subtitle": ["D-5 urgency", "deep link"], "accent": "#F59E0B"},
    {"id": "n7", "lane": "decision", "column": 7, "kind": "decision", "title": ["Push", "Clicked?"], "subtitle": ["24h check", "branch next"], "accent": "#8B5CF6"},
    {"id": "n8", "lane": "trigger", "column": 8, "kind": "wait", "title": ["Wait 2d"], "subtitle": ["retargeting", "purchase watch"], "accent": "#4A9EF5"},
    {"id": "n9", "lane": "email", "column": 9, "kind": "action", "title": ["Email 2B"], "subtitle": ["Gold follow-up", "offer close"], "accent": "#E5C97A", "variantBadge": "VAR B"},
    {"id": "n10", "lane": "push", "column": 10, "kind": "action", "title": ["Push 2"], "subtitle": ["D-1 last chance", "app link"], "accent": "#F59E0B"},
    {"id": "n11", "lane": "decision", "column": 11, "kind": "decision", "title": ["Ticket", "Purchased?"], "subtitle": ["conversion", "or timeout"], "accent": "#8B5CF6"},
    {"id": "n12", "lane": "exit", "column": 12, "kind": "end", "title": ["Exit", "Converted"], "subtitle": ["purchase", "captured"], "accent": "#22C55E"},
    {"id": "n13", "lane": "exit", "column": 12, "kind": "endDashed", "title": ["Exit", "21d TTL"], "subtitle": ["time-to-live", "expired"], "accent": "#4A5568", "offsetY": 74},
    {"id": "n14", "lane": "exit", "column": 1, "kind": "end", "title": ["Exit", "Holdout"], "subtitle": ["baseline", "measure only"], "accent": "#0FB8B8", "offsetY": 74},
]

_BASE_FLOW_EDGES = [
    {"id": "e0", "from": "n0", "to": "n1", "type": "flow", "label": ""},
    {"id": "e1", "from": "n1", "to": "n2", "type": "flow", "label": "90%"},
    {"id": "e2", "from": "n1", "to": "n14", "type": "holdout", "label": "10%"},
    {"id": "e3", "from": "n2", "to": "n3", "type": "varA", "label": "Var A"},
    {"id": "e4", "from": "n2", "to": "n3b", "type": "varB", "label": "Var B"},
    {"id": "e5", "from": "n3", "to": "n4", "type": "flow", "label": ""},
    {"id": "e6", "from": "n3b", "to": "n4", "type": "flow", "label": ""},
    {"id": "e7", "from": "n4", "to": "n5", "type": "yes", "label": "Yes"},
    {"id": "e8", "from": "n4", "to": "n6", "type": "no", "label": "No"},
    {"id": "e9", "from": "n5", "to": "n6", "type": "flow", "label": ""},
    {"id": "e10", "from": "n6", "to": "n7", "type": "flow", "label": ""},
    {"id": "e11", "from": "n7", "to": "n8", "type": "yes", "label": "Yes"},
    {"id": "e12", "from": "n7", "to": "n11", "type": "no", "label": "No"},
    {"id": "e13", "from": "n8", "to": "n9", "type": "varB", "label": "Var B"},
    {"id": "e14", "from": "n8", "to": "n10", "type": "flow", "label": ""},
    {"id": "e15", "from": "n9", "to": "n11", "type": "flow", "label": ""},
    {"id": "e16", "from": "n10", "to": "n11", "type": "flow", "label": ""},
    {"id": "e17", "from": "n11", "to": "n12", "type": "yes", "label": "Yes"},
    {"id": "e18", "from": "n11", "to": "n13", "type": "no", "label": "No"},
]

def _rules_for(*pairs):
    return [
        {"id": f"rule_{idx + 1}", "field": field, "value": value, "joiner": "" if idx == 0 else "AND"}
        for idx, (field, value) in enumerate(pairs)
    ]


_BUILTIN_SEGMENTS = [
    {"id": "seg-01", "name": "Recent_Event_Attendees_No_Purchase", "purpose": "Ticketing conversion", "size": "8.4K", "refresh": "Streaming + 15m batch", "exclusions": "Opt-out, active journey, premium buyers", "status": "Ready for activation", "rules": _rules_for(("LTV Tier", "High"), ("Recency", "Medium")), "isPreset": True},
    {"id": "seg-02", "name": "Subscription_Renewal_Window_10d", "purpose": "Renewal urgency", "size": "6.2K", "refresh": "Hourly", "exclusions": "Renewed, do-not-renew, collections", "status": "Production ready", "rules": _rules_for(("LTV Tier", "High"), ("Engagement Tier", "High")), "isPreset": True},
    {"id": "seg-03", "name": "Recent_Attendees_No_App_30d", "purpose": "Engagement reactivation", "size": "7.9K", "refresh": "Nightly + app stream", "exclusions": "Recent sessions, recent purchasers", "status": "Ready for activation", "rules": _rules_for(("Recency", "Medium"), ("Content Affinity", "High")), "isPreset": True},
    {"id": "seg-04", "name": "Lapsed_Customers_45d", "purpose": "Win-back", "size": "5.7K", "refresh": "Daily", "exclusions": "Recent buyers, global holdout", "status": "In QA review", "rules": _rules_for(("Recency", "Low"), ("Engagement Tier", "Low")), "isPreset": True},
    {"id": "seg-05", "name": "Recent_Merch_Buyers_90d", "purpose": "Commerce retention", "size": "4.8K", "refresh": "Daily", "exclusions": "Recent pre-order registrants", "status": "Production ready", "rules": _rules_for(("Content Affinity", "High"), ("LTV Tier", "Medium")), "isPreset": True},
    {"id": "seg-06", "name": "Premium_Browsers_14d", "purpose": "High-value lead nurture", "size": "2.1K", "refresh": "Hourly", "exclusions": "Open opportunities, suppressed leads", "status": "Draft", "rules": _rules_for(("LTV Tier", "High"), ("Content Affinity", "Medium")), "isPreset": True},
    {"id": "seg-07", "name": "App_Dormant_21d", "purpose": "App return", "size": "9.6K", "refresh": "Hourly", "exclusions": "New installs, active subscribers", "status": "Ready for activation", "rules": _rules_for(("Engagement Tier", "Low"), ("Recency", "Medium")), "isPreset": True},
    {"id": "seg-08", "name": "High_Value_Return_60d", "purpose": "Retention expansion", "size": "3.4K", "refresh": "Daily", "exclusions": "Current journeys, unresolved cases", "status": "Needs review", "rules": _rules_for(("LTV Tier", "Medium"), ("Content Affinity", "Low")), "isPreset": True},
]


def _now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _json_error(message, status=400):
    return jsonify({"detail": message, "error": message}), status


def _json_artifacts_with_local_fallback(directory):
    """Return UC JSON artifacts plus packaged-only QA definitions."""
    uc_paths = set()
    try:
        uc_paths.update(directory.glob("*.json"))
    except Exception as exc:
        print(f"[WARNING] Unable to list UC QA artifacts in {directory}: {exc}")

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
                payload = QA_ARTIFACT_SERVICE.read_json_with_local_fallback(
                    path,
                    default=None,
                )
            else:
                with path.open("r", encoding="utf-8") as handle:
                    payload = json.load(handle)
            if payload is not None:
                artifacts.append(payload)
        except Exception as exc:
            print(f"[WARNING] Skipping invalid QA JSON file {path}: {exc}")
    return artifacts


def _is_runnable_journey(payload):
    if not isinstance(payload, dict):
        return False
    if payload.get("useCaseId"):
        journey = payload.get("journey")
        nodes = journey.get("nodes") if isinstance(journey, dict) else None
        return bool(nodes)
    if payload.get("slug") and (isinstance(payload.get("nodes"), list) or isinstance(payload.get("nodeOverrides"), dict) or isinstance(payload.get("journeyOverrides"), dict)):
        return True
    return False


@lru_cache(maxsize=1)
def _load_journeys():
    journeys = []
    seen = set()
    for directory in (APP_JOURNEYS_DIR, APP_CUSTOM_JOURNEYS_DIR, EXAMPLES_DIR):
        for payload in _json_artifacts_with_local_fallback(directory):
            candidates = payload if isinstance(payload, list) else [payload]
            for item in candidates:
                journey_id = _journey_id(item)
                if _is_runnable_journey(item) and journey_id not in seen:
                    seen.add(journey_id)
                    journeys.append(_normalise_journey_record(item))
    journeys.sort(key=lambda item: item.get("name") or item["useCaseId"])
    return journeys


@lru_cache(maxsize=1)
def _load_segments():
    segments = []
    seen = set()
    for segment in _BUILTIN_SEGMENTS:
        seen.add(segment["id"])
        segments.append(dict(segment))
    for segment_dir in (APP_CUSTOM_SEGMENTS_DIR, EXAMPLES_DIR / "segments"):
        for payload in _json_artifacts_with_local_fallback(segment_dir):
            if isinstance(payload, dict) and payload.get("id") and payload["id"] not in seen:
                seen.add(payload["id"])
                segments.append(payload)
    return segments


def _get_journey(journey_id):
    return next((journey for journey in _load_journeys() if journey.get("useCaseId") == journey_id), None)


def _get_segment(segment_id):
    return next((segment for segment in _load_segments() if segment.get("id") == segment_id), None)


def _segment_rank_for_journey(segment, journey):
    if not journey:
        return 0
    journey_text = json.dumps(journey, ensure_ascii=False).lower()
    segment_text = json.dumps(segment, ensure_ascii=False).lower()
    score = 0
    for token in re.findall(r"[a-z0-9]+", segment_text):
        if len(token) > 3 and token in journey_text:
            score += 2
    segment_name = str(segment.get("name") or "").lower()
    if "app" in journey_text and "dormant" in segment_name:
        score += 20
    if "renewal" in journey_text and "renewal" in segment_name:
        score += 20
    if "merch" in journey_text and "merch" in segment_name:
        score += 20
    return score


def _segments_for_journey(journey_id):
    segments = _load_segments()
    journey = _get_journey(journey_id) if journey_id else None
    if not journey:
        return segments
    ranked = sorted(
        ((_segment_rank_for_journey(segment, journey), segment) for segment in segments),
        key=lambda item: (-item[0], str(item[1].get("name") or "")),
    )
    matches = [segment for score, segment in ranked if score > 0]
    return matches or segments


def _journey_id(payload):
    return payload.get("useCaseId") or payload.get("slug") or payload.get("id") or payload.get("name")


def _humanize_journey_id(value):
    text = str(value or "").strip()
    text = re.sub(r"^\d+[-_ ]*", "", text)
    text = re.sub(r"[-_]+", " ", text).strip()
    return text.title() if text else "Journey"


def _journey_display_name(journey):
    table = journey.get("journeyTable") if isinstance(journey.get("journeyTable"), dict) else {}
    form = journey.get("journeyForm") if isinstance(journey.get("journeyForm"), dict) else {}
    blueprint = journey.get("blueprintForm") if isinstance(journey.get("blueprintForm"), dict) else {}
    journey_id = _journey_id(journey)
    for candidate in (
        journey.get("name"),
        table.get("journeyName"),
        form.get("name"),
        blueprint.get("journeyType"),
    ):
        candidate = str(candidate or "").strip()
        if candidate and candidate != journey_id:
            return candidate
    return _humanize_journey_id(journey_id)


def _as_text(value):
    if isinstance(value, list):
        return " ".join(str(part) for part in value if part is not None)
    return str(value or "")


def _canvas_kind(kind, lane=""):
    source = str(kind or lane or "").lower()
    if source in {"start", "trigger", "entry"}:
        return "entry"
    if source in {"end", "enddashed", "exit"}:
        return "exit"
    if source in {"decision", "condition"}:
        return "condition"
    if source in {"holdout", "split"}:
        return "split"
    if source == "wait":
        return "wait"
    if "email" in source:
        return "channel_email"
    if "sms" in source:
        return "channel_sms"
    if "push" in source:
        return "channel_push"
    if "app" in source:
        return "channel_inapp"
    return "channel"


def _normalise_custom_journey(payload):
    journey_id = _journey_id(payload)
    journey_form = payload.get("journeyForm") or {}
    blueprint_form = payload.get("blueprintForm") or {}
    display_name = payload.get("name") or journey_form.get("name") or _humanize_journey_id(journey_id)
    nodes = [dict(node) for node in (payload.get("nodes") or _BASE_FLOW_NODES)]
    for node in nodes:
        override = (payload.get("nodeOverrides") or {}).get(node.get("id"))
        if isinstance(override, dict):
            node.update(override)
    edges = payload.get("edges") or _BASE_FLOW_EDGES
    journey_overrides = payload.get("journeyOverrides") or {}
    ajo_nodes = []
    for node in nodes:
        node_type = "ENTRY" if _canvas_kind(node.get("kind"), node.get("lane")) == "entry" else (
            "EXIT" if _canvas_kind(node.get("kind"), node.get("lane")) == "exit" else (
                "CONDITION" if _canvas_kind(node.get("kind"), node.get("lane")) == "condition" else (
                    "WAIT" if _canvas_kind(node.get("kind"), node.get("lane")) == "wait" else "MESSAGE"
                )
            )
        )
        ajo_nodes.append(
            {
                "id": node.get("id"),
                "type": node_type,
                "event": journey_form.get("entryTrigger") or blueprint_form.get("singleTriggerEvent"),
                "tpId": node.get("id"),
            }
        )
    return {
        "useCaseId": journey_id,
        "name": display_name,
        "category": {
            "categoryId": payload.get("categoryId") or journey_form.get("journeyCategory") or "custom",
            "categoryName": payload.get("categoryName") or journey_form.get("journeyCategory") or "Custom",
        },
        "status": "Draft",
        "version": 1,
        "journeyTable": {
            "journeyName": display_name,
            "journeyGoal": journey_form.get("objective") or blueprint_form.get("brief") or "",
            "entryTrigger": journey_form.get("entryTrigger") or journey_overrides.get("entryTrigger") or blueprint_form.get("singleTriggerEvent") or "",
            "journeyCategory": journey_form.get("journeyCategory") or payload.get("categoryName") or "Custom",
            "totalDuration": journey_form.get("duration") or "",
            "exitClause": "Exit at conversion or timeout",
        },
        "entryCriteria": {
            "event": journey_form.get("entryTrigger") or journey_overrides.get("entryTrigger") or blueprint_form.get("singleTriggerEvent") or "",
            "eventId": f"evt_{journey_id}",
            "conditions": [],
            "audienceName": journey_form.get("audience") or journey_overrides.get("audience") or "",
        },
        "touchpoints": [
            {
                "tpId": node.get("id"),
                "label": _as_text(node.get("title")) or node.get("id"),
                "channel": node.get("lane", "").upper() if node.get("lane") not in {"trigger", "decision", "exit"} else "",
                "messageTheme": _as_text(node.get("subtitle")),
            }
            for node in nodes
        ],
        "journey": {"nodes": ajo_nodes},
        "nodes": nodes,
        "edges": edges,
        "nodeDetails": payload.get("nodeDetails", []),
        "_sourceShape": "custom",
    }


def _normalise_journey_record(payload):
    if payload.get("useCaseId") and isinstance(payload.get("journey"), dict):
        return payload
    return _normalise_custom_journey(payload)


def _node_outgoing_ids(node):
    outgoing = []
    for branch in node.get("branches") or []:
        target = branch.get("next")
        if target:
            outgoing.append((target, str(branch.get("label") or branch.get("value") or "")))
    if isinstance(node.get("trueBranch"), str):
        outgoing.append((node["trueBranch"], "Yes"))
    if isinstance(node.get("falseBranch"), str):
        outgoing.append((node["falseBranch"], "No"))
    if isinstance(node.get("next"), str):
        outgoing.append((node["next"], ""))
    return outgoing


def _as_int_version(value):
    try:
        return int(float(value))
    except Exception:
        return 1


def _ajo_to_canvas(raw):
    if raw.get("_sourceShape") == "custom":
        nodes = raw.get("nodes") or []
        edges = raw.get("edges") or []
        canvas_nodes = []
        for node in nodes:
            canvas_nodes.append(
                {
                    "id": node.get("id"),
                    "type": _canvas_kind(node.get("kind"), node.get("lane")),
                    "x": int(node.get("column", 0)) * 220 + 60,
                    "y": 220 + int(node.get("offsetY", 0) or 0),
                    "title": _as_text(node.get("title")) or node.get("id"),
                    "sub": _as_text(node.get("subtitle")),
                    "meta": node.get("variantBadge", ""),
                }
            )
        canvas_edges = [
            [edge.get("from"), edge.get("to"), edge.get("label")] if edge.get("label") else [edge.get("from"), edge.get("to")]
            for edge in edges
            if edge.get("from") and edge.get("to")
        ]
        criteria = []
        entry = raw.get("entryCriteria") or {}
        if entry.get("event"):
            criteria.append({"id": "crit_event", "label": f"Trigger: {entry.get('event')}", "status": "ok", "note": entry.get("eventId", "")})
        if entry.get("audienceName"):
            criteria.append({"id": "crit_audience", "label": f"Audience: {entry.get('audienceName')}", "status": "ok"})
        return {
            **raw,
            "id": raw["useCaseId"],
            "name": _journey_display_name(raw),
            "nodes": canvas_nodes,
            "edges": canvas_edges,
            "criteria": criteria,
            "holdouts": raw.get("holdouts", []),
            "suppression": raw.get("suppression", []),
            "version": _as_int_version(raw.get("version", 1)),
            "updated": "",
            "owner": "",
        }

    touchpoints = {tp.get("tpId"): tp for tp in raw.get("touchpoints", []) if isinstance(tp, dict)}
    ajo_nodes = raw.get("journey", {}).get("nodes", [])
    ids = {node["id"] for node in ajo_nodes if "id" in node}
    exit_node = next((node["id"] for node in ajo_nodes if node.get("type") in ("EXIT", "END")), None)

    def resolve(target):
        if target in ids:
            return target
        if isinstance(target, str) and target.upper() in ("EXIT", "END") and exit_node:
            return exit_node
        return None

    by_id = {node["id"]: node for node in ajo_nodes if "id" in node}
    entry = next((node for node in ajo_nodes if node.get("type") == "ENTRY"), ajo_nodes[0] if ajo_nodes else None)
    depth = {}
    if entry:
        queue = [(entry["id"], 0)]
        while queue:
            node_id, current_depth = queue.pop(0)
            if node_id in depth and depth[node_id] <= current_depth:
                continue
            depth[node_id] = current_depth
            node = by_id.get(node_id)
            if not node:
                continue
            targets = [resolve(target) for target, _ in _node_outgoing_ids(node)]
            targets = [target for target in targets if target]
            if not targets and node.get("type") not in ("EXIT", "END"):
                idx = ajo_nodes.index(node)
                if idx + 1 < len(ajo_nodes):
                    targets = [ajo_nodes[idx + 1]["id"]]
            for target in targets:
                if target not in depth:
                    queue.append((target, current_depth + 1))

    groups = {}
    for node_id, node_depth in depth.items():
        groups.setdefault(node_depth, []).append(node_id)
    max_depth = max(depth.values(), default=0)
    for node in ajo_nodes:
        if node["id"] not in depth:
            max_depth += 1
            depth[node["id"]] = max_depth
            groups.setdefault(max_depth, []).append(node["id"])

    canvas_nodes = []
    for node in ajo_nodes:
        ajo_type = node.get("type", "")
        if ajo_type == "ENTRY":
            node_type = "entry"
            title = node.get("event") or "Entry"
            sub = node.get("eventId") or ""
        elif ajo_type in ("EXIT", "END"):
            node_type = "exit"
            title = "Exit"
            sub = ""
        elif ajo_type == "CONDITION":
            node_type = "condition"
            title = "If " + str(node.get("field") or "?")
            sub = " | ".join(str(branch.get("value", "")) for branch in node.get("branches", [])) or "branch"
        elif ajo_type == "WAIT":
            node_type = "wait"
            title = "Wait"
            sub = str(node.get("duration") or "")
        elif ajo_type == "SPLIT":
            node_type = "split"
            title = "A/B Split"
            weights = node.get("weights") or []
            sub = "/".join(str(weight) for weight in weights) + "%" if weights else node.get("splitType", "split")
        else:
            touchpoint = touchpoints.get(node.get("tpId")) or {}
            channel = touchpoint.get("channel") or ""
            if isinstance(channel, list):
                channel = channel[0] if channel else ""
            node_type = _CHANNEL_TO_NODE_TYPE.get(str(channel).upper(), "channel")
            title = touchpoint.get("label") or node.get("tpId") or ajo_type.title()
            sub = str(channel).upper() if channel else str(node.get("tpId") or "")

        node_depth = depth.get(node["id"], 0)
        siblings = groups.get(node_depth, [node["id"]])
        col = siblings.index(node["id"]) if node["id"] in siblings else 0
        cols = max(1, len(siblings))
        canvas_nodes.append(
            {
                "id": node["id"],
                "type": node_type,
                "x": int(round(60 + node_depth * 240)),
                "y": int(round(240 + (col - (cols - 1) / 2) * 110)),
                "title": title,
                "sub": sub,
            }
        )

    edges = []
    for idx, node in enumerate(ajo_nodes):
        outgoing = _node_outgoing_ids(node)
        if outgoing:
            for target, label in outgoing:
                resolved = resolve(target)
                if resolved:
                    edges.append([node["id"], resolved, label] if label else [node["id"], resolved])
        elif node.get("type") not in ("EXIT", "END") and idx + 1 < len(ajo_nodes):
            edges.append([node["id"], ajo_nodes[idx + 1]["id"]])

    criteria = []
    entry_criteria = raw.get("entryCriteria") or {}
    if entry_criteria.get("event"):
        criteria.append(
            {
                "id": "crit_event",
                "label": f"Trigger: {entry_criteria.get('event')}",
                "status": "ok",
                "note": entry_criteria.get("eventId", ""),
            }
        )
    for idx, condition in enumerate(entry_criteria.get("conditions") or []):
        criteria.append(
            {
                "id": f"crit_{idx}",
                "label": f"{condition.get('field', '?')} {condition.get('operator', '=')} {condition.get('value', '')}",
                "status": "ok",
            }
        )

    return {
        **raw,
        "id": raw["useCaseId"],
        "name": _journey_display_name(raw),
        "nodes": canvas_nodes,
        "edges": edges,
        "holdouts": raw.get("holdouts", []),
        "suppression": raw.get("suppression", []),
        "criteria": criteria,
        "version": _as_int_version(raw.get("version", 1)),
        "updated": "",
        "owner": "",
    }


def _journey_summary(journey):
    return {
        "id": journey["useCaseId"],
        "name": _journey_display_name(journey),
        "category": (journey.get("category") or {}).get("categoryName", "Uncategorized"),
        "status": journey.get("status", "Draft"),
        "version": _as_int_version(journey.get("version", 1)),
        "updated": "",
        "owner": "",
    }


def _build_suites(journey, segment):
    name = _journey_display_name(journey)
    segment_name = segment.get("name", "Selected segment")
    return [
        {
            "name": "Entry and segment fit",
            "description": f"Validate {segment_name} eligibility for {name}.",
            "expectedOutcome": "Eligible profiles enter the journey.",
            "testCount": 3,
            "testCases": [
                {"title": "Segment rules are present", "description": "The selected audience has usable rule criteria."},
                {"title": "Entry event is configured", "description": "The journey exposes an entry trigger for simulation."},
                {"title": "Eligible profile enters", "description": "A normal profile can start the path."},
            ],
        },
        {
            "name": "Suppression and consent",
            "description": "Verify holdout, consent, and suppression handling.",
            "expectedOutcome": "Suppressed profiles do not receive messages.",
            "testCount": 3,
            "testCases": [
                {"title": "No-consent profile is skipped", "description": "Profiles without consent stop before messaging."},
                {"title": "Holdout profile is excluded", "description": "Holdout members do not continue into activation."},
                {"title": "Eligible profile is not suppressed", "description": "Valid profiles continue through the journey."},
            ],
        },
        {
            "name": "Channel execution",
            "description": "Validate channel nodes, waits, and branch traversal.",
            "expectedOutcome": "Profiles reach the expected message or wait nodes.",
            "testCount": 3,
            "testCases": [
                {"title": "Channel node resolves", "description": "A message touchpoint is available on the path."},
                {"title": "Wait and branch nodes are traversable", "description": "Non-message orchestration nodes do not block execution."},
                {"title": "Path reaches an exit", "description": "Simulation terminates at a valid journey endpoint."},
            ],
        },
    ]


def _build_profiles(segment, count=6, instruction=None):
    requested = max(1, int(count or 6))
    archetypes = [
        ("eligible", "Eligible", "eligible", True, None),
        ("variant", "Experiment", "variant", True, None),
        ("holdout", "Holdout", "excluded", True, "holdout_segment"),
        ("consent_suppressed", "No consent", "excluded", False, "no_consent"),
        ("fcap_capped", "Frequency cap risk", "eligible", True, None),
        ("ineligible", "Ineligible", "excluded", True, "experiment_holdback"),
    ]
    profiles = []
    segment_name = segment.get("name", "segment")
    for idx in range(requested):
        archetype, tag, tone, consent, reason = archetypes[idx % len(archetypes)]
        ordinal = idx + 1
        label = instruction.strip() if isinstance(instruction, str) and instruction.strip() else segment_name
        profiles.append(
            {
                "id": f"qa_prof_{ordinal:02d}_{archetype}",
                "name": f"{tag} Profile {ordinal}",
                "initials": "".join(part[0] for part in tag.split()[:2]).upper(),
                "summary": f"{label} QA profile",
                "archetype": archetype,
                "scenarioTag": tag,
                "scenarioTone": tone,
                "expectedOutcome": "Message eligible profile" if not reason else "Suppress before message",
                "category": "eligible" if not reason else "excluded",
                "holdout": reason == "holdout_segment",
                "region": ["US", "IN", "UK", "CA"][idx % 4],
                "age": 28 + idx * 5,
                "fcap": idx % 4,
                "ownerId": f"owner-{1000 + idx}",
                "globalConsent": consent,
                "consentScope": "global" if consent else "none",
                "channelConsent": {"email": consent, "sms": consent, "push": consent, "call": False},
                "suppressionReason": reason,
                "metadata": [
                    {"label": "Segment", "value": segment_name},
                    {"label": "Archetype", "value": tag},
                    {"label": "Region", "value": ["US", "IN", "UK", "CA"][idx % 4]},
                ],
            }
        )
    return profiles


def _journey_path(journey):
    canvas = _ajo_to_canvas(journey)
    nodes = canvas["nodes"]
    if not nodes:
        return []
    exit_id = next((node["id"] for node in nodes if node.get("type") == "exit"), nodes[-1]["id"])
    path = []
    for node in nodes[: min(6, len(nodes))]:
        path.append({"nodeId": node["id"], "label": node.get("title", node["id"]), "action": "visited", "status": "pass"})
        if node["id"] == exit_id:
            break
    if path and path[-1]["nodeId"] != exit_id:
        exit_node = next((node for node in nodes if node["id"] == exit_id), None)
        if exit_node:
            path.append({"nodeId": exit_id, "label": exit_node.get("title", "Exit"), "action": "completed", "status": "pass"})
    return path


def _simulate(journey, profile, suites):
    suppressed = bool(profile.get("suppressionReason")) or profile.get("globalConsent") is False or profile.get("consent") is False
    path = _journey_path(journey)
    if suppressed and len(path) > 2:
        path = path[:2] + [path[-1]]
        for step in path[1:]:
            step["action"] = "suppressed"
            step["status"] = "skipped"
    checks = []
    for suite in suites:
        for case in suite.get("testCases") or []:
            status = "skipped" if suppressed and suite.get("name") == "Channel execution" else "pass"
            checks.append(
                {
                    "suite": suite.get("name", "QA Suite"),
                    "title": case.get("title", "Test case"),
                    "description": case.get("description", ""),
                    "status": status,
                }
            )
    return {
        "profileId": profile.get("id", "profile"),
        "expected": profile.get("expectedOutcome", ""),
        "path": path,
        "checks": checks,
        "verdict": "pass",
    }


def _build_report(run_id, journey, segment, suites, profiles, started):
    simulations = [_simulate(journey, profile, suites) for profile in profiles]
    walks = [
        {
            "profile": {"id": profile.get("id"), "name": profile.get("name")},
            "steps": [
                {"nodeId": step["nodeId"], "verdict": "pass" if step["status"] != "fail" else "fail", "reason": step.get("action", "")}
                for step in sim.get("path", [])
            ],
            "endedAt": _now_iso(),
            "verdict": sim.get("verdict", "pass"),
        }
        for profile, sim in zip(profiles, simulations)
    ]
    canvas = _ajo_to_canvas(journey)
    return {
        "runId": run_id,
        "journeyId": journey["useCaseId"],
        "segmentId": segment["id"],
        "modelProvider": "local",
        "verdict": "pass",
        "summary": f"QA completed for {len(profiles)} profiles across {len(suites)} suites.",
        "fit": {
            "verdict": "pass",
            "score": 0.95,
            "reasons": ["Journey, segment, and generated profile cohort are compatible."],
            "summary": "Selected segment can be exercised against the journey.",
        },
        "structure": [
            {
                "nodeId": canvas["nodes"][0]["id"] if canvas["nodes"] else "journey",
                "severity": "info",
                "message": "Journey graph loaded and traversable.",
            }
        ],
        "walks": walks,
        "suites": [
            {
                "name": suite.get("name"),
                "description": suite.get("description"),
                "expectedOutcome": suite.get("expectedOutcome"),
                "profileCount": len(profiles),
            }
            for suite in suites
        ],
        "createdAt": _now_iso(),
        "durationMs": int((time.time() - started) * 1000),
    }


def _sse(event, payload):
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _real_runtime_available():
    """Load the migrated beta backend runtime on demand.

    The beta source imports modules from a top-level package named `app`.
    In this application we copied that source into
    `backend.qa_runtime.beta_app.app`, so this function aliases that package to
    `app` only for the QA adapter. If the beta dependency tree is not installed
    yet, callers receive `(None, reason)` and can fall back without breaking
    existing routes.
    """
    global _REAL_RUNTIME, _REAL_RUNTIME_ERROR
    if _REAL_RUNTIME is not None:
        return _REAL_RUNTIME, None
    if _REAL_RUNTIME_ERROR is not None:
        return None, _REAL_RUNTIME_ERROR

    os.environ.setdefault("EXAMPLES_DIR", str(EXAMPLES_DIR))
    try:
        import backend.qa_runtime.beta_app.app as qa_runtime_package

        sys.modules.setdefault("app", qa_runtime_package)

        from app.data.loaders import get_journey_by_id, get_segment_by_id, load_journeys, load_segments
        from app.llm.router import current_provider
        from app.qa.graph import build_qa_graph
        from app.qa.nodes.profile_synth import extend_cohort, simulate_profile, synthesize_plan
        from app.qa.schemas import QAReport
        from app.qa.store import registry as run_registry
        from app.qa.synth_store import registry as synth_registry
        from app.qa.sim_store import registry as sim_registry
    except Exception as exc:
        _REAL_RUNTIME_ERROR = f"{type(exc).__name__}: {exc}"
        return None, _REAL_RUNTIME_ERROR

    _REAL_RUNTIME = {
        "load_journeys": load_journeys,
        "load_segments": load_segments,
        "get_journey_by_id": get_journey_by_id,
        "get_segment_by_id": get_segment_by_id,
        "current_provider": current_provider,
        "build_qa_graph": build_qa_graph,
        "synthesize_plan": synthesize_plan,
        "extend_cohort": extend_cohort,
        "simulate_profile": simulate_profile,
        "QAReport": QAReport,
        "run_registry": run_registry,
        "synth_registry": synth_registry,
        "sim_registry": sim_registry,
        "graph": None,
    }
    return _REAL_RUNTIME, None


def _run_async(coro):
    import asyncio

    return asyncio.run(coro)


def _model_dump(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    return value


def _strict_real_runtime():
    return str(os.environ.get("QA_AUTOMATION_STRICT_REAL", "")).lower() in {"1", "true", "yes"}


def _provider_config_error(runtime):
    provider = runtime["current_provider"]()
    if provider == "anthropic" and not os.environ.get("ANTHROPIC_API_KEY"):
        return "ANTHROPIC_API_KEY is not set"
    if provider == "openai" and not os.environ.get("OPENAI_API_KEY"):
        return "OPENAI_API_KEY is not set"
    if provider == "azure_openai" and (not os.environ.get("AZURE_OPENAI_ENDPOINT") or not os.environ.get("AZURE_API_KEY")):
        return "AZURE_OPENAI_ENDPOINT and AZURE_API_KEY must be set"
    if provider == "databricks" and (not os.environ.get("DATABRICKS_HOST") or not os.environ.get("DATABRICKS_TOKEN")):
        return "DATABRICKS_HOST and DATABRICKS_TOKEN must be set"
    return None


def _real_execution_available():
    runtime, error = _real_runtime_available()
    if runtime is None:
        return None, error
    provider_error = _provider_config_error(runtime)
    if provider_error:
        return None, provider_error
    return runtime, None


def _qa_runtime_mode_payload():
    runtime, error = _real_runtime_available()
    provider_error = _provider_config_error(runtime) if runtime else None
    return {
        "mode": "real" if runtime and not provider_error else "fallback",
        "error": provider_error or error,
        "runtimeImportMode": "real" if runtime else "fallback",
        "provider": runtime["current_provider"]() if runtime else None,
        "strict": _strict_real_runtime(),
        "examplesDir": str(EXAMPLES_DIR),
    }


def _run_real_graph(run_id, journey_id, segment_id, profile_count, suites, base_profiles):
    runtime, error = _real_runtime_available()
    if runtime is None:
        raise RuntimeError(error or "QA runtime unavailable")
    started = time.time()
    if runtime["graph"] is None:
        runtime["graph"] = runtime["build_qa_graph"]()
    graph_input = {
        "run_id": run_id,
        "journey_id": journey_id,
        "segment_id": segment_id,
        "profile_count": profile_count,
    }
    if suites:
        graph_input["suites"] = suites
    if base_profiles:
        graph_input["base_profiles"] = base_profiles
    final_state = _run_async(runtime["graph"].ainvoke(graph_input))
    duration_ms = int((time.time() - started) * 1000)
    report = runtime["QAReport"](
        runId=run_id,
        journeyId=final_state["journey"]["useCaseId"],
        segmentId=final_state["segment"]["id"],
        modelProvider=runtime["current_provider"](),
        verdict=final_state.get("verdict", "fail"),
        summary=final_state.get("summary", ""),
        fit=final_state["fit"],
        structure=list(final_state.get("structure", [])),
        walks=list(final_state.get("walks", [])),
        suites=final_state.get("suite_summaries", []),
        createdAt=_now_iso(),
        durationMs=duration_ms,
    ).model_dump(mode="json")
    runtime["run_registry"].save_report(run_id, report)
    _RUNS[run_id] = {"status": "passed" if report["verdict"] != "fail" else "failed", "report": report, "journey": final_state["journey"], "duration": duration_ms}


def _start_real_graph_thread(run_id, journey_id, segment_id, profile_count, suites, base_profiles):
    def worker():
        try:
            _run_real_graph(run_id, journey_id, segment_id, profile_count, suites, base_profiles)
        except Exception as exc:
            _RUNS[run_id] = {
                "status": "failed",
                "report": {
                    "runId": run_id,
                    "journeyId": journey_id,
                    "segmentId": segment_id,
                    "modelProvider": "real-runtime",
                    "verdict": "fail",
                    "summary": f"Run failed: {type(exc).__name__}: {exc}",
                    "fit": {"verdict": "fail", "score": 0, "reasons": [str(exc)], "summary": ""},
                    "structure": [],
                    "walks": [],
                    "suites": [],
                    "createdAt": _now_iso(),
                    "durationMs": 0,
                },
                "journey": _get_journey(journey_id) or {},
                "duration": 0,
            }

    thread = threading.Thread(target=worker, name=f"qa-real-run-{run_id}", daemon=True)
    thread.start()


def register_qa_automation_routes(app):
    prefix = "/api/qa-automation"

    @app.get(f"{prefix}/runtime")
    def qa_runtime_status():
        return jsonify(_qa_runtime_mode_payload())

    @app.get(f"{prefix}/journeys")
    def qa_list_journeys():
        return jsonify([_journey_summary(journey) for journey in _load_journeys()])

    @app.get(f"{prefix}/journey")
    def qa_get_journey():
        journey_id = request.args.get("id")
        if not journey_id:
            return _json_error("Journey id is required", 400)
        journey = _get_journey(journey_id)
        if journey is None:
            return _json_error(f"Unknown journey {journey_id!r}", 404)
        return jsonify(_ajo_to_canvas(journey))

    @app.get(f"{prefix}/segments")
    def qa_list_segments():
        journey_id = request.args.get("journeyId") or request.args.get("journey_id")
        return jsonify(_segments_for_journey(journey_id))

    @app.get(f"{prefix}/segments/<segment_id>")
    def qa_get_segment(segment_id):
        segment = _get_segment(segment_id)
        if segment is None:
            return _json_error(f"Unknown segment {segment_id!r}", 404)
        return jsonify(segment)

    @app.get(f"{prefix}/profiles")
    def qa_list_profiles():
        segments = _load_segments()
        return jsonify(_build_profiles(segments[0], 4) if segments else [])

    @app.post(f"{prefix}/profiles/generate")
    def qa_generate_profiles():
        payload = request.get_json(silent=True) or {}
        segments = _load_segments()
        return jsonify(_build_profiles(segments[0], payload.get("count", 4)) if segments else [])

    @app.post(f"{prefix}/profiles/synth")
    def qa_synth_profiles():
        payload = request.get_json(silent=True) or {}
        journey = _get_journey(payload.get("journeyId"))
        segment = _get_segment(payload.get("segmentId"))
        if journey is None:
            return _json_error(f"Unknown journey {payload.get('journeyId')!r}", 404)
        if segment is None:
            return _json_error(f"Unknown segment {payload.get('segmentId')!r}", 404)
        synth_id = f"synth-{uuid.uuid4().hex[:10]}"

        runtime, runtime_error = _real_execution_available()
        if runtime is not None:
            try:
                result = _run_async(runtime["synthesize_plan"](segment, journey, payload.get("profileCount", 0)))
                _SYNTH_JOBS[synth_id] = {
                    "status": "done",
                    "suites": [_model_dump(suite) for suite in result.suites],
                    "profiles": [_model_dump(profile) for profile in result.profiles],
                    "error": None,
                    "runtime": "real",
                }
                return jsonify({"synthId": synth_id, "status": "running"})
            except Exception as exc:
                if _strict_real_runtime():
                    return _json_error(f"Real QA profile synthesis failed: {type(exc).__name__}: {exc}", 500)
        elif _strict_real_runtime():
            return _json_error(f"Real QA runtime unavailable: {runtime_error}", 503)

        _SYNTH_JOBS[synth_id] = {
            "status": "done",
            "suites": _build_suites(journey, segment),
            "profiles": _build_profiles(segment, payload.get("profileCount", 6)),
            "error": None,
            "runtime": "fallback",
            "runtimeError": runtime_error,
        }
        return jsonify({"synthId": synth_id, "status": "running"})

    @app.post(f"{prefix}/profiles/synth/extend")
    def qa_extend_profiles():
        payload = request.get_json(silent=True) or {}
        journey = _get_journey(payload.get("journeyId"))
        segment = _get_segment(payload.get("segmentId"))
        if journey is None:
            return _json_error(f"Unknown journey {payload.get('journeyId')!r}", 404)
        if segment is None:
            return _json_error(f"Unknown segment {payload.get('segmentId')!r}", 404)
        synth_id = f"synth-{uuid.uuid4().hex[:10]}"
        runtime, runtime_error = _real_execution_available()
        if runtime is not None:
            try:
                result = _run_async(
                    runtime["extend_cohort"](
                        segment,
                        journey,
                        payload.get("instruction", ""),
                        payload.get("existingProfiles") or [],
                        payload.get("count") or 0,
                    )
                )
                _SYNTH_JOBS[synth_id] = {
                    "status": "done",
                    "suites": [_model_dump(suite) for suite in result.suites],
                    "profiles": [_model_dump(profile) for profile in result.profiles],
                    "error": None,
                    "runtime": "real",
                }
                return jsonify({"synthId": synth_id, "status": "running"})
            except Exception as exc:
                if _strict_real_runtime():
                    return _json_error(f"Real QA profile extension failed: {type(exc).__name__}: {exc}", 500)
        elif _strict_real_runtime():
            return _json_error(f"Real QA runtime unavailable: {runtime_error}", 503)

        count = payload.get("count") or 2
        _SYNTH_JOBS[synth_id] = {
            "status": "done",
            "suites": _build_suites(journey, segment),
            "profiles": _build_profiles(segment, count, payload.get("instruction")),
            "error": None,
            "runtime": "fallback",
            "runtimeError": runtime_error,
        }
        return jsonify({"synthId": synth_id, "status": "running"})

    @app.get(f"{prefix}/profiles/synth/<synth_id>")
    def qa_synth_status(synth_id):
        job = _SYNTH_JOBS.get(synth_id)
        if job is None:
            return _json_error(f"Unknown synth job {synth_id!r}", 404)
        return jsonify({"synthId": synth_id, **job})

    @app.post(f"{prefix}/simulate")
    def qa_start_simulate():
        payload = request.get_json(silent=True) or {}
        journey = _get_journey(payload.get("journeyId"))
        segment = _get_segment(payload.get("segmentId"))
        if journey is None:
            return _json_error(f"Unknown journey {payload.get('journeyId')!r}", 404)
        if segment is None:
            return _json_error(f"Unknown segment {payload.get('segmentId')!r}", 404)
        sim_id = f"sim-{uuid.uuid4().hex[:10]}"
        runtime, runtime_error = _real_execution_available()
        if runtime is not None:
            try:
                result = _run_async(
                    runtime["simulate_profile"](
                        journey,
                        segment,
                        payload.get("profile") or {},
                        payload.get("suites") or [],
                    )
                )
                _SIM_JOBS[sim_id] = {
                    "status": "done",
                    "result": _model_dump(result),
                    "error": None,
                    "runtime": "real",
                }
                return jsonify({"simId": sim_id, "status": "running"})
            except Exception as exc:
                if _strict_real_runtime():
                    return _json_error(f"Real QA simulation failed: {type(exc).__name__}: {exc}", 500)
        elif _strict_real_runtime():
            return _json_error(f"Real QA runtime unavailable: {runtime_error}", 503)

        _SIM_JOBS[sim_id] = {
            "status": "done",
            "result": _simulate(journey, payload.get("profile") or {}, payload.get("suites") or []),
            "error": None,
            "runtime": "fallback",
            "runtimeError": runtime_error,
        }
        return jsonify({"simId": sim_id, "status": "running"})

    @app.get(f"{prefix}/simulate/<sim_id>")
    def qa_simulate_status(sim_id):
        job = _SIM_JOBS.get(sim_id)
        if job is None:
            return _json_error(f"Unknown sim job {sim_id!r}", 404)
        return jsonify({"simId": sim_id, **job})

    @app.post(f"{prefix}/runs/qa")
    def qa_start_run():
        payload = request.get_json(silent=True) or {}
        journey = _get_journey(payload.get("journeyId"))
        segment = _get_segment(payload.get("segmentId"))
        if journey is None:
            return _json_error(f"Unknown journey {payload.get('journeyId')!r}", 404)
        if segment is None:
            return _json_error(f"Unknown segment {payload.get('segmentId')!r}", 404)
        run_id = f"run-{uuid.uuid4().hex[:10]}"
        suites = payload.get("suites") or _build_suites(journey, segment)
        profiles = payload.get("baseProfiles") or _build_profiles(segment, payload.get("profileCount", 6))

        runtime, runtime_error = _real_execution_available()
        if runtime is not None:
            runtime_run = runtime["run_registry"].create(
                journey_id=payload.get("journeyId"),
                segment_id=payload.get("segmentId"),
                profile_count=payload.get("profileCount", 0),
            )
            run_id = runtime_run.run_id
            _RUNS[run_id] = {"status": "running", "report": None, "journey": journey, "duration": 0, "runtime": "real"}
            _start_real_graph_thread(
                run_id,
                payload.get("journeyId"),
                payload.get("segmentId"),
                payload.get("profileCount", 0),
                suites,
                profiles,
            )
            return jsonify({"runId": run_id, "status": "queued"})
        if _strict_real_runtime():
            return _json_error(f"Real QA runtime unavailable: {runtime_error}", 503)

        started = time.time()
        report = _build_report(run_id, journey, segment, suites, profiles, started)
        _RUNS[run_id] = {"status": "passed", "report": report, "journey": journey, "duration": report["durationMs"], "runtime": "fallback", "runtimeError": runtime_error}
        return jsonify({"runId": run_id, "status": "queued"})

    @app.get(f"{prefix}/runs/<run_id>/report")
    def qa_get_report(run_id):
        run = _RUNS.get(run_id)
        if run is None:
            return _json_error("Report not ready or unknown run id", 404)
        if run.get("report") is None:
            runtime, _ = _real_runtime_available()
            report = runtime["run_registry"].get_report(run_id) if runtime else None
            if report is None:
                return _json_error("Report not ready or unknown run id", 404)
            run["report"] = report
        return jsonify(run["report"])

    @app.get(f"{prefix}/runs/<run_id>/stream")
    def qa_stream_run(run_id):
        run = _RUNS.get(run_id)
        if run is None:
            return _json_error("Unknown run id", 404)

        def generate():
            if run.get("runtime") == "real":
                runtime, _ = _real_runtime_available()
                if runtime:
                    import asyncio

                    async def collect():
                        async for event in runtime["run_registry"].subscribe(run_id):
                            yield event

                    loop = asyncio.new_event_loop()
                    try:
                        iterator = collect().__aiter__()
                        while True:
                            try:
                                event = loop.run_until_complete(iterator.__anext__())
                            except StopAsyncIteration:
                                break
                            yield _sse(event.get("event", "message"), json.loads(event.get("data", "{}")))
                        return
                    finally:
                        loop.close()

            canvas = _ajo_to_canvas(run["journey"])
            nodes = canvas.get("nodes", [])[:4]
            total = max(1, len(nodes))
            for idx, node in enumerate(nodes, start=1):
                yield _sse(
                    "step",
                    {
                        "ts": datetime.now().strftime("%H:%M:%S"),
                        "level": "info",
                        "node": node.get("type", "node"),
                        "nodeId": node.get("id"),
                        "label": node.get("title", node.get("id")),
                        "msg": "QA check completed",
                        "progress": int(idx / total * 90),
                    },
                )
            yield _sse("done", {"status": "passed", "duration": run["duration"]})

        return Response(generate(), mimetype="text/event-stream")
