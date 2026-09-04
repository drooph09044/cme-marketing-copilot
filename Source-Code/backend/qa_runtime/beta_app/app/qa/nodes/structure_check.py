"""Run static structural rules, then ask the LLM to humanize each finding."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.invoke_utils import invoke_json_list
from app.qa.prompts import STRUCTURE_EXPLAIN_PROMPT
from app.qa.schemas import Finding
from app.qa.static_checks import run_static_checks
from app.qa.store import RunRegistry, registry as default_registry

logger = logging.getLogger(__name__)


async def structure_check(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    journey = state["journey"]

    await emit_step(run_id, node_id="structure_check", label="Journey structure",
                    msg="Running static checks…", progress=30, registry=reg)
    logger.info("structure_check started — run=%s", run_id)

    raw_findings = run_static_checks(journey)
    if not raw_findings:
        await emit_step(
            run_id,
            node_id="structure_check",
            label="Journey structure",
            msg="No structural issues detected.",
            progress=40,
            registry=reg,
        )
        return {"structure": []}

    prompt = STRUCTURE_EXPLAIN_PROMPT.format(
        findings_json=json.dumps([f.model_dump() for f in raw_findings]),
        journey_name=journey.get("name", "?"),
        tp_count=len(journey.get("touchpoints", [])),
    )

    enriched: list[Finding]
    try:
        items = await invoke_json_list(get_chat_model("structure_check"), prompt)
        enriched = [Finding.model_validate(item) for item in items]
    except Exception:
        enriched = raw_findings

    worst = "info"
    for f in enriched:
        if f.severity == "err":
            worst = "err"
            break
        if f.severity == "warn":
            worst = "warn"

    logger.info("structure_check done — run=%s findings=%d worst=%s", run_id, len(enriched), worst)
    await emit_step(
        run_id,
        node_id="structure_check",
        label="Journey structure",
        msg=f"{len(enriched)} structural finding(s).",
        progress=40,
        level=worst,
        registry=reg,
    )
    return {"structure": enriched}
