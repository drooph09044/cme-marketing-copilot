"""Pydantic schemas for the QA pipeline — wire format with the frontend."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Verdict = Literal["pass", "warn", "fail"]
Severity = Literal["info", "warn", "err"]
StepLevel = Literal["info", "warn", "err"]


class FitFinding(BaseModel):
    verdict: Verdict
    score: float = Field(ge=0.0, le=1.0)
    reasons: list[str]
    summary: str = ""


class Finding(BaseModel):
    nodeId: str
    severity: Severity
    message: str


class WalkStep(BaseModel):
    nodeId: str
    verdict: Verdict
    reason: str


class WalkTrace(BaseModel):
    profile: dict[str, Any] = Field(default_factory=dict)
    steps: list[WalkStep]
    endedAt: str
    verdict: Verdict


class SuiteSummary(BaseModel):
    """Suite metadata carried through to the QA report so the UI can render
    the LLM-given suite names directly."""
    name: str
    description: str = ""
    expectedOutcome: str = ""
    profileCount: int = 0
    testCount: int = 0


class QAReport(BaseModel):
    runId: str
    journeyId: str
    segmentId: str
    modelProvider: str
    verdict: Verdict
    summary: str
    fit: FitFinding
    structure: list[Finding]
    walks: list[WalkTrace]
    suites: list[SuiteSummary] = []
    createdAt: str
    durationMs: int


class TestSuite(BaseModel):
    """A journey-level QA concern (Audience Qualification, Suppression, etc.).

    A suite is a *check applied to each profile* — not a group of profiles.
    `testCount` is how many individual test cases the suite covers for this journey.
    `profiles` is retained (optional) only for backward-compat with older payloads.
    """
    __test__ = False  # pytest: not a test class despite the Test* name

    name: str
    description: str = ""
    expectedOutcome: str = ""
    testCount: int = 0
    # Individual test cases this suite covers ({title, description}). The UI
    # shows these when a suite is expanded; testCount defaults to len(testCases).
    testCases: list[dict[str, Any]] = Field(default_factory=list)
    profiles: list[dict[str, Any]] = Field(default_factory=list)


SimVerdict = Literal["pass", "fail"]  # overall run verdict is binary
# A test case / step is PASS, FAIL, or SKIPPED ("DID NOT EXECUTE" — the journey
# stopped before this point, so the case never ran).
CaseStatus = Literal["pass", "fail", "skipped"]


class SimulationCheck(BaseModel):
    """One test-case result for a single profile.

    One check per test case of each suite — `suite` + `title` identify which
    suite test case this is, so the UI can show PASS / FAIL / DID NOT EXECUTE.
    """
    suite: str = ""                       # which suite this test case belongs to
    title: str                            # the test-case title (matches the suite's case)
    description: str = ""                 # what was evaluated / why it passed/failed/skipped
    status: CaseStatus


class SimulationStep(BaseModel):
    """One node the profile traversed during the simulation, in order."""
    nodeId: str                           # matches a journey node id (n1, n2, …)
    label: str = ""                       # short node label (e.g. "Day -60 Email")
    action: str = ""                      # entered / delivered / skipped / suppressed / converted / exited
    status: CaseStatus = "pass"


class SimulationResult(BaseModel):
    """Per-profile simulation — the journey path taken plus a PASS/FAIL per test case."""
    profileId: str
    expected: str = ""                    # expected outcome chip
    path: list[SimulationStep] = []       # ordered nodes the profile visited
    checks: list[SimulationCheck]
    verdict: SimVerdict


class SimulateRequest(BaseModel):
    journeyId: str
    segmentId: str
    profile: dict[str, Any]
    suites: list[TestSuite] = []


class SimulateJobResponse(BaseModel):
    simId: str
    status: Literal["running"]


class SimulateStatusResponse(BaseModel):
    simId: str
    status: Literal["running", "done", "failed"]
    result: SimulationResult | None = None
    error: str | None = None


class ProfileSynthRequest(BaseModel):
    journeyId: str
    segmentId: str
    profileCount: int = Field(default=0, ge=0, le=100)


class ProfileSynthResponse(BaseModel):
    """LLM payload — journey-level concern suites + the shared profile cohort.

    Every profile in `profiles` is run against EVERY suite at QA time.
    """
    suites: list[TestSuite]
    profiles: list[dict[str, Any]] = Field(default_factory=list)


class ProfileSynthExtendRequest(BaseModel):
    """Extend the cohort with profiles described in natural language."""
    journeyId: str
    segmentId: str
    instruction: str = Field(min_length=1, max_length=500)
    # Existing cohort (id + name) for context, so the LLM adds rather than duplicates.
    existingProfiles: list[dict[str, Any]] = []
    # How many profiles to add (0 = LLM decides from the instruction).
    count: int = Field(default=0, ge=0, le=50)


class ProfileSynthJobResponse(BaseModel):
    """Returned immediately from POST /profiles/synth.

    Frontend polls GET /profiles/synth/{synthId} until status flips to done/failed.
    """
    synthId: str
    status: Literal["running"]


class ProfileSynthStatusResponse(BaseModel):
    synthId: str
    status: Literal["running", "done", "failed"]
    suites: list[TestSuite] | None = None
    # The generated profile cohort (run against every suite).
    profiles: list[dict[str, Any]] | None = None
    error: str | None = None


class QARunRequest(BaseModel):
    journeyId: str
    segmentId: str
    # 0 = adaptive (LLM decides based on segment complexity). Non-zero acts as a soft hint.
    profileCount: int = Field(default=0, ge=0, le=100)
    # Pre-generated concern suites. When present, profile_synth skips the LLM call.
    suites: list[TestSuite] | None = None
    # The profile cohort. Every profile is run against EVERY suite (re-walk per
    # suite): the walk fan-out is the cross-product suites × profiles.
    baseProfiles: list[dict[str, Any]] | None = None


class QARunResponse(BaseModel):
    runId: str
    status: Literal["queued"]


class SegmentRule(BaseModel):
    id: str
    field: str
    value: str
    joiner: str = ""


class SegmentModel(BaseModel):
    id: str
    name: str
    purpose: str
    size: str
    refresh: str
    exclusions: str
    status: str
    rules: list[SegmentRule]
    isPreset: bool = False


class StepEventPayload(BaseModel):
    ts: str
    level: StepLevel
    node: str
    nodeId: str
    label: str
    msg: str
    progress: int


class DoneEventPayload(BaseModel):
    status: Literal["passed", "failed"]
    duration: int
    reportUrl: str
