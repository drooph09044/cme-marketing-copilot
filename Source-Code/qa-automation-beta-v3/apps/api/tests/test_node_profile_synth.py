from __future__ import annotations

from app.qa.nodes.profile_synth import profile_synth
from app.qa.schemas import ProfileSynthResponse, TestSuite
from app.qa.store import RunRegistry

AUDIENCE = "Audience Qualification"
EXIT = "Exit Condition Logic"


async def test_profile_synth_builds_cohort_times_suites_walks(stub_model):
    """profile_synth returns walk-units = cohort × suites (re-walk per suite)."""
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=0)
    stub_model("profile_synth", ProfileSynthResponse(
        suites=[
            TestSuite(name="Audience Qualification", description="Who enters."),
            TestSuite(name="Channel Discovery", description="Delivery readiness."),
        ],
        profiles=[
            {"id": "p1", "name": "A", "archetype": "early_convert", "category": "eligible"},
            {"id": "p2", "name": "B", "archetype": "ineligible", "category": "ineligible"},
            {"id": "p3", "name": "H", "archetype": "holdout", "holdout": True, "category": "eligible"},
        ],
    ))
    state = {
        "run_id": run.run_id,
        "segment": {"id": "s1", "rules": [{"field": "Service Due", "value": "Yes", "joiner": ""}]},
        "journey": {"touchpoints": [], "entryCriteria": {}},
        "profile_count": 0,
    }
    out = await profile_synth(state, registry=reg)

    cohort = out["cohort"]
    suites = out["suite_summaries"]
    walks = out["profiles"]

    # Cohort has 3 profiles (holdout already present, not duplicated).
    assert len(cohort) == 3
    assert sum(1 for p in cohort if p.get("holdout")) == 1

    # Suites: the 2 from the LLM + auto-added Exit Condition Logic.
    names = {s["name"] for s in suites}
    assert {"Audience Qualification", "Channel Discovery", EXIT} <= names

    # Walk-units = cohort × suites (every profile runs against every suite).
    assert len(walks) == len(cohort) * len(suites)
    # Each walk carries the suite it is being evaluated under.
    assert all(w.get("suiteName") for w in walks)
    # Every suite is represented for every profile.
    from collections import Counter
    per_suite = Counter(w["suiteName"] for w in walks)
    assert set(per_suite) == names
    assert all(c == len(cohort) for c in per_suite.values())

    # Each suite summary reports the full cohort as its profileCount.
    assert all(s["profileCount"] == len(cohort) for s in suites)


async def test_profile_synth_injects_holdout_when_absent(stub_model):
    """When the cohort has no holdout member, one is injected."""
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=0)
    stub_model("profile_synth", ProfileSynthResponse(
        suites=[TestSuite(name="Audience Qualification", description="entry")],
        profiles=[{"id": "p1", "name": "A", "archetype": "early_convert", "category": "eligible"}],
    ))
    state = {
        "run_id": run.run_id,
        "segment": {"id": "s1", "rules": []},
        "journey": {"touchpoints": [], "entryCriteria": {}},
        "profile_count": 0,
    }
    out = await profile_synth(state, registry=reg)
    cohort = out["cohort"]
    # 1 original + 1 injected holdout.
    assert len(cohort) == 2
    holdout = [p for p in cohort if p.get("holdout")]
    assert len(holdout) == 1
    assert holdout[0]["archetype"] == "holdout"


async def test_profile_synth_does_not_duplicate_holdout(stub_model):
    """A cohort that already has a holdout member gets no extra one."""
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=0)
    stub_model("profile_synth", ProfileSynthResponse(
        suites=[TestSuite(name="Audience Qualification", description="entry")],
        profiles=[{"id": "p_ho", "name": "H", "archetype": "holdout", "holdout": True, "category": "eligible"}],
    ))
    state = {
        "run_id": run.run_id,
        "segment": {"id": "s1", "rules": []},
        "journey": {"touchpoints": [], "entryCriteria": {}},
        "profile_count": 0,
    }
    out = await profile_synth(state, registry=reg)
    holdout = [p for p in out["cohort"] if p.get("holdout")]
    assert len(holdout) == 1
    assert holdout[0]["id"] == "p_ho"


async def test_profile_synth_accepts_pregenerated_suites_and_cohort(stub_model):
    """When suites + base_profiles are provided, profile_synth skips the LLM."""
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=0)
    state = {
        "run_id": run.run_id,
        "segment": {"id": "s1", "rules": []},
        "journey": {"touchpoints": [], "entryCriteria": {}},
        "profile_count": 0,
        "suites": [{"name": "Audience Qualification", "description": "d", "expectedOutcome": "e"}],
        "base_profiles": [
            {"id": "p1", "name": "A", "archetype": "early_convert", "category": "eligible"},
            {"id": "p2", "name": "H", "archetype": "holdout", "holdout": True, "category": "eligible"},
        ],
    }
    out = await profile_synth(state, registry=reg)
    # 2 cohort × (Audience Qualification + auto Exit) = 4 walks.
    assert len(out["cohort"]) == 2
    assert len(out["profiles"]) == len(out["cohort"]) * len(out["suite_summaries"])


async def test_scoped_cohort_runs_exactly_selected_no_holdout_injection(stub_model):
    """A selection-scoped run (explicit cohort, no holdout) must NOT grow — the
    holdout guarantee applies only to a freshly synthesized full cohort."""
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=0)
    state = {
        "run_id": run.run_id,
        "segment": {"id": "s1", "rules": []},
        "journey": {"touchpoints": [], "entryCriteria": {}},
        "profile_count": 0,
        "suites": [{"name": "Audience Qualification", "description": "d", "expectedOutcome": "e"}],
        # User selected ONE non-holdout profile to run.
        "base_profiles": [
            {"id": "p1", "name": "Solo", "archetype": "early_convert", "category": "eligible"},
        ],
    }
    out = await profile_synth(state, registry=reg)
    # Exactly the one selected profile — no holdout injected.
    assert len(out["cohort"]) == 1
    assert out["cohort"][0]["id"] == "p1"
    assert not any(p.get("holdout") for p in out["cohort"])
    # 1 profile × (Audience Qualification + auto Exit) = 2 walks.
    assert len(out["profiles"]) == 2
