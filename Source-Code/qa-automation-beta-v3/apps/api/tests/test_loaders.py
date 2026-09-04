from __future__ import annotations

from app.data.loaders import load_journeys, load_segments


def test_load_journeys_returns_branching_set():
    journeys = load_journeys()
    # Journeys are loaded from individual files in examples/ (order-independent,
    # no specific id hard-coded — the example set changes over time).
    assert len(journeys) >= 6
    # Every loaded journey is runnable: has a useCaseId, an ENTRY node and ≥1 node.
    # (Not every journey messages — some are PROCESS/qualification flows.)
    for j in journeys:
        assert j.get("useCaseId"), "journey missing useCaseId"
        nodes = j.get("journey", {}).get("nodes")
        assert nodes, f"{j['useCaseId']} has no nodes"
        types = {n.get("type") for n in nodes}
        assert "ENTRY" in types, f"{j['useCaseId']} has no ENTRY node"
    # At least one journey uses CONDITION branching (proves branch support).
    assert any(
        any(n.get("type") == "CONDITION" for n in j["journey"]["nodes"])
        for j in journeys
    ), "expected at least one journey with CONDITION nodes"


def test_condition_journeys_produce_branch_edges():
    """CONDITION nodes (trueBranch/falseBranch) must yield real, labelled branch
    edges — not a flattened linear chain."""
    from app.routers.journey import _ajo_to_canvas

    journeys = load_journeys()
    cond = next(
        (j for j in journeys
         if any(n.get("type") == "CONDITION" for n in j["journey"]["nodes"])),
        None,
    )
    assert cond is not None
    canvas = _ajo_to_canvas(cond)
    edges = canvas["edges"]
    node_ids = {n["id"] for n in canvas["nodes"]}
    # No dangling endpoints.
    assert all(e[0] in node_ids and e[1] in node_ids for e in edges)
    # CONDITION nodes branch: at least one node has >1 outgoing edge, and some
    # edges are labelled (Yes/No).
    from collections import Counter
    out = Counter(e[0] for e in edges)
    assert any(c > 1 for c in out.values()), "no branching node found"
    assert any(len(e) > 2 for e in edges), "no labelled branch edges"


def test_load_segments_returns_all_entries():
    segments = load_segments()
    # Marketing-grade segment cohort; assert we load them all with the required shape.
    assert len(segments) >= 4
    ids = {s["id"] for s in segments}
    assert "seg_high_ltv_customers_who" in ids
    assert all("rules" in s and "id" in s and "name" in s for s in segments)


def test_get_journey_by_id_unknown_returns_none():
    from app.data.loaders import get_journey_by_id
    assert get_journey_by_id("nope") is None


def test_get_segment_by_id_unknown_returns_none():
    from app.data.loaders import get_segment_by_id
    assert get_segment_by_id("nope") is None
