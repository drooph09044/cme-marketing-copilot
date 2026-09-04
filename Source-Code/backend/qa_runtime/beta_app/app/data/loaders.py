"""Load QA journeys and segments from the current application data stores.

The migrated beta runtime originally read only `examples/`. In this integrated
app, QA Automation should prefer the real app data under `data/journeys`,
`data/customJourneys`, and `data/customSegments`, while keeping the migrated
beta examples as additional fallback coverage.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any


def _root() -> Path:
    env = os.environ.get("QA_APP_ROOT")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[3]


ROOT = _root()
APP_JOURNEYS = ROOT / "data" / "journeys"
APP_CUSTOM_JOURNEYS = ROOT / "data" / "customJourneys"
APP_CUSTOM_SEGMENTS = ROOT / "data" / "customSegments"
EXAMPLES = Path(os.environ.get("EXAMPLES_DIR", ROOT / "data" / "qaAutomationExamples"))

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

def _rules_for(*pairs: tuple[str, str]) -> list[dict[str, str]]:
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


def _journey_id(payload: dict[str, Any]) -> str:
    return str(payload.get("useCaseId") or payload.get("slug") or payload.get("id") or payload.get("name") or "")


def _is_runnable_journey(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False
    if payload.get("useCaseId"):
        journey = payload.get("journey")
        nodes = journey.get("nodes") if isinstance(journey, dict) else None
        return bool(nodes)
    return bool(
        payload.get("slug")
        and (
            isinstance(payload.get("nodes"), list)
            or isinstance(payload.get("nodeOverrides"), dict)
            or isinstance(payload.get("journeyOverrides"), dict)
        )
    )


def _normalise_custom_journey(payload: dict[str, Any]) -> dict[str, Any]:
    journey_id = _journey_id(payload)
    journey_form = payload.get("journeyForm") or {}
    blueprint_form = payload.get("blueprintForm") or {}
    nodes = [dict(node) for node in (payload.get("nodes") or _BASE_FLOW_NODES)]
    for node in nodes:
        override = (payload.get("nodeOverrides") or {}).get(node.get("id"))
        if isinstance(override, dict):
            node.update(override)

    def node_type(node: dict[str, Any]) -> str:
        kind = str(node.get("kind") or node.get("lane") or "").lower()
        if kind in {"start", "trigger", "entry"}:
            return "ENTRY"
        if kind in {"end", "enddashed", "exit"}:
            return "EXIT"
        if kind in {"decision", "condition"}:
            return "CONDITION"
        if kind == "wait":
            return "WAIT"
        if kind in {"holdout", "split"}:
            return "SPLIT"
        return "MESSAGE"

    return {
        "useCaseId": journey_id,
        "name": payload.get("name") or journey_form.get("name") or journey_id,
        "category": {
            "categoryId": payload.get("categoryId") or journey_form.get("journeyCategory") or "custom",
            "categoryName": payload.get("categoryName") or journey_form.get("journeyCategory") or "Custom",
        },
        "status": "Draft",
        "version": 1,
        "journeyTable": {
            "journeyName": payload.get("name") or journey_form.get("name") or journey_id,
            "journeyGoal": journey_form.get("objective") or blueprint_form.get("brief") or "",
            "entryTrigger": journey_form.get("entryTrigger") or blueprint_form.get("singleTriggerEvent") or "",
            "journeyCategory": journey_form.get("journeyCategory") or payload.get("categoryName") or "Custom",
            "totalDuration": journey_form.get("duration") or "",
            "exitClause": "Exit at conversion or timeout",
        },
        "entryCriteria": {
            "event": journey_form.get("entryTrigger") or blueprint_form.get("singleTriggerEvent") or "",
            "eventId": f"evt_{journey_id}",
            "conditions": [],
            "audienceName": journey_form.get("audience") or "",
        },
        "touchpoints": [
            {
                "tpId": node.get("id"),
                "label": " ".join(str(part) for part in node.get("title", []) if part) if isinstance(node.get("title"), list) else str(node.get("title") or node.get("id")),
                "channel": str(node.get("lane") or "").upper(),
                "messageTheme": " ".join(str(part) for part in node.get("subtitle", []) if part) if isinstance(node.get("subtitle"), list) else str(node.get("subtitle") or ""),
            }
            for node in nodes
        ],
        "journey": {
            "nodes": [
                {
                    "id": node.get("id"),
                    "type": node_type(node),
                    "event": journey_form.get("entryTrigger") or blueprint_form.get("singleTriggerEvent"),
                    "tpId": node.get("id"),
                }
                for node in nodes
            ]
        },
        "nodes": nodes,
        "edges": payload.get("edges", _BASE_FLOW_EDGES),
        "nodeDetails": payload.get("nodeDetails", []),
        "_sourceShape": "custom",
    }


def _normalise_journey(payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("useCaseId") and isinstance(payload.get("journey"), dict):
        return payload
    return _normalise_custom_journey(payload)


def _read_json_candidates(directory: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if not directory.is_dir():
        return records
    for path in sorted(directory.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        candidates = data if isinstance(data, list) else [data]
        records.extend(item for item in candidates if isinstance(item, dict))
    return records


@lru_cache(maxsize=1)
def load_journeys() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for directory in (APP_JOURNEYS, APP_CUSTOM_JOURNEYS, EXAMPLES):
        for item in _read_json_candidates(directory):
            journey_id = _journey_id(item)
            if _is_runnable_journey(item) and journey_id and journey_id not in seen:
                seen.add(journey_id)
                out.append(_normalise_journey(item))
    out.sort(key=lambda j: j.get("name", j["useCaseId"]))
    if not out:
        raise FileNotFoundError("No runnable QA journeys found in app data stores.")
    return out


@lru_cache(maxsize=1)
def load_segments() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for segment in _BUILTIN_SEGMENTS:
        seen.add(segment["id"])
        out.append(dict(segment))
    for directory in (APP_CUSTOM_SEGMENTS, EXAMPLES / "segments"):
        for item in _read_json_candidates(directory):
            segment_id = item.get("id")
            if segment_id and segment_id not in seen:
                seen.add(segment_id)
                out.append(item)
    return out


def get_journey_by_id(journey_id: str) -> dict[str, Any] | None:
    return next((j for j in load_journeys() if j.get("useCaseId") == journey_id), None)


def get_segment_by_id(segment_id: str) -> dict[str, Any] | None:
    return next((s for s in load_segments() if s.get("id") == segment_id), None)
