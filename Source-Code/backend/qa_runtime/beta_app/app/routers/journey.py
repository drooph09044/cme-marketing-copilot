"""Journey endpoints — list summaries + return a single journey by id.

Data source: examples/journey.json. Maps AJO node shape to canvas-compatible
shape, deriving edges from explicit `next` / `branches` pointers (supports
CONDITION, WAIT, SPLIT branching).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.data.loaders import get_journey_by_id, load_journeys

router = APIRouter(tags=["journey"])

# AJO type → canvas NodeType
_CHANNEL_TO_NODE_TYPE: dict[str, str] = {
    "EMAIL": "channel_email",
    "PUSH": "channel_push",
    "SMS": "channel_sms",
    "INAPP": "channel_inapp",
    "WEB": "channel_web",
    "CARD": "channel_card",
    "DM": "channel_dm",
    "CALL": "channel",
}


def _node_outgoing_ids(n: dict[str, Any]) -> list[tuple[str, str]]:
    """Return [(target_id, edge_label)] for an AJO node's outgoing pointers.

    Supports several authoring shapes:
    - `branches: [{next, label/value}]`         (multi-way condition / split)
    - `trueBranch` / `falseBranch`              (binary CONDITION node)
    - `next`                                    (plain sequential pointer)
    Target ids may be a literal node id, or "EXIT"/"END" which the caller resolves.
    """
    out: list[tuple[str, str]] = []
    if isinstance(n.get("branches"), list):
        for b in n["branches"]:
            tgt = b.get("next")
            if not tgt:
                continue
            label = str(b.get("label") or b.get("value") or "")
            out.append((tgt, label))
    # Binary CONDITION node: trueBranch / falseBranch.
    if isinstance(n.get("trueBranch"), str):
        out.append((n["trueBranch"], "Yes"))
    if isinstance(n.get("falseBranch"), str):
        out.append((n["falseBranch"], "No"))
    if isinstance(n.get("next"), str):
        out.append((n["next"], ""))
    return out


def _ajo_to_canvas(raw: dict[str, Any]) -> dict[str, Any]:
    """Augment a raw AJO journey object with canvas-compatible fields."""
    tp_map: dict[str, dict[str, Any]] = {
        tp["tpId"]: tp for tp in raw.get("touchpoints", [])
    }
    ajo_nodes: list[dict[str, Any]] = raw.get("journey", {}).get("nodes", [])

    # Resolve a branch target ("EXIT"/"END" → the real exit node id) for traversal.
    _ids = {n["id"] for n in ajo_nodes}
    _exit = next((n["id"] for n in ajo_nodes if n.get("type") in ("EXIT", "END")), None)

    def _resolve_target(tgt: str) -> str | None:
        if tgt in _ids:
            return tgt
        if tgt.upper() in ("EXIT", "END") and _exit:
            return _exit
        return None

    # Compute depth (distance from ENTRY) so branches stagger horizontally.
    # Simple BFS that follows real edges (explicit pointers OR sequential flow).
    by_id = {n["id"]: n for n in ajo_nodes}
    depth: dict[str, int] = {}
    entry = next((n for n in ajo_nodes if n.get("type") == "ENTRY"), ajo_nodes[0] if ajo_nodes else None)
    if entry:
        queue: list[tuple[str, int]] = [(entry["id"], 0)]
        while queue:
            nid, d = queue.pop(0)
            if nid in depth and depth[nid] <= d:
                continue
            depth[nid] = d
            node = by_id.get(nid)
            if not node:
                continue
            targets = [t for t, _ in _node_outgoing_ids(node)]
            resolved = [r for r in (_resolve_target(t) for t in targets) if r]
            # No explicit pointers → implicit sequential flow to the next node.
            if not resolved and node.get("type") not in ("EXIT", "END"):
                idx = ajo_nodes.index(node)
                if idx + 1 < len(ajo_nodes):
                    resolved = [ajo_nodes[idx + 1]["id"]]
            for tgt in resolved:
                if tgt not in depth:
                    queue.append((tgt, d + 1))

    # Group nodes by depth so siblings appear side-by-side.
    depth_groups: dict[int, list[str]] = {}
    for nid, d in depth.items():
        depth_groups.setdefault(d, []).append(nid)
    # Fallback for any unreached nodes
    max_d = max(depth.values(), default=0)
    for n in ajo_nodes:
        if n["id"] not in depth:
            max_d += 1
            depth[n["id"]] = max_d
            depth_groups.setdefault(max_d, []).append(n["id"])

    canvas_nodes: list[dict[str, Any]] = []
    for n in ajo_nodes:
        ajo_type = n.get("type", "")
        if ajo_type == "ENTRY":
            node_type, title, sub = "entry", n.get("event", "Entry"), n.get("eventId", "")
        elif ajo_type == "EXIT":
            node_type, title, sub = "exit", "Exit", ""
        elif ajo_type == "CONDITION":
            node_type = "condition"
            title = "If " + str(n.get("field", "?"))
            sub = " | ".join(str(b.get("value", "")) for b in n.get("branches", [])) or "branch"
        elif ajo_type == "WAIT":
            node_type, title, sub = "wait", "Wait", str(n.get("duration", ""))
        elif ajo_type == "SPLIT":
            node_type = "split"
            weights = n.get("weights") or []
            title = "A/B Split"
            sub = "/".join(str(w) for w in weights) + "%" if weights else (n.get("splitType") or "split")
        else:  # MESSAGE
            tp = tp_map.get(n.get("tpId", ""), {})
            channel = tp.get("channel", "")
            if isinstance(channel, list):
                channel = channel[0] if channel else ""
            node_type = _CHANNEL_TO_NODE_TYPE.get(str(channel).upper(), "channel")
            title = tp.get("label") or n.get("tpId") or ajo_type.title()
            sub = str(channel).upper() if channel else (n.get("tpId") or "")

        d = depth.get(n["id"], 0)
        siblings = depth_groups.get(d, [n["id"]])
        col = siblings.index(n["id"]) if n["id"] in siblings else 0
        cols = max(1, len(siblings))
        # Horizontal layout: depth flows left→right; siblings spread vertically.
        x = 60 + d * 240
        y = 240 + (col - (cols - 1) / 2) * 110

        canvas_nodes.append({
            "id": n["id"],
            "type": node_type,
            "x": int(round(x)),
            "y": int(round(y)),
            "title": title,
            "sub": sub,
        })

    # Resolve a branch target that may be a literal node id or "EXIT"/"END".
    node_ids = {n["id"] for n in ajo_nodes}
    exit_node = next(
        (n["id"] for n in ajo_nodes if n.get("type") in ("EXIT", "END")), None
    )

    def _resolve(tgt: str) -> str | None:
        if tgt in node_ids:
            return tgt
        if tgt.upper() in ("EXIT", "END") and exit_node:
            return exit_node
        return None

    # Edges: per node, use its explicit outgoing pointers (next / branches /
    # trueBranch / falseBranch). A node with NO explicit pointer that isn't a
    # terminal node falls through to the next node in declaration order — this
    # keeps linear chains connected WITHOUT flattening real branches.
    edges: list[list[str]] = []
    for i, n in enumerate(ajo_nodes):
        outgoing = _node_outgoing_ids(n)
        if outgoing:
            for tgt, label in outgoing:
                rt = _resolve(tgt)
                if rt is None:
                    continue
                edges.append([n["id"], rt, label] if label else [n["id"], rt])
        elif n.get("type") not in ("EXIT", "END") and i + 1 < len(ajo_nodes):
            # Implicit sequential flow to the next node.
            edges.append([n["id"], ajo_nodes[i + 1]["id"]])

    # Entry criteria → criteria list for the Criteria tab
    criteria: list[dict[str, Any]] = []
    for i, cond in enumerate(raw.get("entryCriteria", {}).get("conditions", [])):
        criteria.append({
            "id": f"crit_{i}",
            "label": f"{cond.get('field', '?')} {cond.get('operator', '=')} {cond.get('value', '')}",
            "status": "ok",
        })
    # Trigger event itself counts as an implicit entry condition
    if raw.get("entryCriteria", {}).get("event"):
        criteria.insert(0, {
            "id": "crit_event",
            "label": f"Trigger: {raw['entryCriteria']['event']}",
            "status": "ok",
            "note": raw["entryCriteria"].get("eventId", ""),
        })

    # Holdouts + suppression are read STRICTLY from per-journey config in
    # journey.json. No demo defaults — if the journey doesn't define them,
    # the Criteria tab will show empty-state messaging.
    holdouts = raw.get("holdouts", [])
    suppression = raw.get("suppression", [])

    return {
        **raw,
        "id": raw["useCaseId"],
        "nodes": canvas_nodes,
        "edges": edges,
        "holdouts": holdouts,
        "suppression": suppression,
        "criteria": criteria,
        "version": int(float(raw.get("version", 1))),
        "updated": "",
        "owner": "",
    }


@router.get("/journeys")
def list_journeys() -> list[dict[str, Any]]:
    """Lightweight list for the journey dropdown."""
    return [
        {
            "id": j["useCaseId"],
            "name": j.get("name", j["useCaseId"]),
            "category": j.get("category", {}).get("categoryName", "Uncategorized"),
            "status": j.get("status", "Draft"),
            "version": int(float(j.get("version", 1))),
            "updated": "",
            "owner": "",
        }
        for j in load_journeys()
    ]


@router.get("/journey")
def get_journey(id: str = Query(..., description="Journey useCaseId")) -> dict[str, Any]:
    raw = get_journey_by_id(id)
    if raw is None:
        raise HTTPException(status_code=404, detail=f"Unknown journey {id!r}")
    return _ajo_to_canvas(raw)
