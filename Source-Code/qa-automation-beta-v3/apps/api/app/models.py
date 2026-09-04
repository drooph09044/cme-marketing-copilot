"""Pydantic models — wire format shared with the Next.js frontend."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


NodeType = Literal[
    "entry", "read_audience", "unitary_event", "business_event", "reaction_event",
    "condition", "wait", "wait_until", "jump", "split", "increment",
    "channel", "channel_email", "channel_push", "channel_sms", "channel_inapp",
    "channel_web", "channel_card", "channel_dm",
    "code", "custom_action", "ac_delivery",
    "update_audience", "update_profile",
    "data_source", "aep_query", "external_ds",
    "suppression", "criteria", "consent", "quiet_hours",
    "exit", "end_success", "end_error", "end_timeout",
]

CriterionStatus = Literal["ok", "warn", "err"]
ProfileTag = Literal["test", "control", "suppressed", "fcap-risk", "holdout"]
Bias = Literal["balanced", "edge", "compliant"]
WarnLevel = Literal["info", "warn", "err"]
RunStatus = Literal["idle", "running", "passed", "failed"]


class JourneyNode(BaseModel):
    id: str
    type: NodeType
    x: int
    y: int
    title: str
    sub: str
    meta: str | None = None


class Holdout(BaseModel):
    id: str
    name: str
    pct: int
    basis: str
    scope: str


class Suppression(BaseModel):
    id: str
    label: str
    count: int
    source: str


class Criterion(BaseModel):
    id: str
    label: str
    status: CriterionStatus
    note: str | None = None


# Edges are encoded as [from, to] or [from, to, label] tuples on the wire.
JourneyEdge = list[str]


class JourneySummary(BaseModel):
    id: str
    name: str
    status: str
    version: int
    updated: str
    owner: str


class Journey(JourneySummary):
    nodes: list[JourneyNode]
    edges: list[JourneyEdge]
    holdouts: list[Holdout]
    suppression: list[Suppression]
    criteria: list[Criterion]


class Profile(BaseModel):
    id: str
    name: str
    region: str
    age: int
    consent: bool
    fcap: int
    lastSend: str
    segment: str
    tag: ProfileTag


class GenerateProfilesRequest(BaseModel):
    count: int = Field(ge=1, le=500)
    bias: Bias = "balanced"


class TestEvent(BaseModel):
    eventType: str
    identityNamespace: str
    identifier: str
    waitOverrideSeconds: int = Field(ge=1, le=600)
    payload: Any = None


class RunStats(BaseModel):
    total: int
    eligible: int
    suppressed: int
    holdout: int
    test: int


class StartRunResponse(BaseModel):
    runId: str
    stats: RunStats


class StepEvent(BaseModel):
    ts: str
    level: WarnLevel
    node: str  # display id, same as nodeId
    nodeId: str
    label: str
    msg: str
    progress: int


class DoneEvent(BaseModel):
    status: Literal["passed", "failed"]
    duration: int
