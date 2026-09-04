from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
JOURNEY_DIR = DATA_DIR / "journeys"
CUSTOM_JOURNEY_DIR = DATA_DIR / "customJourneys"
CUSTOM_SEGMENT_DIR = DATA_DIR / "customSegments"
QA_EXAMPLES_DIR = DATA_DIR / "qaAutomationExamples"
BETA_EXAMPLES_DIR = ROOT / "qa-automation-beta-v3" / "examples"
SUPPORTED_SOURCE_SYSTEMS = ("media", "sports", "telecom", "automotive")

CHANNEL_TO_NODE_TYPE = {
    "EMAIL": "channel_email",
    "PUSH": "channel_push",
    "SMS": "channel_sms",
    "INAPP": "channel_inapp",
    "WEB": "channel_web",
    "CARD": "channel_card",
    "DM": "channel_dm",
    "CALL": "channel",
}

KIND_TO_NODE_TYPE = {
    "start": "entry",
    "holdout": "condition",
    "split": "split",
    "action": "channel",
    "decision": "condition",
    "wait": "wait",
    "end": "exit",
    "endDashed": "exit",
}

BUILT_IN_SEGMENTS = [
    {
        "id": "seg-01",
        "name": "Recent_Event_Attendees_No_Purchase",
        "purpose": "Ticketing conversion",
        "size": "8.4K",
        "refresh": "Streaming + 15m batch",
        "exclusions": "Opt-out, active journey, premium buyers",
        "status": "Ready for activation",
        "rules": [{"id": "rule-1", "field": "LTV Tier", "value": "High", "joiner": ""}],
        "sourceSystem": "sports",
        "isPreset": True,
    },
    {
        "id": "seg-02",
        "name": "Subscription_Renewal_Window_10d",
        "purpose": "Renewal urgency",
        "size": "6.2K",
        "refresh": "Hourly",
        "exclusions": "Renewed, do-not-renew, collections",
        "status": "Production ready",
        "rules": [{"id": "rule-1", "field": "Engagement Tier", "value": "High", "joiner": ""}],
        "sourceSystem": "media",
        "isPreset": True,
    },
    {
        "id": "seg-03",
        "name": "Recent_Attendees_No_App_30d",
        "purpose": "Engagement reactivation",
        "size": "7.9K",
        "refresh": "Nightly + app stream",
        "exclusions": "Recent sessions, recent purchasers",
        "status": "Ready for activation",
        "rules": [{"id": "rule-1", "field": "Recency", "value": "Medium", "joiner": ""}],
        "sourceSystem": "sports",
        "isPreset": True,
    },
    {
        "id": "seg-04",
        "name": "Lapsed_Customers_45d",
        "purpose": "Win-back",
        "size": "5.7K",
        "refresh": "Daily",
        "exclusions": "Recent buyers, global holdout",
        "status": "In QA review",
        "rules": [{"id": "rule-1", "field": "Engagement Tier", "value": "Low", "joiner": ""}],
        "sourceSystem": "media",
        "isPreset": True,
    },
    {
        "id": "seg-05",
        "name": "Recent_Merch_Buyers_90d",
        "purpose": "Commerce retention",
        "size": "4.8K",
        "refresh": "Daily",
        "exclusions": "Recent pre-order registrants",
        "status": "Production ready",
        "rules": [{"id": "rule-1", "field": "Content Affinity", "value": "High", "joiner": ""}],
        "sourceSystem": "sports",
        "isPreset": True,
    },
    {
        "id": "seg-07",
        "name": "App_Dormant_21d",
        "purpose": "App return",
        "size": "9.6K",
        "refresh": "Hourly",
        "exclusions": "New installs, active subscribers",
        "status": "Ready for activation",
        "rules": [{"id": "rule-1", "field": "Engagement Tier", "value": "Low", "joiner": ""}],
        "sourceSystem": "sports",
        "isPreset": True,
    },
]


def read_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def slugify(value: Any, fallback: str = "journey") -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return cleaned or fallback


def stable_journey_id(raw: dict[str, Any]) -> str:
    return str(raw.get("useCaseId") or raw.get("slug") or raw.get("id") or slugify(raw.get("name"), "journey"))


def infer_source_system(raw: dict[str, Any]) -> str:
    text = " ".join(
        str(raw.get(k) or "")
        for k in ("sourceSystem", "source_system", "categoryId", "categoryName", "subCategoryName", "name", "slug")
    ).lower()
    for source in SUPPORTED_SOURCE_SYSTEMS:
        if source in text:
            return source
    if "ticket" in text or "fan" in text or "merch" in text:
        return "sports"
    if "subscription" in text or "stream" in text or "content" in text:
        return "media"
    if "vehicle" in text or "service" in text:
        return "automotive"
    if "telco" in text or "plan" in text:
        return "telecom"
    return "sports"


def title_text(value: Any) -> str:
    if isinstance(value, list):
        return " ".join(str(part) for part in value if part)
    return str(value or "")


def current_graph_to_canvas(raw: dict[str, Any]) -> dict[str, Any]:
    nodes = []
    for index, node in enumerate(raw.get("nodes") or []):
        kind = node.get("kind") or node.get("type") or "action"
        lane = node.get("lane") or ""
        node_type = KIND_TO_NODE_TYPE.get(kind, "channel")
        if lane in {"email", "push", "sms"}:
            node_type = f"channel_{lane}"
        nodes.append(
            {
                "id": str(node.get("id") or f"n{index}"),
                "type": node_type,
                "x": 60 + int(node.get("column") or index) * 210,
                "y": 240 + int(node.get("offsetY") or 0),
                "title": title_text(node.get("title")) or kind.title(),
                "sub": title_text(node.get("subtitle")),
            }
        )
    edges = []
    for edge in raw.get("edges") or []:
        if edge.get("from") and edge.get("to"):
            item = [edge["from"], edge["to"]]
            if edge.get("label"):
                item.append(edge["label"])
            edges.append(item)
    form = raw.get("journeyForm") or raw.get("blueprintForm") or {}
    return finish_canvas(raw, nodes, edges, form)


def ajo_to_canvas(raw: dict[str, Any]) -> dict[str, Any]:
    touchpoints = {tp.get("tpId"): tp for tp in raw.get("touchpoints") or []}
    ajo_nodes = (raw.get("journey") or {}).get("nodes") or []
    nodes = []
    for index, node in enumerate(ajo_nodes):
        ajo_type = str(node.get("type") or "").upper()
        if ajo_type == "ENTRY":
            node_type, title, sub = "entry", node.get("event") or "Entry", node.get("eventId") or ""
        elif ajo_type in {"EXIT", "END"}:
            node_type, title, sub = "exit", "Exit", ""
        elif ajo_type == "CONDITION":
            node_type, title, sub = "condition", f"If {node.get('field', '?')}", "branch"
        elif ajo_type == "WAIT":
            node_type, title, sub = "wait", "Wait", node.get("duration") or ""
        elif ajo_type == "SPLIT":
            node_type, title, sub = "split", "A/B Split", node.get("splitType") or "split"
        else:
            tp = touchpoints.get(node.get("tpId")) or {}
            channel = tp.get("channel") or ""
            if isinstance(channel, list):
                channel = channel[0] if channel else ""
            node_type = CHANNEL_TO_NODE_TYPE.get(str(channel).upper(), "channel")
            title = tp.get("label") or node.get("tpId") or "Message"
            sub = str(channel).upper() if channel else node.get("tpId") or ""
        nodes.append({"id": node.get("id") or f"n{index}", "type": node_type, "x": 60 + index * 210, "y": 240, "title": title, "sub": sub})
    node_ids = {n["id"] for n in nodes}
    exit_id = next((n["id"] for n in nodes if n["type"] == "exit"), None)

    def resolve(target: str | None) -> str | None:
        if not target:
            return None
        if target in node_ids:
            return target
        if str(target).upper() in {"EXIT", "END"}:
            return exit_id
        return None

    edges = []
    for index, node in enumerate(ajo_nodes):
        src = node.get("id")
        outgoing = []
        for branch in node.get("branches") or []:
            outgoing.append((branch.get("next"), branch.get("label") or branch.get("value") or ""))
        outgoing.extend([(node.get("trueBranch"), "Yes"), (node.get("falseBranch"), "No"), (node.get("next"), "")])
        added = False
        for target, label in outgoing:
            resolved = resolve(target)
            if resolved:
                item = [src, resolved]
                if label:
                    item.append(str(label))
                edges.append(item)
                added = True
        if not added and index + 1 < len(ajo_nodes) and str(node.get("type")).upper() not in {"EXIT", "END"}:
            edges.append([src, ajo_nodes[index + 1].get("id")])
    return finish_canvas(raw, nodes, edges, raw.get("journeyTable") or {})


def brief_to_canvas(raw: dict[str, Any]) -> dict[str, Any]:
    overrides = raw.get("nodeOverrides") or {}
    journey_overrides = raw.get("journeyOverrides") or {}

    def label(node_id: str, fallback: str) -> tuple[str, str]:
        override = overrides.get(node_id) or {}
        return title_text(override.get("title")) or fallback, title_text(override.get("subtitle"))

    specs = [
        ("n0", "entry", "Audience Qualified"),
        ("n1", "condition", "Holdout Gate"),
        ("n2", "split", "A/B Split"),
        ("n3", "channel_email", "Email 1A"),
        ("n3b", "channel_email", "Email 1B"),
        ("n4", "condition", "Engaged?"),
        ("n5", "wait", "Wait"),
        ("n6", "channel_push", "Push"),
        ("n7", "condition", "Converted?"),
        ("n8", "exit", "Exit Converted"),
        ("n9", "exit", "Exit Timeout"),
    ]
    nodes = []
    for index, (node_id, node_type, fallback) in enumerate(specs):
        title, sub = label(node_id, fallback)
        nodes.append({"id": node_id, "type": node_type, "x": 60 + index * 190, "y": 240 + (70 if node_id.endswith("b") else 0), "title": title, "sub": sub})
    edges = [["n0", "n1"], ["n1", "n2", "Eligible"], ["n2", "n3", "Var A"], ["n2", "n3b", "Var B"], ["n3", "n4"], ["n3b", "n4"], ["n4", "n5", "Yes"], ["n4", "n6", "No"], ["n5", "n6"], ["n6", "n7"], ["n7", "n8", "Yes"], ["n7", "n9", "No"]]
    return finish_canvas(raw, nodes, edges, {**journey_overrides, **(raw.get("journeyForm") or {})})


def finish_canvas(raw: dict[str, Any], nodes: list[dict[str, Any]], edges: list[list[str]], form: dict[str, Any]) -> dict[str, Any]:
    journey_id = stable_journey_id(raw)
    criteria = []
    entry = raw.get("entryCriteria") or {}
    if entry.get("event"):
        criteria.append({"id": "crit_event", "label": f"Trigger: {entry.get('event')}", "status": "ok", "note": entry.get("eventId") or ""})
    if entry.get("audienceName") or form.get("audience"):
        criteria.append({"id": "crit_audience", "label": f"Audience: {entry.get('audienceName') or form.get('audience')}", "status": "ok"})
    for index, cond in enumerate(entry.get("conditions") or []):
        criteria.append({"id": f"crit_{index}", "label": f"{cond.get('field')} {cond.get('operator')} {cond.get('value')}", "status": "ok"})
    if not criteria and form.get("entryTrigger"):
        criteria.append({"id": "crit_trigger", "label": f"Trigger: {form.get('entryTrigger')}", "status": "ok"})
    holdout = form.get("holdout") or raw.get("holdout")
    holdouts = raw.get("holdouts") or ([{"id": "holdout", "name": "Journey holdout", "pct": int(holdout), "basis": "stable profile hash", "scope": "journey"}] if holdout else [])
    return {
        "id": journey_id,
        "name": raw.get("name") or form.get("name") or journey_id.replace("-", " ").title(),
        "category": (raw.get("category") or {}).get("categoryName") if isinstance(raw.get("category"), dict) else raw.get("categoryName") or form.get("journeyCategory") or infer_source_system(raw).title(),
        "sourceSystem": infer_source_system(raw),
        "status": raw.get("status") or ("Draft" if raw.get("isPreset") is False else "Ready"),
        "version": int(float(raw.get("version") or 1)),
        "updated": raw.get("updated") or "current app",
        "owner": raw.get("owner") or "EXL",
        "nodes": nodes,
        "edges": edges,
        "criteria": criteria,
        "holdouts": holdouts,
        "suppression": raw.get("suppression") or [{"id": "global", "label": "Global opt-out", "count": 0, "source": "current app"}],
        "_searchText": json.dumps(raw, ensure_ascii=False).lower(),
    }


def normalize_journey(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    if isinstance(raw.get("journey"), dict) and raw["journey"].get("nodes"):
        return ajo_to_canvas(raw)
    if raw.get("nodes") and raw.get("edges"):
        return current_graph_to_canvas(raw)
    if raw.get("slug") or raw.get("journeyOverrides") or raw.get("nodeOverrides"):
        return brief_to_canvas(raw)
    return None


@lru_cache(maxsize=1)
def load_journeys() -> list[dict[str, Any]]:
    paths = []
    for directory in (JOURNEY_DIR, CUSTOM_JOURNEY_DIR, QA_EXAMPLES_DIR, BETA_EXAMPLES_DIR):
        if directory.exists():
            paths.extend(sorted(directory.glob("*.json")))
    by_id = {}
    for path in paths:
        payload = read_json(path)
        candidates = payload if isinstance(payload, list) else [payload]
        for candidate in candidates:
            normalized = normalize_journey(candidate)
            if normalized and normalized["id"] not in by_id:
                by_id[normalized["id"]] = normalized
    return sorted(by_id.values(), key=lambda item: item["name"].lower())


def _custom_segment_to_qa(raw: dict[str, Any], path: Path | None = None) -> dict[str, Any]:
    seg_id = str(raw.get("id") or raw.get("slug") or (path.stem if path else "") or slugify(raw.get("name"), "segment"))
    rules = raw.get("rules") or raw.get("filters") or []
    if isinstance(rules, dict):
        rules = [{"id": key, "field": key, "value": value, "joiner": "AND"} for key, value in rules.items()]
    return {
        "id": seg_id,
        "name": raw.get("name") or seg_id.replace("-", " ").replace("_", " "),
        "purpose": raw.get("purpose") or raw.get("description") or raw.get("objective") or "Custom segment",
        "size": str(raw.get("size") or raw.get("rows") or raw.get("total") or "Custom"),
        "refresh": raw.get("refresh") or "On demand",
        "exclusions": raw.get("exclusions") or raw.get("exclude") or "Configured in source app",
        "status": raw.get("status") or "Ready for activation",
        "rules": rules if isinstance(rules, list) else [],
        "sourceSystem": raw.get("sourceSystem") or raw.get("source_system") or "",
        "isPreset": bool(raw.get("isPreset", False)),
        "_searchText": json.dumps(raw, ensure_ascii=False).lower(),
    }


@lru_cache(maxsize=1)
def load_segments() -> list[dict[str, Any]]:
    by_id = {seg["id"]: dict(seg, _searchText=json.dumps(seg, ensure_ascii=False).lower()) for seg in BUILT_IN_SEGMENTS}
    if CUSTOM_SEGMENT_DIR.exists():
        for path in sorted(CUSTOM_SEGMENT_DIR.glob("*.json")):
            raw = read_json(path)
            if isinstance(raw, dict):
                seg = _custom_segment_to_qa(raw, path)
                by_id.setdefault(seg["id"], seg)
    for beta_seg_dir in (QA_EXAMPLES_DIR / "segments", BETA_EXAMPLES_DIR / "segments"):
        if not beta_seg_dir.exists():
            continue
        for path in sorted(beta_seg_dir.glob("*.json")):
            raw = read_json(path)
            if isinstance(raw, dict):
                seg = _custom_segment_to_qa(raw, path)
                seg["isPreset"] = False
                by_id.setdefault(seg["id"], seg)
    return list(by_id.values())


def get_journey(journey_id: str) -> dict[str, Any] | None:
    return next((journey for journey in load_journeys() if journey["id"] == journey_id), None)


def get_segment(segment_id: str) -> dict[str, Any] | None:
    return next((segment for segment in load_segments() if segment["id"] == segment_id), None)


def ranked_segments_for_journey(journey_id: str | None) -> list[dict[str, Any]]:
    segments = load_segments()
    journey = get_journey(journey_id) if journey_id else None
    if not journey:
        return segments
    haystack = f"{journey.get('name', '')} {journey.get('category', '')} {journey.get('sourceSystem', '')} {journey.get('_searchText', '')}".lower()
    ranked = []
    for seg in segments:
        seg_text = f"{seg.get('name', '')} {seg.get('purpose', '')} {seg.get('status', '')} {seg.get('exclusions', '')} {seg.get('sourceSystem', '')} {seg.get('_searchText', '')}".lower()
        score = 0
        for token in re.findall(r"[a-z0-9]+", seg_text):
            if len(token) > 3 and token in haystack:
                score += 2
        if seg.get("sourceSystem") and seg.get("sourceSystem") == journey.get("sourceSystem"):
            score += 3
        name = seg.get("name", "").lower()
        if "app" in haystack and "dormant" in name:
            score += 20
        if "renewal" in haystack and "renewal" in name:
            score += 20
        if "merch" in haystack and "merch" in name:
            score += 20
        ranked.append((score, seg))
    matches = [seg for score, seg in sorted(ranked, key=lambda item: (-item[0], item[1]["name"])) if score > 0]
    return matches or segments


def runtime_status() -> dict[str, Any]:
    missing = []
    provider = os.environ.get("QA_MODEL_PROVIDER") or os.environ.get("MODEL_PROVIDER") or "fallback"
    strict = os.environ.get("QA_AUTOMATION_STRICT_RUNTIME", "").lower() in {"1", "true", "yes"}
    if provider in {"openai", "azure_openai"} and not os.environ.get("OPENAI_API_KEY") and provider == "openai":
        missing.append("OPENAI_API_KEY")
    if provider == "azure_openai":
        for key in ("AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT"):
            if not os.environ.get(key):
                missing.append(key)
    if provider == "anthropic" and not os.environ.get("ANTHROPIC_API_KEY"):
        missing.append("ANTHROPIC_API_KEY")
    try:
        import pydantic  # noqa: F401
        pydantic_available = True
    except Exception:
        pydantic_available = False
    real_ready = pydantic_available and provider != "fallback" and not missing
    return {
        "mode": "real" if real_ready else "strict-missing-config" if strict else "fallback",
        "provider": provider,
        "realRuntimeAvailable": real_ready,
        "fallbackAvailable": not strict,
        "missingConfig": missing,
        "missingDependencies": [] if pydantic_available else ["pydantic"],
        "message": "QA fallback is active for deterministic local UAT." if not real_ready and not strict else "Real QA runtime is available.",
    }
