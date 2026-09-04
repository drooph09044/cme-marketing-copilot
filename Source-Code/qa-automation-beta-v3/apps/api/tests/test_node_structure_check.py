from __future__ import annotations

from app.qa.nodes.structure_check import structure_check
from app.qa.schemas import Finding
from app.qa.store import RunRegistry


async def test_structure_check_uses_static_findings_when_llm_unavailable(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    # Stub returns the static findings unchanged (list of Finding-shaped dicts).
    stub_model("structure_check", [
        Finding(nodeId="-", severity="err", message="Journey has no EXIT node."),
    ])
    state = {
        "run_id": run.run_id,
        "journey": {
            "name": "Bad",
            "touchpoints": [],
            "journey": {"nodes": [
                {"id": "n1", "type": "ENTRY"},
                {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
            ]},
        },
    }
    out = await structure_check(state, registry=reg)
    assert any(f.severity == "err" for f in out["structure"])


async def test_structure_check_passes_clean_journey(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    stub_model("structure_check", [])
    state = {
        "run_id": run.run_id,
        "journey": {
            "name": "Good",
            "touchpoints": [{"tpId": "TP1"}],
            "journey": {"nodes": [
                {"id": "n1", "type": "ENTRY"},
                {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
                {"id": "n3", "type": "EXIT"},
            ]},
        },
    }
    out = await structure_check(state, registry=reg)
    assert out["structure"] == []
