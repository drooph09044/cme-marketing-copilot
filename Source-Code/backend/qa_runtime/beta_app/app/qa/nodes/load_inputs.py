"""Resolve journey + segment by id and seed the QAState."""

from __future__ import annotations

from typing import Any

from app.data.loaders import get_journey_by_id, get_segment_by_id
from app.qa.emit import emit_step
from app.qa.store import RunRegistry, registry as default_registry


async def load_inputs(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    journey = get_journey_by_id(state["journey_id"])
    segment = get_segment_by_id(state["segment_id"])
    if journey is None or segment is None:
        raise LookupError(f"Unknown journey={state['journey_id']!r} or segment={state['segment_id']!r}")
    await emit_step(
        run_id,
        node_id="load_inputs",
        label="Load inputs",
        msg=f"Resolved journey {journey.get('name', '?')} and segment {segment.get('name', '?')}.",
        progress=5,
        registry=reg,
    )
    return {"journey": journey, "segment": segment}
