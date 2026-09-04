"""Evaluate whether the chosen segment fits the chosen journey."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.invoke_utils import invoke_structured
from app.qa.prompts import FIT_PROMPT
from app.qa.schemas import FitFinding
from app.qa.store import RunRegistry, registry as default_registry

logger = logging.getLogger(__name__)


async def fit_check(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    journey = state["journey"]
    segment = state["segment"]

    await emit_step(run_id, node_id="fit_check", label="Segment fit check",
                    msg="Evaluating segment–journey fit…", progress=10, registry=reg)
    logger.info("fit_check started — run=%s journey=%s", run_id, journey.get("name", "?"))

    prompt = FIT_PROMPT.format(
        segment_json=json.dumps(segment),
        journey_name=journey.get("name", "?"),
        journey_goal=journey.get("journeyTable", {}).get("journeyGoal", "?"),
        entry_criteria_json=json.dumps(journey.get("entryCriteria", {})),
        tp_count=len(journey.get("touchpoints", [])),
    )

    finding = await invoke_structured(get_chat_model("fit_check"), prompt, FitFinding)

    level = "info" if finding.verdict == "pass" else ("warn" if finding.verdict == "warn" else "err")
    logger.info("fit_check done — run=%s verdict=%s score=%.2f", run_id, finding.verdict, finding.score)
    await emit_step(
        run_id,
        node_id="fit_check",
        label="Segment fit check",
        msg=finding.summary or f"Fit verdict: {finding.verdict} (score={finding.score:.2f})",
        progress=20,
        level=level,
        registry=reg,
    )
    return {"fit": finding}
