"""In-memory registry of QA runs.

Each run gets an asyncio.Queue that nodes publish SSE events into and
that the /runs/{id}/stream endpoint drains. Completed runs keep their
final report keyed by run_id for `/runs/{id}/report`.

This is a process-local store — fine for the single-uvicorn dev setup.
For horizontal scale, swap for Redis pub/sub behind the same interface.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator


@dataclass
class QARun:
    run_id: str
    journey_id: str
    segment_id: str
    profile_count: int
    created_at: float = field(default_factory=time.time)


class RunRegistry:
    def __init__(self) -> None:
        self._runs: dict[str, QARun] = {}
        self._queues: dict[str, asyncio.Queue[dict[str, Any]]] = {}
        self._reports: dict[str, dict[str, Any]] = {}

    def create(self, journey_id: str, segment_id: str, profile_count: int) -> QARun:
        run_id = uuid.uuid4().hex
        run = QARun(run_id=run_id, journey_id=journey_id, segment_id=segment_id, profile_count=profile_count)
        self._runs[run_id] = run
        self._queues[run_id] = asyncio.Queue()
        return run

    def get(self, run_id: str) -> QARun | None:
        return self._runs.get(run_id)

    def get_queue(self, run_id: str) -> asyncio.Queue[dict[str, Any]] | None:
        return self._queues.get(run_id)

    async def publish(self, run_id: str, event: dict[str, Any]) -> None:
        q = self._queues.get(run_id)
        if q is None:
            return
        await q.put(event)

    async def subscribe(self, run_id: str) -> AsyncIterator[dict[str, Any]]:
        q = self._queues.get(run_id)
        if q is None:
            return
        while True:
            ev = await q.get()
            yield ev
            if ev.get("event") == "done":
                # Drop the queue once consumed so we don't leak.
                self._queues.pop(run_id, None)
                return

    def save_report(self, run_id: str, report: dict[str, Any]) -> None:
        self._reports[run_id] = report

    def get_report(self, run_id: str) -> dict[str, Any] | None:
        return self._reports.get(run_id)


# Singleton used by routers + graph nodes.
registry = RunRegistry()
