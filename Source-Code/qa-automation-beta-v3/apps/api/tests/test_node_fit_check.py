from __future__ import annotations

from app.qa.nodes.fit_check import fit_check
from app.qa.schemas import FitFinding
from app.qa.store import RunRegistry


async def test_fit_check_writes_finding_to_state(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    stub_model("fit_check", FitFinding(verdict="pass", score=0.9, reasons=["aligned"], summary="ok"))
    state = {
        "run_id": run.run_id,
        "journey": {"name": "Renewal", "journeyTable": {"journeyGoal": "renew"}, "entryCriteria": {"event": "x"}, "touchpoints": [1, 2]},
        "segment": {"id": "s1", "rules": []},
    }
    out = await fit_check(state, registry=reg)
    assert isinstance(out["fit"], FitFinding)
    assert out["fit"].verdict == "pass"
