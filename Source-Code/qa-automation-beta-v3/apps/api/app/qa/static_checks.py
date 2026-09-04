"""Pure-Python structural rules over a raw journey dict.

Each function returns a list of `Finding`s. The LLM in `structure_check` can
later add human-readable colour to these, but failures are determined here.
"""

from __future__ import annotations

from typing import Any

from app.qa.schemas import Finding


def _nodes(journey: dict[str, Any]) -> list[dict[str, Any]]:
    return list(journey.get("journey", {}).get("nodes", []))


def _check_entry(journey: dict[str, Any]) -> list[Finding]:
    nodes = _nodes(journey)
    if not any(n.get("type") == "ENTRY" for n in nodes):
        return [Finding(nodeId="-", severity="err", message="Journey has no ENTRY node.")]
    return []


def _check_exit(journey: dict[str, Any]) -> list[Finding]:
    nodes = _nodes(journey)
    if not any(n.get("type") == "EXIT" for n in nodes):
        return [Finding(nodeId="-", severity="err", message="Journey has no EXIT node.")]
    return []


def _check_duplicate_ids(journey: dict[str, Any]) -> list[Finding]:
    seen: set[str] = set()
    dups: set[str] = set()
    for n in _nodes(journey):
        nid = n.get("id", "")
        if nid in seen:
            dups.add(nid)
        seen.add(nid)
    return [Finding(nodeId=d, severity="err", message=f"Duplicate node id detected: {d}") for d in sorted(dups)]


def _check_message_tpid(journey: dict[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    for n in _nodes(journey):
        if n.get("type") == "MESSAGE" and not n.get("tpId"):
            findings.append(Finding(nodeId=n.get("id", "-"), severity="warn", message="MESSAGE node has no tpId reference."))
    return findings


def _check_touchpoint_resolution(journey: dict[str, Any]) -> list[Finding]:
    defined = {tp.get("tpId") for tp in journey.get("touchpoints", []) if tp.get("tpId")}
    findings: list[Finding] = []
    for n in _nodes(journey):
        tpid = n.get("tpId")
        if tpid and tpid not in defined:
            findings.append(Finding(nodeId=n.get("id", "-"), severity="warn", message=f"Touchpoint {tpid} referenced but not defined."))
    return findings


_CHECKS = [
    _check_entry,
    _check_exit,
    _check_duplicate_ids,
    _check_message_tpid,
    _check_touchpoint_resolution,
]


def run_static_checks(journey: dict[str, Any]) -> list[Finding]:
    out: list[Finding] = []
    for fn in _CHECKS:
        out.extend(fn(journey))
    return out
