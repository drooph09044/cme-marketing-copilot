from __future__ import annotations

import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.llm import router as router_mod
from app.main import app
from app.qa.schemas import FitFinding, WalkStep, WalkTrace


class _Resp(BaseModel):
    verdict: str
    summary: str


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
def _install_stubs():
    class Stub:
        def __init__(self, r): self.r = r
        def bind(self, **_kw): return self
        def with_structured_output(self, _s, **_kw): return self
        def invoke(self, _p): return self.r
        async def ainvoke(self, _p): return self.r

    router_mod.set_override("fit_check", Stub(FitFinding(verdict="pass", score=0.9, reasons=[], summary="ok")))
    router_mod.set_override("structure_check", Stub([]))
    from app.qa.schemas import ProfileSynthResponse, TestSuite
    router_mod.set_override("profile_synth", Stub(ProfileSynthResponse(
        suites=[TestSuite(name="Audience Qualification", description="Who enters.")],
        profiles=[
            {"id": "p1", "name": "A", "archetype": "early_convert", "category": "eligible"},
        ],
    )))
    router_mod.set_override("walk_profile", Stub(WalkTrace(
        profile={}, steps=[WalkStep(nodeId="n1", verdict="pass", reason="ok")], endedAt="n1", verdict="pass",
    )))
    router_mod.set_override("verdict_summary", Stub(_Resp(verdict="pass", summary="all clear")))
    yield
    router_mod.clear_overrides()


async def test_post_runs_qa_returns_run_id(client):
    resp = await client.post("/runs/qa", json={
        "journeyId": "season-ticket-renewal-journey",
        "segmentId": "seg_high_ltv_customers_who",
        "profileCount": 1,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "runId" in body and body["status"] == "queued"


async def test_post_runs_qa_404_on_unknown_ids(client):
    resp = await client.post("/runs/qa", json={"journeyId": "x", "segmentId": "y"})
    assert resp.status_code == 404


async def test_qa_run_produces_report(client):
    resp = await client.post("/runs/qa", json={
        "journeyId": "season-ticket-renewal-journey",
        "segmentId": "seg_high_ltv_customers_who",
        "profileCount": 1,
    })
    run_id = resp.json()["runId"]
    # Give the background task time to finish (stubs are instant; small grace period).
    for _ in range(50):
        await asyncio.sleep(0.05)
        r = await client.get(f"/runs/{run_id}/report")
        if r.status_code == 200:
            break
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["verdict"] == "pass"
    assert report["modelProvider"] in ("anthropic", "openai", "azure_openai", "databricks")
    # Cohort = 1 stub profile + 1 injected holdout = 2; suites = Audience
    # Qualification + auto Exit Condition Logic = 2. Re-walk per suite → 2×2 = 4.
    assert len(report["walks"]) == 4
