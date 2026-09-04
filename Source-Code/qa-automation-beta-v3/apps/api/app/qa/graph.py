"""Assemble the QA LangGraph DAG.

Topology:
    load_inputs → fit_check → structure_check → profile_synth →
        walk_fanout (Send → walk_profile × N) → aggregate_walks → verdict_summary → END

Each LLM node is registered with its own name; the router uses that name
to pick a model and provider.

Note: Send is imported from langgraph.types (preferred in langgraph >= 1.0).
langgraph.constants.Send still works but is deprecated.
"""

from __future__ import annotations

from typing import Any

from langgraph.types import Send
from langgraph.graph import END, START, StateGraph

from app.qa.nodes.fit_check import fit_check as _fit_check
from app.qa.nodes.load_inputs import load_inputs as _load_inputs
from app.qa.nodes.profile_synth import profile_synth as _profile_synth
from app.qa.nodes.structure_check import structure_check as _structure_check
from app.qa.nodes.verdict_summary import verdict_summary as _verdict_summary
from app.qa.nodes.walk_profile import walk_profile as _walk_profile
from app.qa.state import QAState
from app.qa.store import RunRegistry, registry as default_registry


def build_qa_graph(*, registry: RunRegistry | None = None) -> Any:
    reg = registry or default_registry

    async def load_inputs(state: QAState) -> dict[str, Any]:
        return await _load_inputs(dict(state), registry=reg)

    async def fit_check(state: QAState) -> dict[str, Any]:
        return await _fit_check(dict(state), registry=reg)

    async def structure_check(state: QAState) -> dict[str, Any]:
        return await _structure_check(dict(state), registry=reg)

    async def profile_synth(state: QAState) -> dict[str, Any]:
        return await _profile_synth(dict(state), registry=reg)

    async def walk_profile_node(state: dict[str, Any]) -> dict[str, Any]:
        return await _walk_profile(state, registry=reg)

    async def aggregate_walks(state: QAState) -> dict[str, Any]:
        return {}  # The list-append reducer on `walks` already merged everything.

    async def verdict_summary(state: QAState) -> dict[str, Any]:
        return await _verdict_summary(dict(state), registry=reg)

    def walk_fanout(state: QAState) -> list[Send]:
        profiles = state.get("profiles", [])
        total = len(profiles)
        return [
            Send("walk_profile", {
                "run_id": state["run_id"],
                "journey": state["journey"],
                "profile": p,
                "profile_index": i,
                "profile_total": total,
            })
            for i, p in enumerate(profiles)
        ]

    g = StateGraph(QAState)
    g.add_node("load_inputs", load_inputs)
    g.add_node("fit_check", fit_check)
    g.add_node("structure_check", structure_check)
    g.add_node("profile_synth", profile_synth)
    g.add_node("walk_profile", walk_profile_node)
    g.add_node("aggregate_walks", aggregate_walks)
    g.add_node("verdict_summary", verdict_summary)

    g.add_edge(START, "load_inputs")
    g.add_edge("load_inputs", "fit_check")
    g.add_edge("fit_check", "structure_check")
    g.add_edge("structure_check", "profile_synth")
    g.add_conditional_edges("profile_synth", walk_fanout, ["walk_profile"])
    g.add_edge("walk_profile", "aggregate_walks")
    g.add_edge("aggregate_walks", "verdict_summary")
    g.add_edge("verdict_summary", END)

    return g.compile()
