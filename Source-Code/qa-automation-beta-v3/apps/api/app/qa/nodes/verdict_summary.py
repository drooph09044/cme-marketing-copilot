"""Write the executive summary + overall verdict for a QA run.

IMPORTANT — context-size safety: a QA run can produce hundreds of walk traces
(profiles × scenarios). Dumping every raw trace into the verdict prompt blows
past provider context limits (Anthropic 1M, OpenAI 128K, Azure varies). So we
AGGREGATE the walks into compact per-suite stats + a capped sample of failures
before calling the LLM, and compute the overall verdict DETERMINISTICALLY in
code. The prompt size is then bounded regardless of how many profiles ran.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.invoke_utils import invoke_structured
from app.qa.prompts import VERDICT_PROMPT
from app.qa.store import RunRegistry, registry as default_registry

logger = logging.getLogger(__name__)

# How many representative failing / warning walks to include in the prompt.
_MAX_FAILURE_SAMPLES = 20
_MAX_WARNING_SAMPLES = 10


class _VerdictResponse(BaseModel):
    verdict: str
    summary: str


def _failing_reason(walk: Any) -> str:
    """Pull the most relevant reason from a walk (the first failing step, else last)."""
    steps = getattr(walk, "steps", []) or []
    for s in steps:
        if s.verdict == "fail":
            return s.reason
    return steps[-1].reason if steps else ""


def aggregate_walks(walks: list[Any]) -> dict[str, Any]:
    """Compress walk traces into a compact, bounded summary for the LLM prompt.

    Returns counts, per-suite breakdown, eligible/ineligible tallies, and a
    capped sample of representative failures/warnings — never the full trace set.
    """
    counts = {"pass": 0, "warn": 0, "fail": 0}
    per_suite: dict[str, dict[str, int]] = {}
    eligible = {"pass": 0, "warn": 0, "fail": 0}
    ineligible = {"pass": 0, "warn": 0, "fail": 0}
    failures: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    for w in walks:
        v = w.verdict
        counts[v] = counts.get(v, 0) + 1
        p = w.profile or {}
        suite = p.get("suiteName", "?")
        bucket = per_suite.setdefault(suite, {"pass": 0, "warn": 0, "fail": 0})
        bucket[v] = bucket.get(v, 0) + 1

        cat_bucket = eligible if p.get("category") == "eligible" else ineligible
        cat_bucket[v] = cat_bucket.get(v, 0) + 1

        if v == "fail" and len(failures) < _MAX_FAILURE_SAMPLES:
            failures.append({
                "suite": suite,
                "scenario": p.get("scenario", ""),
                "category": p.get("category", ""),
                "endedAt": w.endedAt,
                "reason": _failing_reason(w),
            })
        elif v == "warn" and len(warnings) < _MAX_WARNING_SAMPLES:
            warnings.append({
                "suite": suite,
                "scenario": p.get("scenario", ""),
                "endedAt": w.endedAt,
                "reason": _failing_reason(w),
            })

    return {
        "total": len(walks),
        "counts": counts,
        "perSuite": per_suite,
        "eligible": eligible,
        "ineligible": ineligible,
        "sampleFailures": failures,
        "sampleWarnings": warnings,
    }


def compute_verdict(fit: Any, structure: list[Any], counts: dict[str, int]) -> str:
    """Deterministic overall verdict — no LLM tally needed.

    fail  : any walk fail, OR any err-severity structure finding, OR fit fail.
    warn  : otherwise, if any warn (walk, structure, or fit).
    pass  : otherwise.
    """
    fit_verdict = getattr(fit, "verdict", "pass")
    has_err = any(getattr(f, "severity", "") == "err" for f in structure)
    has_struct_warn = any(getattr(f, "severity", "") == "warn" for f in structure)

    if counts.get("fail", 0) > 0 or has_err or fit_verdict == "fail":
        return "fail"
    if counts.get("warn", 0) > 0 or has_struct_warn or fit_verdict == "warn":
        return "warn"
    return "pass"


async def verdict_summary(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    fit = state["fit"]
    structure = state.get("structure", [])
    walks = state.get("walks", [])

    # Aggregate first — bounds the prompt no matter how many walks ran.
    summary_data = aggregate_walks(walks)
    deterministic_verdict = compute_verdict(fit, structure, summary_data["counts"])

    logger.info(
        "verdict_summary — run=%s total_walks=%d counts=%s verdict=%s",
        run_id, summary_data["total"], summary_data["counts"], deterministic_verdict,
    )

    prompt = VERDICT_PROMPT.format(
        fit_json=fit.model_dump_json(),
        structure_json=json.dumps([f.model_dump() for f in structure]),
        walk_summary_json=json.dumps(summary_data),
        computed_verdict=deterministic_verdict,
    )

    try:
        resp = await invoke_structured(get_chat_model("verdict_summary"), prompt, _VerdictResponse)
        summary_text = resp.summary
    except Exception as exc:
        # Even if the summary LLM call fails, we still have a deterministic verdict.
        logger.warning("verdict_summary LLM call failed (%s); using fallback summary.", exc)
        c = summary_data["counts"]
        summary_text = (
            f"{summary_data['total']} profile walks completed: "
            f"{c['pass']} passed, {c['warn']} warnings, {c['fail']} failed. "
            f"Segment fit: {getattr(fit, 'verdict', '?')}. "
            f"{len(structure)} structural finding(s)."
        )

    # Always trust the deterministic verdict over the LLM's tally.
    verdict = deterministic_verdict

    level = "info" if verdict == "pass" else ("warn" if verdict == "warn" else "err")
    await emit_step(
        run_id,
        node_id="verdict_summary",
        label="Verdict",
        msg=summary_text[:140],
        progress=95,
        level=level,
        registry=reg,
    )
    return {"verdict": verdict, "summary": summary_text}
