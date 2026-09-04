from __future__ import annotations

import pytest

from app.qa.schemas import (
    FitFinding,
    Finding,
    Severity,
    Verdict,
    WalkStep,
    WalkTrace,
    QAReport,
    SegmentModel,
    QARunRequest,
)


def test_fit_finding_score_is_bounded():
    ok = FitFinding(verdict="pass", score=0.9, reasons=["matches"])
    assert ok.score == 0.9
    with pytest.raises(ValueError):
        FitFinding(verdict="pass", score=1.5, reasons=["x"])


def test_finding_requires_severity():
    f = Finding(nodeId="TP3", severity="warn", message="no fcap")
    assert f.severity == "warn"


def test_walk_trace_collects_steps():
    trace = WalkTrace(
        profile={"id": "p1", "name": "A"},
        steps=[WalkStep(nodeId="n1", verdict="pass", reason="entered")],
        endedAt="n1",
        verdict="pass",
    )
    assert trace.steps[0].verdict == "pass"


def test_qa_report_roundtrips():
    r = QAReport(
        runId="r1",
        journeyId="j1",
        segmentId="s1",
        modelProvider="anthropic",
        verdict="warn",
        summary="ok",
        fit=FitFinding(verdict="pass", score=0.8, reasons=[]),
        structure=[],
        walks=[],
        createdAt="2026-05-18T00:00:00Z",
        durationMs=10,
    )
    assert QAReport.model_validate(r.model_dump()).runId == "r1"


def test_qa_run_request_default_profile_count():
    req = QARunRequest(journeyId="j1", segmentId="s1")
    # 0 = adaptive (LLM decides cohort size based on segment complexity)
    assert req.profileCount == 0


def test_segment_model_parses_example_shape():
    seg = SegmentModel(
        id="seg_x",
        name="X",
        purpose="custom",
        size="1K",
        refresh="Daily",
        exclusions="None",
        status="Draft",
        rules=[{"id": "r1", "field": "LTV Tier", "value": "High", "joiner": ""}],
        isPreset=False,
    )
    assert seg.rules[0].field == "LTV Tier"
