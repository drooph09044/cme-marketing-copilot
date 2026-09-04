"""In-memory registry for async profile-synth jobs.

POST /profiles/synth schedules a background task and stores the
ProfileSynthResponse (or an error) here under a fresh synth_id; the frontend
polls GET /profiles/synth/{synth_id} until status flips from "running" to
"done" or "failed".
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

SynthStatus = Literal["running", "done", "failed"]


@dataclass
class SynthJob:
    synth_id: str
    journey_id: str
    segment_id: str
    status: SynthStatus = "running"
    result: dict[str, Any] | None = None  # ProfileSynthResponse.model_dump() when done
    error: str | None = None


class SynthRegistry:
    def __init__(self) -> None:
        self._jobs: dict[str, SynthJob] = {}

    def create(self, *, journey_id: str, segment_id: str) -> SynthJob:
        synth_id = f"synth_{uuid.uuid4().hex[:12]}"
        job = SynthJob(synth_id=synth_id, journey_id=journey_id, segment_id=segment_id)
        self._jobs[synth_id] = job
        return job

    def get(self, synth_id: str) -> SynthJob | None:
        return self._jobs.get(synth_id)

    def set_result(self, synth_id: str, result: dict[str, Any]) -> None:
        job = self._jobs.get(synth_id)
        if job is None:
            return
        job.status = "done"
        job.result = result

    def set_error(self, synth_id: str, error: str) -> None:
        job = self._jobs.get(synth_id)
        if job is None:
            return
        job.status = "failed"
        job.error = error


registry = SynthRegistry()
