"""Load journeys and segments from the `examples/` directory at startup.

The 18 real AJO-style journeys live in `examples/journey.json`; the 4 segment
definitions live as one JSON file each under `examples/segments/`. Both are
loaded once when this module is imported and exposed as immutable lists.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any


def _resolve_examples_dir() -> Path:
    """Locate the examples/ directory across deployment layouts.

    Tried in order:
      1. EXAMPLES_DIR env var (preferred for prod / Databricks Apps).
      2. Monorepo layout — <root>/apps/api/app/data/loaders.py with
         examples/ at the repo root.
      3. Flattened deploy bundle — app/data/loaders.py with examples/
         sitting alongside app/ (Databricks Apps default).
    """
    env = os.environ.get("EXAMPLES_DIR")
    if env:
        p = Path(env)
        if p.is_dir():
            return p

    here = Path(__file__).resolve()

    # Monorepo layout: parents[4] is the repo root.
    monorepo = here.parents[4] / "examples"
    if monorepo.is_dir():
        return monorepo

    # Flattened bundle: parents[2] is the bundle root (sibling of app/).
    flat = here.parents[2] / "examples"
    if flat.is_dir():
        return flat

    raise FileNotFoundError(
        "Could not locate examples/ directory. "
        "Set EXAMPLES_DIR env var to an absolute path."
    )


_EXAMPLES = _resolve_examples_dir()


def _is_runnable_journey(d: Any) -> bool:
    """A runnable journey has a useCaseId and a non-empty journey.nodes list.

    The examples/ dir also holds 'brief/template' files (categoryId + brief +
    journeyOverrides/nodeOverrides, no nodes) — those are NOT runnable and are
    skipped.
    """
    if not isinstance(d, dict) or not d.get("useCaseId"):
        return False
    journey = d.get("journey")
    nodes = journey.get("nodes") if isinstance(journey, dict) else None
    return bool(nodes)


@lru_cache(maxsize=1)
def load_journeys() -> list[dict[str, Any]]:
    """Load every runnable journey from individual files in examples/.

    Journeys are now one JSON file each (the legacy single journey.json is gone).
    Supports both layouts: a single journey object per file, or a legacy file
    containing a JSON array of journeys. Brief/template files are skipped.
    """
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    # examples/*.json — exclude the segments/ subdir (globbed separately).
    for path in sorted(_EXAMPLES.glob("*.json")):
        if path.name == "journey.json":
            continue  # legacy aggregate handled below if present
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        candidates = data if isinstance(data, list) else [data]
        for d in candidates:
            if _is_runnable_journey(d) and d["useCaseId"] not in seen:
                seen.add(d["useCaseId"])
                out.append(d)

    # Back-compat: if a legacy aggregate journey.json still exists, merge it in.
    legacy = _EXAMPLES / "journey.json"
    if legacy.is_file():
        with legacy.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        for d in (data if isinstance(data, list) else [data]):
            if _is_runnable_journey(d) and d["useCaseId"] not in seen:
                seen.add(d["useCaseId"])
                out.append(d)

    if not out:
        raise FileNotFoundError(
            f"No runnable journeys found in {_EXAMPLES}. "
            "Each journey file needs a useCaseId and journey.nodes."
        )
    out.sort(key=lambda j: j.get("name", j["useCaseId"]))
    return out


@lru_cache(maxsize=1)
def load_segments() -> list[dict[str, Any]]:
    seg_dir = _EXAMPLES / "segments"
    out: list[dict[str, Any]] = []
    for path in sorted(seg_dir.glob("*.json")):
        with path.open("r", encoding="utf-8") as fh:
            out.append(json.load(fh))
    return out


def get_journey_by_id(journey_id: str) -> dict[str, Any] | None:
    return next((j for j in load_journeys() if j.get("useCaseId") == journey_id), None)


def get_segment_by_id(segment_id: str) -> dict[str, Any] | None:
    return next((s for s in load_segments() if s.get("id") == segment_id), None)
