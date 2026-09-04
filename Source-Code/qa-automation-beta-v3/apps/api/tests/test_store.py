from __future__ import annotations

import asyncio

import pytest

from app.qa.store import QARun, RunRegistry


def test_register_creates_run_and_queue():
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=3)
    assert run.run_id
    assert reg.get(run.run_id) is run
    assert reg.get_queue(run.run_id) is not None


async def test_publish_and_drain_queue():
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    await reg.publish(run.run_id, {"event": "step", "data": "hello"})
    await reg.publish(run.run_id, {"event": "done", "data": "bye"})

    drained: list[dict] = []
    async for ev in reg.subscribe(run.run_id):
        drained.append(ev)
        if ev["event"] == "done":
            break
    assert [e["event"] for e in drained] == ["step", "done"]


def test_save_and_get_report():
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    reg.save_report(run.run_id, {"verdict": "pass"})
    assert reg.get_report(run.run_id) == {"verdict": "pass"}


def test_get_unknown_run_returns_none():
    reg = RunRegistry()
    assert reg.get("nope") is None
    assert reg.get_report("nope") is None
