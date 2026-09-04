"""In-memory registry for async per-profile simulation jobs.

POST /simulate schedules a background task and stores the SimulationResult (or an
error) under a fresh sim_id; the frontend polls GET /simulate/{sim_id} until the
status flips from "running" to "done" or "failed".
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Literal

SimStatus = Literal["running", "done", "failed"]


@dataclass
class SimJob:
    sim_id: str
    profile_id: str
    status: SimStatus = "running"
    result: dict[str, Any] | None = None  # SimulationResult.model_dump() when done
    error: str | None = None


class SimRegistry:
    def __init__(self) -> None:
        self._jobs: dict[str, SimJob] = {}

    def create(self, *, profile_id: str) -> SimJob:
        sim_id = f"sim_{uuid.uuid4().hex[:12]}"
        job = SimJob(sim_id=sim_id, profile_id=profile_id)
        self._jobs[sim_id] = job
        return job

    def get(self, sim_id: str) -> SimJob | None:
        return self._jobs.get(sim_id)

    def set_result(self, sim_id: str, result: dict[str, Any]) -> None:
        job = self._jobs.get(sim_id)
        if job is None:
            return
        job.status = "done"
        job.result = result

    def set_error(self, sim_id: str, error: str) -> None:
        job = self._jobs.get(sim_id)
        if job is None:
            return
        job.status = "failed"
        job.error = error


registry = SimRegistry()
