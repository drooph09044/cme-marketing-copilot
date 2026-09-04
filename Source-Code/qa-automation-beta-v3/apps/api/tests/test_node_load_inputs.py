from __future__ import annotations

import pytest

from app.qa.nodes.load_inputs import load_inputs
from app.qa.store import RunRegistry


async def test_load_inputs_populates_state():
    reg = RunRegistry()
    run = reg.create(journey_id="season-ticket-renewal-journey", segment_id="seg_high_ltv_customers_who", profile_count=3)
    state = {"run_id": run.run_id, "journey_id": run.journey_id, "segment_id": run.segment_id, "profile_count": 3}
    out = await load_inputs(state, registry=reg)
    assert out["journey"]["useCaseId"] == "season-ticket-renewal-journey"
    assert out["segment"]["id"] == "seg_high_ltv_customers_who"


async def test_load_inputs_raises_for_unknown_ids():
    reg = RunRegistry()
    run = reg.create(journey_id="nope", segment_id="nope", profile_count=1)
    state = {"run_id": run.run_id, "journey_id": "nope", "segment_id": "nope", "profile_count": 1}
    with pytest.raises(LookupError):
        await load_inputs(state, registry=reg)
