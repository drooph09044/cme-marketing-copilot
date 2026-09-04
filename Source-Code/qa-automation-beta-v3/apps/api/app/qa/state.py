"""LangGraph state shared across QA nodes.

Reducers are not needed — each node returns a partial dict that LangGraph
merges into the state, except `walks` which uses a list-append reducer so
parallel fan-out walks accumulate cleanly.
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

from app.qa.schemas import Finding, FitFinding, WalkTrace


class QAState(TypedDict, total=False):
    run_id: str
    journey_id: str
    segment_id: str
    journey: dict[str, Any]
    segment: dict[str, Any]
    profile_count: int
    fit: FitFinding
    structure: list[Finding]
    # Walk-units (suite × profile) produced by profile_synth, consumed by the fan-out.
    profiles: list[dict[str, Any]]
    # The distinct profile cohort (every profile runs against every suite).
    cohort: list[dict[str, Any]]
    # Pre-generated concern suites — when present with base_profiles, profile_synth
    # skips the LLM call and builds walk-units = suites × base_profiles.
    suites: list[dict[str, Any]]
    # The profile cohort passed from the frontend for a QA run.
    base_profiles: list[dict[str, Any]]
    # Suite summaries (name + description + expected outcome + count) for the report.
    suite_summaries: list[dict[str, Any]]
    # Per-walk fields populated by the Send fan-out (only present inside walk_profile invocations):
    profile: dict[str, Any]
    profile_index: int
    profile_total: int
    walks: Annotated[list[WalkTrace], operator.add]
    verdict: str
    summary: str
