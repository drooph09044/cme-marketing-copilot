from __future__ import annotations

from app.qa.nodes.walk_profile import walk_profile
from app.qa.schemas import WalkTrace, WalkStep
from app.qa.store import RunRegistry


async def test_walk_profile_returns_trace(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    stub_model("walk_profile", WalkTrace(
        profile={"id": "p1", "name": "A"},
        steps=[
            WalkStep(nodeId="n1", verdict="pass", reason="entered"),
            WalkStep(nodeId="n2", verdict="pass", reason="message ok"),
            WalkStep(nodeId="n3", verdict="pass", reason="exit"),
        ],
        endedAt="n3",
        verdict="pass",
    ))
    state = {
        "run_id": run.run_id,
        "journey": {"journey": {"nodes": [{"id": "n1", "type": "ENTRY"}, {"id": "n2", "type": "MESSAGE"}, {"id": "n3", "type": "EXIT"}]}},
        "profile": {"id": "p1", "name": "A", "consent": True, "fcap": 0},
        "profile_index": 0,
        "profile_total": 1,
    }
    out = await walk_profile(state, registry=reg)
    assert isinstance(out["walks"], list) and len(out["walks"]) == 1
    assert out["walks"][0].verdict == "pass"
