"""Generate a QA TEST PLAN: journey-level CONCERN suites + a shared PROFILE COHORT.

Each suite is a check applied to the WHOLE cohort. At QA time every profile is
run against EVERY suite (re-walk per suite): the walk fan-out is the cross-product
suites × profiles. This node produces those walk-units.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.invoke_utils import invoke_structured
from app.qa.prompts import PROFILE_SYNTH_EXTEND_PROMPT, PROFILE_SYNTH_PROMPT, SIMULATE_PROMPT
from app.qa.schemas import ProfileSynthResponse, SimulationResult, TestSuite
from app.qa.store import RunRegistry, registry as default_registry

logger = logging.getLogger(__name__)

# Hard ceiling on total walk LLM calls (suites × profiles). 0 = unlimited.
# When exceeded, the cohort is sampled down (suites are never dropped) so every
# suite still runs. Override via QA_MAX_WALKS.
_MAX_WALKS = int(os.environ.get("QA_MAX_WALKS", "0"))

_AUDIENCE_SUITE = "Audience Qualification"
_EXIT_SUITE = "Exit Condition Logic"

# Always-present concern suites (every journey has an entry gate and an exit).
_DEFAULT_SUITES: list[dict[str, Any]] = [
    {
        "name": _AUDIENCE_SUITE,
        "description": "Who enters the journey — eligible qualify, ineligible are filtered, holdout members are held back.",
        "expectedOutcome": "Eligible enter; ineligible filtered at entry; holdout qualifies but is not messaged.",
        "testCases": [
            {"title": "Eligible profile enters", "description": "A qualifying profile passes the entry gate."},
            {"title": "Ineligible filtered at entry", "description": "A profile failing an entry rule is filtered."},
            {"title": "Holdout held back", "description": "A holdout member qualifies but is not messaged."},
            {"title": "Entry event triggers", "description": "The entry event fires the journey for the profile."},
        ],
    },
    {
        "name": _EXIT_SUITE,
        "description": "How profiles leave the journey — goal/exit conditions and TTL/timeout evaluation.",
        "expectedOutcome": "Profiles exit via the correct path (convert / TTL) at the right point.",
        "testCases": [
            {"title": "Goal-met exit", "description": "A converting profile exits via the goal condition."},
            {"title": "TTL / timeout exit", "description": "A non-converting profile exits on TTL/timeout."},
        ],
    },
]

# Guaranteed holdout cohort member — injected when the LLM omits one.
_HOLDOUT_PROFILE: dict[str, Any] = {
    "id": "p_holdout",
    "name": "Holdout Control",
    "archetype": "holdout",
    "scenario": "Holdout control — qualifies but held back",
    "region": "DE",
    "age": 34,
    "consent": True,
    "fcap": 0,
    "channelPreferences": {"email": True, "sms": True, "push": True, "call": True},
    "category": "eligible",
    "holdout": True,
    "violatedRules": [],
    "convertsAt": "",
    "attributes": {},
    "rationale": "Qualifies for the journey but assigned to holdout/control — must never be messaged.",
}


def _journey_nodes(journey: dict[str, Any]) -> list[dict[str, Any]]:
    """Pull the node list out of the journey dict (shape: journey['journey']['nodes'])."""
    return journey.get("journey", {}).get("nodes", []) or journey.get("nodes", [])


async def synthesize_plan(segment: dict[str, Any], journey: dict[str, Any], hint_count: int = 0) -> ProfileSynthResponse:
    """LLM synth — returns concern suites + the profile cohort."""
    prompt = PROFILE_SYNTH_PROMPT.format(
        segment_json=json.dumps(segment),
        nodes_json=json.dumps(_journey_nodes(journey)),
        touchpoints_json=json.dumps(journey.get("touchpoints", [])),
        entry_criteria_json=json.dumps(journey.get("entryCriteria", {})),
        hint_count=hint_count,
    )
    return await invoke_structured(get_chat_model("profile_synth"), prompt, ProfileSynthResponse)


# Back-compat alias (older imports / tests may call synthesize_suites).
synthesize_suites = synthesize_plan


async def extend_cohort(
    segment: dict[str, Any],
    journey: dict[str, Any],
    instruction: str,
    existing_profiles: list[dict[str, Any]],
    count: int = 0,
) -> ProfileSynthResponse:
    """Generate ADDITIONAL cohort profiles from a free-form user instruction."""
    prompt = PROFILE_SYNTH_EXTEND_PROMPT.format(
        segment_json=json.dumps(segment),
        touchpoints_json=json.dumps(journey.get("touchpoints", [])),
        entry_criteria_json=json.dumps(journey.get("entryCriteria", {})),
        existing_profiles_json=json.dumps(existing_profiles),
        instruction=instruction.replace('"', "'"),
        count=count,
    )
    return await invoke_structured(get_chat_model("profile_synth"), prompt, ProfileSynthResponse)


# Back-compat alias.
extend_suites = extend_cohort


async def simulate_profile(
    journey: dict[str, Any],
    segment: dict[str, Any],
    profile: dict[str, Any],
    suites: list[dict[str, Any]],
) -> SimulationResult:
    """Simulate ONE profile → a binary PASS/FAIL for every suite test case."""
    # Don't leak internal underscore fields to the model.
    clean = {k: v for k, v in profile.items() if not k.startswith("_")}
    # Pass each suite WITH its test cases so the model evaluates every case.
    suites_payload = [
        {
            "name": s.get("name", ""),
            "description": s.get("description", ""),
            "testCases": [
                {"title": c.get("title", ""), "description": c.get("description", "")}
                for c in (s.get("testCases") or [])
            ],
        }
        for s in suites
    ]
    prompt = SIMULATE_PROMPT.format(
        profile_json=json.dumps(clean),
        profile_id=str(profile.get("id", "")),
        nodes_json=json.dumps(_journey_nodes(journey)),
        touchpoints_json=json.dumps(journey.get("touchpoints", [])),
        entry_criteria_json=json.dumps(journey.get("entryCriteria", {})),
        suites_json=json.dumps(suites_payload),
    )
    result = await invoke_structured(get_chat_model("walk_profile"), prompt, SimulationResult)
    # Re-align the model's checks to the EXACT plan test cases so the suite
    # dropdowns and the results panel always show the same cases (1:1), even if
    # the model paraphrased a title or returned them in a different order.
    result = _align_checks_to_cases(result, suites)
    return result


import re as _re  # noqa: E402


def _norm(s: str) -> str:
    """Lowercase + strip all punctuation so 'Opt-out flag' == 'opt out flag'."""
    return _re.sub(r"[^a-z0-9]+", " ", str(s).lower()).strip()


def _align_checks_to_cases(result: SimulationResult, suites: list[dict[str, Any]]) -> SimulationResult:
    """Rebuild result.checks to mirror each suite's test cases exactly.

    Each (suite, testCase) yields ONE check with the test case's verbatim title.
    The PASS/FAIL is pulled from the best-matching model check, tried in order:
    exact-normalised title → containment (one title inside the other) → position.
    Defaults to "pass" if no model check can be matched.
    """
    from app.qa.schemas import SimulationCheck  # local import avoids cycle at top

    by_suite: dict[str, list[SimulationCheck]] = {}
    for c in result.checks:
        by_suite.setdefault(_norm(c.suite), []).append(c)

    aligned: list[SimulationCheck] = []
    any_case = False
    for s in suites:
        name = s.get("name", "")
        cases = s.get("testCases") or []
        if not cases:
            continue
        any_case = True
        pool = by_suite.get(_norm(name), [])
        norms = [_norm(c.title) for c in pool]
        used: set[int] = set()

        def take(idx: int) -> SimulationCheck:
            used.add(idx)
            return pool[idx]

        for i, tc in enumerate(cases):
            title = tc.get("title", "")
            nt = _norm(title)
            match: SimulationCheck | None = None
            # 1) exact normalised title
            for j in range(len(pool)):
                if j not in used and norms[j] == nt:
                    match = take(j); break
            # 2) containment either direction (handles suffixes like "(fcap)")
            if match is None:
                for j in range(len(pool)):
                    if j not in used and nt and norms[j] and (nt in norms[j] or norms[j] in nt):
                        match = take(j); break
            # 3) positional (only if that slot is still free)
            if match is None and i < len(pool) and i not in used:
                match = take(i)
            aligned.append(SimulationCheck(
                suite=name,
                title=title,
                description=(match.description if match else
                            "Did not execute — the journey stopped before this stage."),
                # A case with no model check did not run → DID NOT EXECUTE (skipped),
                # never a default pass.
                status=(match.status if match else "skipped"),
            ))

    if not any_case:
        return result
    verdict = "fail" if any(c.status == "fail" for c in aligned) else "pass"
    return result.model_copy(update={"checks": aligned, "verdict": verdict})


def normalise_suites(suites: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Strip any per-suite profiles (suites are concerns) and guarantee the
    always-present Audience Qualification + Exit Condition Logic suites exist."""
    concerns: list[dict[str, Any]] = []
    seen: set[str] = set()
    for s in suites:
        name = s.get("name", "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        cases = s.get("testCases") or []
        concerns.append({
            "name": name,
            "description": s.get("description", ""),
            "expectedOutcome": s.get("expectedOutcome", ""),
            "testCases": cases,
            "testCount": len(cases) or int(s.get("testCount", 0) or 0),
        })
    for default in _DEFAULT_SUITES:
        if default["name"].lower() not in seen:
            d = dict(default)
            d["testCount"] = len(d.get("testCases", []))
            concerns.append(d)
            seen.add(default["name"].lower())
    return concerns


def ensure_holdout_in_cohort(cohort: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Guarantee at least one holdout member in the cohort."""
    has_holdout = any(
        bool(p.get("holdout")) or str(p.get("archetype", "")).lower() == "holdout"
        for p in cohort
    )
    if has_holdout:
        return cohort
    logger.info("No holdout in cohort — injecting one.")
    return list(cohort) + [dict(_HOLDOUT_PROFILE)]


def build_walk_units(
    cohort: list[dict[str, Any]],
    suites: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Cross-product suites × profiles — one walk-unit per (suite, profile).

    Each unit carries the full profile plus the suite's name/description/expected
    so the walk can evaluate that profile through that suite's lens.
    """
    units: list[dict[str, Any]] = []
    for suite in suites:
        for p in cohort:
            unit = dict(p)
            unit["suiteName"] = suite["name"]
            unit["_suiteDescription"] = suite.get("description", "")
            unit["_suiteExpected"] = suite.get("expectedOutcome", "")
            units.append(unit)

    # Cap: sample the cohort down (never drop suites) so every suite still runs.
    if _MAX_WALKS > 0 and len(units) > _MAX_WALKS:
        per_suite = max(1, _MAX_WALKS // max(1, len(suites)))
        capped: list[dict[str, Any]] = []
        by_suite: dict[str, list[dict[str, Any]]] = {}
        for u in units:
            by_suite.setdefault(u["suiteName"], []).append(u)
        for bucket in by_suite.values():
            capped.extend(bucket[:per_suite])
        logger.warning(
            "Walk cap: %d/%d walks (QA_MAX_WALKS=%d) — %d profiles/suite. Set 0 to disable.",
            len(capped), len(units), _MAX_WALKS, per_suite,
        )
        units = capped
    return units


async def profile_synth(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    segment = state["segment"]
    journey = state["journey"]
    hint_count = int(state.get("profile_count", 0))

    await emit_step(run_id, node_id="profile_synth", label="Test plan",
                    msg="Building test plan…", progress=45, registry=reg)

    pre_suites = state.get("suites")
    base_cohort = state.get("base_profiles") or []
    logger.info("profile_synth started — run=%s pre_suites=%s cohort=%d",
                run_id, bool(pre_suites), len(base_cohort))

    # Resolve suites (concerns) and the cohort.
    if pre_suites and base_cohort:
        # Caller provided an explicit cohort (e.g. a selection-scoped QA run) —
        # run exactly those profiles. Do NOT inject a holdout here, or a run
        # scoped to one profile would silently grow to two.
        suites = [s if isinstance(s, dict) else s.model_dump() for s in pre_suites]
        cohort = [dict(p) for p in base_cohort]
        suites = normalise_suites(suites)
    else:
        logger.info("profile_synth calling LLM — run=%s", run_id)
        resp = await synthesize_plan(segment, journey, hint_count)
        suites = [s.model_dump() for s in resp.suites]
        cohort = [dict(p) for p in resp.profiles]
        logger.info("profile_synth LLM returned %d suites, %d cohort profiles — run=%s",
                    len(suites), len(cohort), run_id)
        # Holdout is guaranteed only for a freshly synthesized full cohort.
        suites = normalise_suites(suites)
        cohort = ensure_holdout_in_cohort(cohort)

    suite_summaries = [
        {
            "name": s["name"],
            "description": s.get("description", ""),
            "expectedOutcome": s.get("expectedOutcome", ""),
            "profileCount": len(cohort),  # every profile runs against this suite
        }
        for s in suites
    ]

    walk_units = build_walk_units(cohort, suites)

    eligible = sum(1 for p in cohort if p.get("category") != "ineligible")
    logger.info(
        "profile_synth ready — run=%s suites=%d cohort=%d walks=%d (%d eligible)",
        run_id, len(suites), len(cohort), len(walk_units), eligible,
    )
    await emit_step(
        run_id,
        node_id="profile_synth",
        label="Test plan ready",
        msg=f"{len(cohort)} profiles × {len(suites)} suites = {len(walk_units)} walks queued.",
        progress=55,
        registry=reg,
    )
    return {
        "profiles": walk_units,        # fan-out units (suite × profile)
        "cohort": cohort,              # the distinct profile cohort
        "suite_summaries": suite_summaries,
    }
