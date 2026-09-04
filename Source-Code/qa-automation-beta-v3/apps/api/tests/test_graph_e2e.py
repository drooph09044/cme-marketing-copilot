from __future__ import annotations

import json

import pytest
from pydantic import BaseModel

from app.qa.graph import build_qa_graph
from app.qa.schemas import FitFinding, Finding, ProfileSynthResponse, TestSuite, WalkStep, WalkTrace
from app.qa.store import RunRegistry


class _VerdictResp(BaseModel):
    verdict: str
    summary: str


async def test_graph_end_to_end_with_stub_llms(stub_model):
    reg = RunRegistry()
    run = reg.create(
        journey_id="season-ticket-renewal-journey",
        segment_id="seg_high_ltv_customers_who",
        profile_count=2,
    )

    stub_model("fit_check", FitFinding(verdict="pass", score=0.9, reasons=["aligned"], summary="ok"))
    stub_model("structure_check", [])
    stub_model("profile_synth", ProfileSynthResponse(suites=[
        TestSuite(
            name="Happy Path",
            description="Eligible profiles.",
            profiles=[
                {"id": "p1", "name": "A", "category": "eligible", "suiteName": "Happy Path"},
                {"id": "p2", "name": "B", "category": "ineligible", "suiteName": "Happy Path"},
            ],
        ),
    ]))
    stub_model("walk_profile", WalkTrace(
        profile={},  # node will overwrite
        steps=[WalkStep(nodeId="n1", verdict="pass", reason="ok")],
        endedAt="n1",
        verdict="pass",
    ))
    stub_model("verdict_summary", _VerdictResp(verdict="pass", summary="all good"))

    graph = build_qa_graph(registry=reg)
    final = await graph.ainvoke({
        "run_id": run.run_id,
        "journey_id": "season-ticket-renewal-journey",
        "segment_id": "seg_high_ltv_customers_who",
        "profile_count": 2,
    })
    assert final["verdict"] == "pass"
    # 2 Happy Path profiles + 1 injected Holdout template = 3 walks.
    assert len(final["walks"]) == 3
    assert final["fit"].verdict == "pass"
