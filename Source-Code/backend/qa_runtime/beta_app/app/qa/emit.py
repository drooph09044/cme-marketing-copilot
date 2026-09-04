"""Helper for emitting SSE step events from any QA node."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Literal

from app.qa.store import RunRegistry, registry as default_registry

StepLevel = Literal["info", "warn", "err"]


async def emit_step(
    run_id: str,
    node_id: str,
    label: str,
    msg: str,
    progress: int,
    *,
    level: StepLevel = "info",
    node_instance: str | None = None,
    registry: RunRegistry | None = None,
) -> None:
    reg = registry or default_registry
    payload = {
        "ts": datetime.now().strftime("%H:%M:%S"),
        "level": level,
        "node": node_instance or node_id,
        "nodeId": node_id,
        "label": label,
        "msg": msg,
        "progress": progress,
    }
    await reg.publish(run_id, {"event": "step", "data": json.dumps(payload)})


async def emit_done(
    run_id: str,
    status: Literal["passed", "failed"],
    duration_ms: int,
    *,
    report_url: str,
    registry: RunRegistry | None = None,
) -> None:
    reg = registry or default_registry
    payload = {"status": status, "duration": duration_ms, "reportUrl": report_url}
    await reg.publish(run_id, {"event": "done", "data": json.dumps(payload)})
