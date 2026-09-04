"""Run ONE test suite against ONE profile by simulating the journey walk.

Each walk-unit is a (suite × profile) pair. The walk evaluates the profile
through that suite's lens and emits a verdict. WAIT/timing between touchpoints is
SIMULATED with a short scaled pause so the run visibly steps through waits.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.invoke_utils import invoke_structured
from app.qa.prompts import WALK_PROMPT
from app.qa.schemas import WalkStep, WalkTrace
from app.qa.store import RunRegistry, registry as default_registry

logger = logging.getLogger(__name__)

# Max simultaneous LLM calls across all parallel walks (provider rate-limit guard).
_CONCURRENCY = int(os.environ.get("QA_CONCURRENCY", "2"))
_semaphore: asyncio.Semaphore | None = None

# Wait simulation: a short real pause is applied per walk to "simulate" the
# journey's timed touchpoint spacing. Total simulated wait per walk is capped so
# runs stay seconds-long. Tune via QA_WAIT_SIM_SECONDS (per walk, 0 = no pause).
_WAIT_SIM_SECONDS = float(os.environ.get("QA_WAIT_SIM_SECONDS", "0.6"))


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(_CONCURRENCY)
    return _semaphore


def _wait_span_days(touchpoints: list[dict[str, Any]]) -> int:
    """Total relative-day span across the journey's timed touchpoints (for display)."""
    days = [
        tp.get("timing", {}).get("relativeDay")
        for tp in touchpoints
        if isinstance(tp.get("timing"), dict) and tp["timing"].get("relativeDay") is not None
    ]
    days = [d for d in days if isinstance(d, (int, float))]
    return int(max(days) - min(days)) if len(days) >= 2 else 0


async def walk_profile(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    journey = state["journey"]
    profile = state["profile"]
    idx = int(state.get("profile_index", 0))
    total = int(state.get("profile_total", 1))

    suite_name = profile.get("suiteName", "QA")
    suite_desc = profile.get("_suiteDescription", "")
    suite_expected = profile.get("_suiteExpected", "")
    touchpoints = journey.get("touchpoints", [])
    nodes = journey.get("journey", {}).get("nodes", [])

    # Profile shown to the LLM — strip our internal underscore-prefixed fields.
    profile_for_llm = {k: v for k, v in profile.items() if not k.startswith("_")}

    prompt = WALK_PROMPT.format(
        suite_name=suite_name,
        suite_description=suite_desc,
        suite_expected=suite_expected,
        profile_json=json.dumps(profile_for_llm),
        nodes_json=json.dumps(nodes),
        touchpoints_json=json.dumps(touchpoints),
        entry_criteria_json=json.dumps(journey.get("entryCriteria", {})),
    )

    # Simulate the journey's wait/timing: a short scaled pause + a visible log line.
    span_days = _wait_span_days(touchpoints)
    if _WAIT_SIM_SECONDS > 0 and span_days > 0:
        await emit_step(
            run_id, node_id="wait_sim", label=f"{suite_name} — {profile.get('name', '?')}",
            msg=f"simulating {span_days}d of touchpoint spacing…", progress=55,
            node_instance=f"wait_sim:{profile.get('id', idx)}", registry=reg,
        )
        await asyncio.sleep(_WAIT_SIM_SECONDS)

    walk_errored = False
    try:
        async with _get_semaphore():
            trace = await invoke_structured(get_chat_model("walk_profile"), prompt, WalkTrace)
    except Exception as exc:
        # One walk failing (after retries) must NOT abort the whole run.
        walk_errored = True
        logger.error(
            "walk_profile errored — run=%s suite=%s profile=%s (%d/%d): %s",
            run_id, suite_name, profile.get("name", "?"), idx + 1, total, exc,
        )
        trace = WalkTrace(
            profile=profile_for_llm,
            steps=[WalkStep(
                nodeId="error", verdict="warn",
                reason=f"LLM call failed after retries ({type(exc).__name__}): {str(exc)[:200]}",
            )],
            endedAt="error", verdict="warn",
        )

    # Stamp the suite name back onto the profile so the report can group by suite.
    walked = dict(profile_for_llm)
    walked["suiteName"] = suite_name
    trace = trace.model_copy(update={"profile": walked})

    progress = 55 + int(((idx + 1) / total) * 30)
    level = "err" if (walk_errored or trace.verdict == "fail") else (
        "warn" if trace.verdict == "warn" else "info"
    )
    status = "LLM error" if walk_errored else trace.verdict
    await emit_step(
        run_id,
        node_id="walk_profile",
        label=f"{suite_name} — {profile.get('name', profile.get('id', '?'))}",
        msg=f"{profile.get('archetype', '?')} → {status}",
        progress=progress,
        level=level,
        node_instance=f"walk_profile:{suite_name}:{profile.get('id', idx)}",
        registry=reg,
    )
    return {"walks": [trace]}
