from __future__ import annotations

from pydantic import BaseModel

from app.qa.nodes.verdict_summary import verdict_summary
from app.qa.schemas import FitFinding, Finding, WalkStep, WalkTrace
from app.qa.store import RunRegistry


class _Resp(BaseModel):
    verdict: str
    summary: str


async def test_verdict_summary_writes_state(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    stub_model("verdict_summary", _Resp(verdict="warn", summary="overall warn"))
    state = {
        "run_id": run.run_id,
        "fit": FitFinding(verdict="pass", score=0.8, reasons=[], summary=""),
        "structure": [Finding(nodeId="n1", severity="warn", message="x")],
        "walks": [WalkTrace(profile={"id": "p1"}, steps=[WalkStep(nodeId="n1", verdict="pass", reason="ok")], endedAt="n1", verdict="pass")],
    }
    out = await verdict_summary(state, registry=reg)
    assert out["verdict"] == "warn"
    assert out["summary"] == "overall warn"
