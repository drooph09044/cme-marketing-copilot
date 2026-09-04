# QA Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a LangGraph-driven QA pipeline to the existing Journey Test Console that, given a `(journey, segment)` pair, performs fit + structural + simulated-walk QA via LLMs routed through a provider-agnostic layer (Anthropic ↔ Databricks).

**Architecture:** FastAPI hosts a LangGraph DAG (`load_inputs → fit_check → structure_check → profile_synth → walk_fanout → [walk_profile × N] → aggregate_walks → verdict_summary`). All LLM calls go through `app.llm.router.get_chat_model(node)`, which returns a LangChain `BaseChatModel` selected by the `MODEL_PROVIDER` env var. Each node emits SSE step events into an `asyncio.Queue` consumed by the existing `/runs/{id}/stream` endpoint. Final reports are stored in-memory and served via `/runs/{id}/report`.

**Tech Stack:** Python 3.11+, FastAPI ≥ 0.115, LangGraph ≥ 0.2, langchain-anthropic, langchain-databricks, Pydantic v2, sse-starlette, pytest + httpx.AsyncClient. Next.js 14 + TypeScript 5.5 (frontend, minor changes only).

**Spec:** `docs/superpowers/specs/2026-05-18-qa-automation-design.md`

---

## Conventions used throughout this plan

- All Python paths are relative to repo root. The `apps/api` directory is the Python working dir for `pytest`, `uvicorn`, etc. Run commands from `apps/api` unless otherwise noted.
- Every Python module begins with `from __future__ import annotations` (per CLAUDE.md).
- TDD: each task writes the test first, watches it fail, writes the implementation, watches it pass, then commits.
- Commits use Conventional Commits (`feat:`, `test:`, `chore:`, `refactor:`). Sign-off line per the project's commit convention is left to the executing agent's defaults.
- The repo is **not** currently a git repo — Task 0 initializes it.

---

## Task 0: Initialize git + baseline commit

**Files:**
- Modify: `.gitignore` (already exists)

- [ ] **Step 1: Check git state**

Run: `git -C /Volumes/Ohveda/EXL/qa-automation-beta status`
Expected: `fatal: not a git repository`. If it IS a repo, skip Task 0.

- [ ] **Step 2: Initialize git**

```bash
cd /Volumes/Ohveda/EXL/qa-automation-beta
git init -b main
```

Expected: `Initialized empty Git repository`.

- [ ] **Step 3: Verify `.gitignore` excludes the right things**

Read `.gitignore`. Ensure it includes (append if missing):

```
# Python
__pycache__/
*.py[cod]
.venv/
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Env
.env
.env.local
*.env

# Node
node_modules/
.next/
dist/
.turbo/
```

- [ ] **Step 4: Initial commit**

```bash
git add -A
git commit -m "chore: import existing Journey Test Console scaffold"
```

Expected: a single root commit. Verify with `git log --oneline`.

---

## Task 1: Add Python dependencies

**Files:**
- Modify: `apps/api/requirements.txt`
- Create: `apps/api/.env.example`

- [ ] **Step 1: Add LangGraph + LangChain deps**

Replace the contents of `apps/api/requirements.txt` with:

```
fastapi>=0.115
uvicorn[standard]>=0.30
pydantic>=2.7
sse-starlette>=2.1
langgraph>=0.2
langchain-core>=0.3
langchain-anthropic>=0.2
langchain-databricks>=0.1
python-dotenv>=1.0
httpx>=0.27
pytest>=8.0
pytest-asyncio>=0.23
```

- [ ] **Step 2: Create `.env.example`**

```bash
# QA Automation environment template
# Copy to `.env` (gitignored) and fill in values.

# Provider selector: anthropic (default) | databricks
MODEL_PROVIDER=anthropic

# Anthropic (used when MODEL_PROVIDER=anthropic)
ANTHROPIC_API_KEY=

# Databricks Model Serving (used when MODEL_PROVIDER=databricks)
DATABRICKS_HOST=
DATABRICKS_TOKEN=
```

- [ ] **Step 3: Install deps into the existing venv**

```bash
cd apps/api
source .venv/bin/activate 2>/dev/null || python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Expected: no errors. `pip show langgraph langchain-anthropic langchain-databricks` should each succeed.

- [ ] **Step 4: Configure pytest**

Create `apps/api/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
pythonpath = .
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Ohveda/EXL/qa-automation-beta
git add apps/api/requirements.txt apps/api/.env.example apps/api/pytest.ini
git commit -m "chore(api): add langgraph + langchain deps and env template"
```

---

## Task 2: Data loaders for `examples/` files

**Files:**
- Create: `apps/api/app/data/loaders.py`
- Create: `apps/api/tests/__init__.py` (empty)
- Create: `apps/api/tests/test_loaders.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_loaders.py`:

```python
from __future__ import annotations

from app.data.loaders import load_journeys, load_segments


def test_load_journeys_returns_18_entries():
    journeys = load_journeys()
    assert len(journeys) == 18
    first = journeys[0]
    assert first["useCaseId"] == "season-ticket-renewal-journey"
    assert "entryCriteria" in first
    assert "touchpoints" in first
    assert "journey" in first
    assert "nodes" in first["journey"]


def test_load_segments_returns_4_entries():
    segments = load_segments()
    assert len(segments) == 4
    ids = {s["id"] for s in segments}
    assert "seg_high_ltv_customers_who" in ids
    assert all("rules" in s for s in segments)


def test_get_journey_by_id_unknown_returns_none():
    from app.data.loaders import get_journey_by_id
    assert get_journey_by_id("nope") is None


def test_get_segment_by_id_unknown_returns_none():
    from app.data.loaders import get_segment_by_id
    assert get_segment_by_id("nope") is None
```

Also create `apps/api/tests/__init__.py` as an empty file.

- [ ] **Step 2: Run the test, watch it fail**

```bash
cd apps/api
pytest tests/test_loaders.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.data.loaders'`.

- [ ] **Step 3: Implement `loaders.py`**

Create `apps/api/app/data/loaders.py`:

```python
"""Load journeys and segments from the `examples/` directory at startup.

The 18 real AJO-style journeys live in `examples/journey.json`; the 4 segment
definitions live as one JSON file each under `examples/segments/`. Both are
loaded once when this module is imported and exposed as immutable lists.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

# repo_root/apps/api/app/data/loaders.py  ->  repo_root/examples
_EXAMPLES = Path(__file__).resolve().parents[3] / "examples"


@lru_cache(maxsize=1)
def load_journeys() -> list[dict[str, Any]]:
    path = _EXAMPLES / "journey.json"
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON array in {path}, got {type(data).__name__}")
    return data


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
```

- [ ] **Step 4: Run tests, watch them pass**

```bash
pytest tests/test_loaders.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/data/loaders.py apps/api/tests/__init__.py apps/api/tests/test_loaders.py
git commit -m "feat(api): add loaders for examples/journey.json and examples/segments/*.json"
```

---

## Task 3: QA Pydantic schemas

**Files:**
- Create: `apps/api/app/qa/__init__.py` (empty)
- Create: `apps/api/app/qa/schemas.py`
- Create: `apps/api/tests/test_schemas.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_schemas.py`:

```python
from __future__ import annotations

import pytest

from app.qa.schemas import (
    FitFinding,
    Finding,
    Severity,
    Verdict,
    WalkStep,
    WalkTrace,
    QAReport,
    SegmentModel,
    QARunRequest,
)


def test_fit_finding_score_is_bounded():
    ok = FitFinding(verdict="pass", score=0.9, reasons=["matches"])
    assert ok.score == 0.9
    with pytest.raises(ValueError):
        FitFinding(verdict="pass", score=1.5, reasons=["x"])


def test_finding_requires_severity():
    f = Finding(nodeId="TP3", severity="warn", message="no fcap")
    assert f.severity == "warn"


def test_walk_trace_collects_steps():
    trace = WalkTrace(
        profile={"id": "p1", "name": "A"},
        steps=[WalkStep(nodeId="n1", verdict="pass", reason="entered")],
        endedAt="n1",
        verdict="pass",
    )
    assert trace.steps[0].verdict == "pass"


def test_qa_report_roundtrips():
    r = QAReport(
        runId="r1",
        journeyId="j1",
        segmentId="s1",
        modelProvider="anthropic",
        verdict="warn",
        summary="ok",
        fit=FitFinding(verdict="pass", score=0.8, reasons=[]),
        structure=[],
        walks=[],
        createdAt="2026-05-18T00:00:00Z",
        durationMs=10,
    )
    assert QAReport.model_validate(r.model_dump()).runId == "r1"


def test_qa_run_request_default_profile_count():
    req = QARunRequest(journeyId="j1", segmentId="s1")
    assert req.profileCount == 5


def test_segment_model_parses_example_shape():
    seg = SegmentModel(
        id="seg_x",
        name="X",
        purpose="custom",
        size="1K",
        refresh="Daily",
        exclusions="None",
        status="Draft",
        rules=[{"id": "r1", "field": "LTV Tier", "value": "High", "joiner": ""}],
        isPreset=False,
    )
    assert seg.rules[0].field == "LTV Tier"
```

- [ ] **Step 2: Run test, watch fail**

```bash
pytest tests/test_schemas.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.qa'`.

- [ ] **Step 3: Implement schemas**

Create `apps/api/app/qa/__init__.py` (empty file).

Create `apps/api/app/qa/schemas.py`:

```python
"""Pydantic schemas for the QA pipeline — wire format with the frontend."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Verdict = Literal["pass", "warn", "fail"]
Severity = Literal["info", "warn", "err"]
StepLevel = Literal["info", "warn", "err"]


class FitFinding(BaseModel):
    verdict: Verdict
    score: float = Field(ge=0.0, le=1.0)
    reasons: list[str]
    summary: str = ""


class Finding(BaseModel):
    nodeId: str
    severity: Severity
    message: str


class WalkStep(BaseModel):
    nodeId: str
    verdict: Verdict
    reason: str


class WalkTrace(BaseModel):
    profile: dict[str, Any]
    steps: list[WalkStep]
    endedAt: str
    verdict: Verdict


class QAReport(BaseModel):
    runId: str
    journeyId: str
    segmentId: str
    modelProvider: str
    verdict: Verdict
    summary: str
    fit: FitFinding
    structure: list[Finding]
    walks: list[WalkTrace]
    createdAt: str
    durationMs: int


class QARunRequest(BaseModel):
    journeyId: str
    segmentId: str
    profileCount: int = Field(default=5, ge=1, le=20)


class QARunResponse(BaseModel):
    runId: str
    status: Literal["queued"]


class SegmentRule(BaseModel):
    id: str
    field: str
    value: str
    joiner: str = ""


class SegmentModel(BaseModel):
    id: str
    name: str
    purpose: str
    size: str
    refresh: str
    exclusions: str
    status: str
    rules: list[SegmentRule]
    isPreset: bool = False


class StepEventPayload(BaseModel):
    ts: str
    level: StepLevel
    node: str
    nodeId: str
    label: str
    msg: str
    progress: int


class DoneEventPayload(BaseModel):
    status: Literal["passed", "failed"]
    duration: int
    reportUrl: str
```

- [ ] **Step 4: Run tests, watch pass**

```bash
pytest tests/test_schemas.py -v
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/qa/__init__.py apps/api/app/qa/schemas.py apps/api/tests/test_schemas.py
git commit -m "feat(qa): add pydantic schemas for QA pipeline"
```

---

## Task 4: LLM model router

**Files:**
- Create: `apps/api/app/llm/__init__.py` (empty)
- Create: `apps/api/app/llm/config.py`
- Create: `apps/api/app/llm/providers.py`
- Create: `apps/api/app/llm/router.py`
- Create: `apps/api/tests/test_llm_router.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_llm_router.py`:

```python
from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from app.llm import router as router_mod
from app.llm.config import NODE_MODEL_CONFIG


def test_node_model_config_covers_all_nodes():
    expected = {"fit_check", "structure_check", "profile_synth", "walk_profile", "verdict_summary"}
    assert expected.issubset(NODE_MODEL_CONFIG.keys())
    for cfg in NODE_MODEL_CONFIG.values():
        assert "anthropic" in cfg and "databricks" in cfg
        assert "temperature" in cfg and "max_tokens" in cfg


def test_router_selects_anthropic_by_default(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    with patch("app.llm.providers.ChatAnthropic") as mock_anthropic:
        router_mod.get_chat_model("fit_check")
        mock_anthropic.assert_called_once()
        kwargs = mock_anthropic.call_args.kwargs
        assert kwargs["model"] == NODE_MODEL_CONFIG["fit_check"]["anthropic"]
        assert kwargs["temperature"] == NODE_MODEL_CONFIG["fit_check"]["temperature"]


def test_router_switches_to_databricks(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "databricks")
    monkeypatch.setenv("DATABRICKS_HOST", "https://x.databricks.com")
    monkeypatch.setenv("DATABRICKS_TOKEN", "dapi-test")
    with patch("app.llm.providers.ChatDatabricks") as mock_db:
        router_mod.get_chat_model("walk_profile")
        mock_db.assert_called_once()
        kwargs = mock_db.call_args.kwargs
        assert kwargs["endpoint"] == NODE_MODEL_CONFIG["walk_profile"]["databricks"]


def test_router_raises_for_unknown_node(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    with pytest.raises(KeyError):
        router_mod.get_chat_model("nonexistent_node")


def test_router_raises_for_unknown_provider(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    with pytest.raises(ValueError, match="Unsupported MODEL_PROVIDER"):
        router_mod.get_chat_model("fit_check")


def test_override_for_tests(monkeypatch):
    router_mod._reset_cache_for_tests()

    class Sentinel:
        pass

    s = Sentinel()
    router_mod.set_override("fit_check", s)
    try:
        assert router_mod.get_chat_model("fit_check") is s
    finally:
        router_mod.clear_overrides()
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_llm_router.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement config**

Create `apps/api/app/llm/__init__.py` (empty file).

Create `apps/api/app/llm/config.py`:

```python
"""Per-node model preferences for the LLM router.

Each key is a LangGraph node name. Each value provides a model identifier
per provider plus shared sampling params. Add a node here BEFORE calling
`get_chat_model(node)` from a new node.
"""

from __future__ import annotations

from typing import TypedDict


class NodeModelConfig(TypedDict):
    anthropic: str
    databricks: str
    temperature: float
    max_tokens: int


NODE_MODEL_CONFIG: dict[str, NodeModelConfig] = {
    "fit_check": {
        "anthropic": "claude-opus-4-7",
        "databricks": "databricks-dbrx-instruct",
        "temperature": 0.2,
        "max_tokens": 1500,
    },
    "structure_check": {
        "anthropic": "claude-sonnet-4-6",
        "databricks": "databricks-meta-llama-3-1-70b-instruct",
        "temperature": 0.1,
        "max_tokens": 1200,
    },
    "profile_synth": {
        "anthropic": "claude-sonnet-4-6",
        "databricks": "databricks-meta-llama-3-1-70b-instruct",
        "temperature": 0.7,
        "max_tokens": 2000,
    },
    "walk_profile": {
        "anthropic": "claude-haiku-4-5-20251001",
        "databricks": "databricks-meta-llama-3-1-8b-instruct",
        "temperature": 0.1,
        "max_tokens": 800,
    },
    "verdict_summary": {
        "anthropic": "claude-opus-4-7",
        "databricks": "databricks-dbrx-instruct",
        "temperature": 0.3,
        "max_tokens": 2000,
    },
}
```

- [ ] **Step 4: Implement providers**

Create `apps/api/app/llm/providers.py`:

```python
"""Concrete provider factories. Imported lazily by `router.py`."""

from __future__ import annotations

import os

from langchain_anthropic import ChatAnthropic
from langchain_databricks import ChatDatabricks
from langchain_core.language_models.chat_models import BaseChatModel

from app.llm.config import NodeModelConfig


def build_anthropic(cfg: NodeModelConfig) -> BaseChatModel:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    return ChatAnthropic(
        model=cfg["anthropic"],
        temperature=cfg["temperature"],
        max_tokens=cfg["max_tokens"],
        api_key=api_key,
    )


def build_databricks(cfg: NodeModelConfig) -> BaseChatModel:
    host = os.environ.get("DATABRICKS_HOST")
    token = os.environ.get("DATABRICKS_TOKEN")
    if not host or not token:
        raise RuntimeError("DATABRICKS_HOST and DATABRICKS_TOKEN must be set")
    # ChatDatabricks reads DATABRICKS_HOST + DATABRICKS_TOKEN from env;
    # we pass endpoint (the served model name) and sampling params here.
    return ChatDatabricks(
        endpoint=cfg["databricks"],
        temperature=cfg["temperature"],
        max_tokens=cfg["max_tokens"],
    )
```

- [ ] **Step 5: Implement router**

Create `apps/api/app/llm/router.py`:

```python
"""Provider-agnostic chat-model factory.

Public API:
    get_chat_model(node) -> BaseChatModel
    set_override(node, model)     # for tests
    clear_overrides()              # for tests
"""

from __future__ import annotations

import os
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel

from app.llm.config import NODE_MODEL_CONFIG

_overrides: dict[str, Any] = {}


def _reset_cache_for_tests() -> None:
    _overrides.clear()


def set_override(node: str, model: Any) -> None:
    """Install a test double for a given node. Cleared by clear_overrides()."""
    _overrides[node] = model


def clear_overrides() -> None:
    _overrides.clear()


def current_provider() -> str:
    return os.environ.get("MODEL_PROVIDER", "anthropic").lower()


def get_chat_model(node: str) -> BaseChatModel:
    if node in _overrides:
        return _overrides[node]

    if node not in NODE_MODEL_CONFIG:
        raise KeyError(f"No model config registered for node {node!r}")

    cfg = NODE_MODEL_CONFIG[node]
    provider = current_provider()

    # Lazy import keeps providers unloaded until needed.
    from app.llm import providers

    if provider == "anthropic":
        return providers.build_anthropic(cfg)
    if provider == "databricks":
        return providers.build_databricks(cfg)
    raise ValueError(f"Unsupported MODEL_PROVIDER={provider!r} (expected 'anthropic' or 'databricks')")
```

- [ ] **Step 6: Run, watch pass**

```bash
pytest tests/test_llm_router.py -v
```

Expected: all 6 PASS. If `ChatDatabricks` import fails, verify `langchain-databricks` installed correctly.

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/llm/ apps/api/tests/test_llm_router.py
git commit -m "feat(llm): add provider-agnostic chat-model router (anthropic + databricks)"
```

---

## Task 5: SSE run store (in-memory queue)

**Files:**
- Create: `apps/api/app/qa/store.py`
- Create: `apps/api/tests/test_store.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_store.py`:

```python
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
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_store.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement store**

Create `apps/api/app/qa/store.py`:

```python
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
```

- [ ] **Step 4: Run, watch pass**

```bash
pytest tests/test_store.py -v
```

Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/qa/store.py apps/api/tests/test_store.py
git commit -m "feat(qa): add in-memory run registry with per-run SSE queue"
```

---

## Task 6: Static structural checks (pure-Python, no LLM)

**Files:**
- Create: `apps/api/app/qa/static_checks.py`
- Create: `apps/api/tests/test_static_checks.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_static_checks.py`:

```python
from __future__ import annotations

from app.qa.schemas import Finding
from app.qa.static_checks import run_static_checks


def _journey(nodes):
    return {"useCaseId": "test", "journey": {"nodes": nodes}, "touchpoints": []}


def test_passes_on_minimal_valid_journey():
    j = _journey([
        {"id": "n1", "type": "ENTRY"},
        {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
        {"id": "n3", "type": "EXIT"},
    ])
    findings = run_static_checks(j)
    assert all(isinstance(f, Finding) for f in findings)
    # Minimal valid journey should produce no `err` findings.
    assert not any(f.severity == "err" for f in findings)


def test_flags_missing_exit():
    j = _journey([
        {"id": "n1", "type": "ENTRY"},
        {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
    ])
    findings = run_static_checks(j)
    assert any(f.severity == "err" and "EXIT" in f.message for f in findings)


def test_flags_missing_entry():
    j = _journey([
        {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
        {"id": "n3", "type": "EXIT"},
    ])
    findings = run_static_checks(j)
    assert any(f.severity == "err" and "ENTRY" in f.message for f in findings)


def test_flags_message_without_tpid():
    j = _journey([
        {"id": "n1", "type": "ENTRY"},
        {"id": "n2", "type": "MESSAGE"},  # missing tpId
        {"id": "n3", "type": "EXIT"},
    ])
    findings = run_static_checks(j)
    assert any(f.severity == "warn" and "tpId" in f.message for f in findings)


def test_flags_duplicate_node_ids():
    j = _journey([
        {"id": "n1", "type": "ENTRY"},
        {"id": "n1", "type": "MESSAGE", "tpId": "TP1"},
        {"id": "n3", "type": "EXIT"},
    ])
    findings = run_static_checks(j)
    assert any(f.severity == "err" and "duplicate" in f.message.lower() for f in findings)


def test_flags_touchpoint_referenced_but_not_defined():
    j = {
        "useCaseId": "test",
        "journey": {"nodes": [
            {"id": "n1", "type": "ENTRY"},
            {"id": "n2", "type": "MESSAGE", "tpId": "TP_MISSING"},
            {"id": "n3", "type": "EXIT"},
        ]},
        "touchpoints": [{"tpId": "TP1"}],
    }
    findings = run_static_checks(j)
    assert any("TP_MISSING" in f.message for f in findings)
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_static_checks.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement static checks**

Create `apps/api/app/qa/static_checks.py`:

```python
"""Pure-Python structural rules over a raw journey dict.

Each function returns a list of `Finding`s. The LLM in `structure_check` can
later add human-readable colour to these, but failures are determined here.
"""

from __future__ import annotations

from typing import Any

from app.qa.schemas import Finding


def _nodes(journey: dict[str, Any]) -> list[dict[str, Any]]:
    return list(journey.get("journey", {}).get("nodes", []))


def _check_entry(journey: dict[str, Any]) -> list[Finding]:
    nodes = _nodes(journey)
    if not any(n.get("type") == "ENTRY" for n in nodes):
        return [Finding(nodeId="-", severity="err", message="Journey has no ENTRY node.")]
    return []


def _check_exit(journey: dict[str, Any]) -> list[Finding]:
    nodes = _nodes(journey)
    if not any(n.get("type") == "EXIT" for n in nodes):
        return [Finding(nodeId="-", severity="err", message="Journey has no EXIT node.")]
    return []


def _check_duplicate_ids(journey: dict[str, Any]) -> list[Finding]:
    seen: set[str] = set()
    dups: set[str] = set()
    for n in _nodes(journey):
        nid = n.get("id", "")
        if nid in seen:
            dups.add(nid)
        seen.add(nid)
    return [Finding(nodeId=d, severity="err", message=f"Duplicate node id detected: {d}") for d in sorted(dups)]


def _check_message_tpid(journey: dict[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    for n in _nodes(journey):
        if n.get("type") == "MESSAGE" and not n.get("tpId"):
            findings.append(Finding(nodeId=n.get("id", "-"), severity="warn", message="MESSAGE node has no tpId reference."))
    return findings


def _check_touchpoint_resolution(journey: dict[str, Any]) -> list[Finding]:
    defined = {tp.get("tpId") for tp in journey.get("touchpoints", []) if tp.get("tpId")}
    findings: list[Finding] = []
    for n in _nodes(journey):
        tpid = n.get("tpId")
        if tpid and tpid not in defined:
            findings.append(Finding(nodeId=n.get("id", "-"), severity="warn", message=f"Touchpoint {tpid} referenced but not defined."))
    return findings


_CHECKS = [
    _check_entry,
    _check_exit,
    _check_duplicate_ids,
    _check_message_tpid,
    _check_touchpoint_resolution,
]


def run_static_checks(journey: dict[str, Any]) -> list[Finding]:
    out: list[Finding] = []
    for fn in _CHECKS:
        out.extend(fn(journey))
    return out
```

- [ ] **Step 4: Run, watch pass**

```bash
pytest tests/test_static_checks.py -v
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/qa/static_checks.py apps/api/tests/test_static_checks.py
git commit -m "feat(qa): add structural static checks for journey graphs"
```

---

## Task 7: QA state schema + prompts

**Files:**
- Create: `apps/api/app/qa/state.py`
- Create: `apps/api/app/qa/prompts.py`

- [ ] **Step 1: Create state schema**

Create `apps/api/app/qa/state.py`:

```python
"""LangGraph state shared across QA nodes.

Reducers are not needed — each node returns a partial dict that LangGraph
merges into the state, except `walks` which uses a list-append reducer so
parallel fan-out walks accumulate cleanly.
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

from app.qa.schemas import Finding, FitFinding, WalkTrace


class QAState(TypedDict, total=False):
    run_id: str
    journey_id: str
    segment_id: str
    journey: dict[str, Any]
    segment: dict[str, Any]
    profile_count: int
    fit: FitFinding
    structure: list[Finding]
    profiles: list[dict[str, Any]]
    # Per-walk fields populated by the Send fan-out (only present inside walk_profile invocations):
    profile: dict[str, Any]
    profile_index: int
    profile_total: int
    walks: Annotated[list[WalkTrace], operator.add]
    verdict: str
    summary: str
```

- [ ] **Step 2: Create prompts**

Create `apps/api/app/qa/prompts.py`:

```python
"""Prompt templates per LLM node. One constant per node.

Keep prompts terse and structured — every model the router targets must
follow them. Always demand JSON when downstream parses structured output.
"""

from __future__ import annotations

FIT_PROMPT = """You are a marketing-automation QA reviewer.

Given:
- SEGMENT: {segment_json}
- JOURNEY: name={journey_name}, goal={journey_goal}, entry_criteria={entry_criteria_json}, touchpoint_count={tp_count}

Decide whether this SEGMENT is a sensible audience for this JOURNEY.

Return a JSON object that matches this schema:
  verdict: "pass" | "warn" | "fail"
  score: float in [0,1]
  reasons: list of short strings (max 5)
  summary: one-sentence rationale

Be specific. Cite which segment rule conflicts with which entry criterion, if any.
"""

STRUCTURE_EXPLAIN_PROMPT = """You are a marketing-automation QA reviewer.

A static analyzer produced these findings for a journey graph:
{findings_json}

Journey context: name={journey_name}, touchpoint_count={tp_count}.

Rewrite each finding with a one-sentence explanation that a marketer would
understand. Keep `nodeId` and `severity` exactly as given. Return a JSON
array of objects with keys: nodeId, severity, message.
"""

PROFILE_SYNTH_PROMPT = """Generate {n} synthetic customer profiles for QA testing.

The segment definition is:
{segment_json}

Constraints:
- {n_base} profiles must clearly satisfy every rule (joiner-aware).
- {n_edge} profiles are adversarial edge cases: one with consent=false, one
  near the rule boundary (e.g. just-below a tier), one with high frequency-cap
  usage (fcap=3).

Each profile must be a JSON object with keys:
  id (string, "p1".."p{n}"), name, region (DE|FR|NL|ES|IT|US|UK),
  age (int 18-80), consent (bool), fcap (int 0-3), lastSend (string like "12d"),
  ltvTier ("Low"|"Medium"|"High"), engagementTier ("Low"|"Medium"|"High"),
  recency ("Low"|"Medium"|"High"), contentAffinity ("Low"|"Medium"|"High").

Return a JSON array of length {n}.
"""

WALK_PROMPT = """You are simulating one profile walking through a journey.

PROFILE: {profile_json}
JOURNEY NODES (in order): {nodes_json}

For each node in order, decide:
  verdict: "pass" | "warn" | "fail"
  reason: one short sentence

Stop early at the first "fail" (record that final fail and do not emit
subsequent nodes). Otherwise walk through every node.

Return a JSON object: {{
  "steps": [{{ "nodeId": str, "verdict": str, "reason": str }}, ...],
  "endedAt": "<nodeId where the walk terminated>",
  "verdict": "pass" | "warn" | "fail"   // overall
}}
"""

VERDICT_PROMPT = """You are writing the executive summary of a QA run.

FIT FINDING: {fit_json}
STRUCTURE FINDINGS: {structure_json}
WALK RESULTS (per-profile): {walks_json}

Produce a 3-paragraph plain-English summary suitable for a marketer:
1. Whether the segment fits the journey.
2. Notable structural issues, if any.
3. What the simulated walks revealed.

Then choose an overall verdict: "pass" if no walks failed and no err-severity
structure findings; "warn" if there are warnings only; "fail" otherwise.

Return JSON: {{ "verdict": "pass"|"warn"|"fail", "summary": "<text>" }}.
"""
```

- [ ] **Step 3: Commit (no tests for prompts/state alone — they're consumed in subsequent tasks)**

```bash
git add apps/api/app/qa/state.py apps/api/app/qa/prompts.py
git commit -m "feat(qa): add LangGraph state schema and per-node prompt templates"
```

---

## Task 8: QA nodes — `load_inputs` + step emitter

**Files:**
- Create: `apps/api/app/qa/emit.py`
- Create: `apps/api/app/qa/nodes/__init__.py` (empty)
- Create: `apps/api/app/qa/nodes/load_inputs.py`
- Create: `apps/api/tests/test_node_load_inputs.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_node_load_inputs.py`:

```python
from __future__ import annotations

import pytest

from app.qa.nodes.load_inputs import load_inputs
from app.qa.store import RunRegistry


async def test_load_inputs_populates_state():
    reg = RunRegistry()
    run = reg.create(journey_id="season-ticket-renewal-journey", segment_id="seg_high_ltv_customers_who", profile_count=3)
    state = {"run_id": run.run_id, "journey_id": run.journey_id, "segment_id": run.segment_id, "profile_count": 3}
    out = await load_inputs(state, registry=reg)
    assert out["journey"]["useCaseId"] == "season-ticket-renewal-journey"
    assert out["segment"]["id"] == "seg_high_ltv_customers_who"


async def test_load_inputs_raises_for_unknown_ids():
    reg = RunRegistry()
    run = reg.create(journey_id="nope", segment_id="nope", profile_count=1)
    state = {"run_id": run.run_id, "journey_id": "nope", "segment_id": "nope", "profile_count": 1}
    with pytest.raises(LookupError):
        await load_inputs(state, registry=reg)
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_node_load_inputs.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement emit helper**

Create `apps/api/app/qa/emit.py`:

```python
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
```

- [ ] **Step 4: Implement load_inputs**

Create `apps/api/app/qa/nodes/__init__.py` (empty file).

Create `apps/api/app/qa/nodes/load_inputs.py`:

```python
"""Resolve journey + segment by id and seed the QAState."""

from __future__ import annotations

from typing import Any

from app.data.loaders import get_journey_by_id, get_segment_by_id
from app.qa.emit import emit_step
from app.qa.store import RunRegistry, registry as default_registry


async def load_inputs(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    journey = get_journey_by_id(state["journey_id"])
    segment = get_segment_by_id(state["segment_id"])
    if journey is None or segment is None:
        raise LookupError(f"Unknown journey={state['journey_id']!r} or segment={state['segment_id']!r}")
    await emit_step(
        run_id,
        node_id="load_inputs",
        label="Load inputs",
        msg=f"Resolved journey {journey.get('name', '?')} and segment {segment.get('name', '?')}.",
        progress=5,
        registry=reg,
    )
    return {"journey": journey, "segment": segment}
```

- [ ] **Step 5: Run tests, watch pass**

```bash
pytest tests/test_node_load_inputs.py -v
```

Expected: 2/2 PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/qa/emit.py apps/api/app/qa/nodes/ apps/api/tests/test_node_load_inputs.py
git commit -m "feat(qa): add load_inputs node + SSE emit helper"
```

---

## Task 9: QA node — `fit_check`

**Files:**
- Create: `apps/api/app/qa/nodes/fit_check.py`
- Create: `apps/api/tests/conftest.py`
- Create: `apps/api/tests/test_node_fit_check.py`

- [ ] **Step 1: Add shared test fixtures**

Create `apps/api/tests/conftest.py`:

```python
"""Shared pytest fixtures: a tiny stub chat model for QA-node tests."""

from __future__ import annotations

from typing import Any

import pytest

from app.llm import router as router_mod


class StubStructuredModel:
    """Returns a pre-set Pydantic object from `.invoke()` regardless of input."""

    def __init__(self, response: Any) -> None:
        self._response = response

    def with_structured_output(self, _schema: Any) -> "StubStructuredModel":
        return self

    def invoke(self, _prompt: Any) -> Any:
        return self._response

    async def ainvoke(self, _prompt: Any) -> Any:
        return self._response


@pytest.fixture
def stub_model():
    """Yield a factory that installs a stub for a given node and tears it down."""
    installed: list[str] = []

    def _install(node: str, response: Any) -> StubStructuredModel:
        m = StubStructuredModel(response)
        router_mod.set_override(node, m)
        installed.append(node)
        return m

    yield _install
    router_mod.clear_overrides()
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/tests/test_node_fit_check.py`:

```python
from __future__ import annotations

from app.qa.nodes.fit_check import fit_check
from app.qa.schemas import FitFinding
from app.qa.store import RunRegistry


async def test_fit_check_writes_finding_to_state(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    stub_model("fit_check", FitFinding(verdict="pass", score=0.9, reasons=["aligned"], summary="ok"))
    state = {
        "run_id": run.run_id,
        "journey": {"name": "Renewal", "journeyTable": {"journeyGoal": "renew"}, "entryCriteria": {"event": "x"}, "touchpoints": [1, 2]},
        "segment": {"id": "s1", "rules": []},
    }
    out = await fit_check(state, registry=reg)
    assert isinstance(out["fit"], FitFinding)
    assert out["fit"].verdict == "pass"
```

- [ ] **Step 3: Run, watch fail**

```bash
pytest tests/test_node_fit_check.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 4: Implement node**

Create `apps/api/app/qa/nodes/fit_check.py`:

```python
"""Evaluate whether the chosen segment fits the chosen journey."""

from __future__ import annotations

import json
from typing import Any

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.prompts import FIT_PROMPT
from app.qa.schemas import FitFinding
from app.qa.store import RunRegistry, registry as default_registry


async def fit_check(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    journey = state["journey"]
    segment = state["segment"]

    prompt = FIT_PROMPT.format(
        segment_json=json.dumps(segment),
        journey_name=journey.get("name", "?"),
        journey_goal=journey.get("journeyTable", {}).get("journeyGoal", "?"),
        entry_criteria_json=json.dumps(journey.get("entryCriteria", {})),
        tp_count=len(journey.get("touchpoints", [])),
    )

    llm = get_chat_model("fit_check").with_structured_output(FitFinding)
    finding: FitFinding = await llm.ainvoke(prompt) if hasattr(llm, "ainvoke") else llm.invoke(prompt)

    level = "info" if finding.verdict == "pass" else ("warn" if finding.verdict == "warn" else "err")
    await emit_step(
        run_id,
        node_id="fit_check",
        label="Segment fit check",
        msg=finding.summary or f"Fit verdict: {finding.verdict} (score={finding.score:.2f})",
        progress=20,
        level=level,
        registry=reg,
    )
    return {"fit": finding}
```

- [ ] **Step 5: Run, watch pass**

```bash
pytest tests/test_node_fit_check.py -v
```

Expected: 1/1 PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/qa/nodes/fit_check.py apps/api/tests/conftest.py apps/api/tests/test_node_fit_check.py
git commit -m "feat(qa): add fit_check node"
```

---

## Task 10: QA node — `structure_check`

**Files:**
- Create: `apps/api/app/qa/nodes/structure_check.py`
- Create: `apps/api/tests/test_node_structure_check.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_node_structure_check.py`:

```python
from __future__ import annotations

from app.qa.nodes.structure_check import structure_check
from app.qa.schemas import Finding
from app.qa.store import RunRegistry


async def test_structure_check_uses_static_findings_when_llm_unavailable(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    # Stub returns the static findings unchanged (list of Finding-shaped dicts).
    stub_model("structure_check", [
        Finding(nodeId="-", severity="err", message="Journey has no EXIT node."),
    ])
    state = {
        "run_id": run.run_id,
        "journey": {
            "name": "Bad",
            "touchpoints": [],
            "journey": {"nodes": [
                {"id": "n1", "type": "ENTRY"},
                {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
            ]},
        },
    }
    out = await structure_check(state, registry=reg)
    assert any(f.severity == "err" for f in out["structure"])


async def test_structure_check_passes_clean_journey(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    stub_model("structure_check", [])
    state = {
        "run_id": run.run_id,
        "journey": {
            "name": "Good",
            "touchpoints": [{"tpId": "TP1"}],
            "journey": {"nodes": [
                {"id": "n1", "type": "ENTRY"},
                {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
                {"id": "n3", "type": "EXIT"},
            ]},
        },
    }
    out = await structure_check(state, registry=reg)
    assert out["structure"] == []
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_node_structure_check.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement node**

Create `apps/api/app/qa/nodes/structure_check.py`:

```python
"""Run static structural rules, then ask the LLM to humanize each finding."""

from __future__ import annotations

import json
from typing import Any

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.prompts import STRUCTURE_EXPLAIN_PROMPT
from app.qa.schemas import Finding
from app.qa.static_checks import run_static_checks
from app.qa.store import RunRegistry, registry as default_registry


async def structure_check(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    journey = state["journey"]

    raw_findings = run_static_checks(journey)
    if not raw_findings:
        await emit_step(
            run_id,
            node_id="structure_check",
            label="Journey structure",
            msg="No structural issues detected.",
            progress=40,
            registry=reg,
        )
        return {"structure": []}

    prompt = STRUCTURE_EXPLAIN_PROMPT.format(
        findings_json=json.dumps([f.model_dump() for f in raw_findings]),
        journey_name=journey.get("name", "?"),
        tp_count=len(journey.get("touchpoints", [])),
    )

    llm = get_chat_model("structure_check").with_structured_output(list[Finding])
    enriched: list[Finding]
    try:
        enriched = await llm.ainvoke(prompt) if hasattr(llm, "ainvoke") else llm.invoke(prompt)
    except Exception:
        # If the LLM call fails, fall back to the static findings as-is.
        enriched = raw_findings

    worst = "info"
    for f in enriched:
        if f.severity == "err":
            worst = "err"
            break
        if f.severity == "warn":
            worst = "warn"

    await emit_step(
        run_id,
        node_id="structure_check",
        label="Journey structure",
        msg=f"{len(enriched)} structural finding(s).",
        progress=40,
        level=worst,
        registry=reg,
    )
    return {"structure": enriched}
```

- [ ] **Step 4: Run, watch pass**

```bash
pytest tests/test_node_structure_check.py -v
```

Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/qa/nodes/structure_check.py apps/api/tests/test_node_structure_check.py
git commit -m "feat(qa): add structure_check node (static + LLM humanizer)"
```

---

## Task 11: QA node — `profile_synth`

**Files:**
- Create: `apps/api/app/qa/nodes/profile_synth.py`
- Create: `apps/api/tests/test_node_profile_synth.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_node_profile_synth.py`:

```python
from __future__ import annotations

from app.qa.nodes.profile_synth import profile_synth
from app.qa.store import RunRegistry


async def test_profile_synth_uses_llm_output(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=3)
    stub_model("profile_synth", [
        {"id": "p1", "name": "A", "region": "DE", "age": 40, "consent": True, "fcap": 0, "lastSend": "5d",
         "ltvTier": "High", "engagementTier": "Low", "recency": "High", "contentAffinity": "Medium"},
        {"id": "p2", "name": "B", "region": "FR", "age": 30, "consent": False, "fcap": 3, "lastSend": "30d",
         "ltvTier": "High", "engagementTier": "Low", "recency": "High", "contentAffinity": "Low"},
        {"id": "p3", "name": "C", "region": "NL", "age": 55, "consent": True, "fcap": 1, "lastSend": "10d",
         "ltvTier": "High", "engagementTier": "Low", "recency": "High", "contentAffinity": "High"},
    ])
    state = {
        "run_id": run.run_id,
        "segment": {"id": "s1", "rules": [{"field": "LTV Tier", "value": "High", "joiner": ""}]},
        "profile_count": 3,
    }
    out = await profile_synth(state, registry=reg)
    assert len(out["profiles"]) == 3
    assert out["profiles"][0]["id"] == "p1"
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_node_profile_synth.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement node**

Create `apps/api/app/qa/nodes/profile_synth.py`:

```python
"""Generate synthetic profiles that satisfy the segment rules + edge cases."""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.prompts import PROFILE_SYNTH_PROMPT
from app.qa.store import RunRegistry, registry as default_registry


async def profile_synth(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    segment = state["segment"]
    n = int(state.get("profile_count", 5))
    n_edge = min(2, max(1, n // 3))
    n_base = n - n_edge

    prompt = PROFILE_SYNTH_PROMPT.format(
        n=n,
        n_base=n_base,
        n_edge=n_edge,
        segment_json=json.dumps(segment),
    )

    llm = get_chat_model("profile_synth")
    # Use plain JSON parsing here (no Pydantic — profile shape is free-form for the walk).
    raw: Any
    if hasattr(llm, "ainvoke"):
        try:
            raw = await llm.ainvoke([HumanMessage(content=prompt)])
        except TypeError:
            raw = await llm.ainvoke(prompt)
    else:
        raw = llm.invoke(prompt)

    profiles: list[dict[str, Any]]
    if isinstance(raw, list):
        profiles = raw
    elif hasattr(raw, "content"):
        profiles = json.loads(raw.content)
    else:
        profiles = json.loads(str(raw))

    await emit_step(
        run_id,
        node_id="profile_synth",
        label="Synthesize profiles",
        msg=f"Generated {len(profiles)} profiles ({n_edge} edge case(s)).",
        progress=55,
        registry=reg,
    )
    return {"profiles": profiles}
```

- [ ] **Step 4: Run, watch pass**

```bash
pytest tests/test_node_profile_synth.py -v
```

Expected: 1/1 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/qa/nodes/profile_synth.py apps/api/tests/test_node_profile_synth.py
git commit -m "feat(qa): add profile_synth node"
```

---

## Task 12: QA node — `walk_profile` (single profile)

**Files:**
- Create: `apps/api/app/qa/nodes/walk_profile.py`
- Create: `apps/api/tests/test_node_walk_profile.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_node_walk_profile.py`:

```python
from __future__ import annotations

from app.qa.nodes.walk_profile import walk_profile
from app.qa.schemas import WalkTrace, WalkStep
from app.qa.store import RunRegistry


async def test_walk_profile_returns_trace(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    stub_model("walk_profile", WalkTrace(
        profile={"id": "p1", "name": "A"},
        steps=[
            WalkStep(nodeId="n1", verdict="pass", reason="entered"),
            WalkStep(nodeId="n2", verdict="pass", reason="message ok"),
            WalkStep(nodeId="n3", verdict="pass", reason="exit"),
        ],
        endedAt="n3",
        verdict="pass",
    ))
    state = {
        "run_id": run.run_id,
        "journey": {"journey": {"nodes": [{"id": "n1", "type": "ENTRY"}, {"id": "n2", "type": "MESSAGE"}, {"id": "n3", "type": "EXIT"}]}},
        "profile": {"id": "p1", "name": "A", "consent": True, "fcap": 0},
        "profile_index": 0,
        "profile_total": 1,
    }
    out = await walk_profile(state, registry=reg)
    assert isinstance(out["walks"], list) and len(out["walks"]) == 1
    assert out["walks"][0].verdict == "pass"
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_node_walk_profile.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement node**

Create `apps/api/app/qa/nodes/walk_profile.py`:

```python
"""Walk one profile through the journey nodes, deciding verdicts via the LLM."""

from __future__ import annotations

import json
from typing import Any

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.prompts import WALK_PROMPT
from app.qa.schemas import WalkTrace
from app.qa.store import RunRegistry, registry as default_registry


async def walk_profile(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    journey = state["journey"]
    profile = state["profile"]
    idx = int(state.get("profile_index", 0))
    total = int(state.get("profile_total", 1))

    nodes = journey.get("journey", {}).get("nodes", [])
    prompt = WALK_PROMPT.format(
        profile_json=json.dumps(profile),
        nodes_json=json.dumps(nodes),
    )

    llm = get_chat_model("walk_profile").with_structured_output(WalkTrace)
    trace: WalkTrace = await llm.ainvoke(prompt) if hasattr(llm, "ainvoke") else llm.invoke(prompt)
    # Stamp the trace with the input profile in case the LLM omitted it.
    trace = trace.model_copy(update={"profile": profile})

    # Progress moves between 55% (after profile_synth) and 85% (before aggregate) proportionally.
    span = 30
    progress = 55 + int(((idx + 1) / total) * span)
    level = "info" if trace.verdict == "pass" else ("warn" if trace.verdict == "warn" else "err")
    await emit_step(
        run_id,
        node_id="walk_profile",
        label=f"Profile walk — {profile.get('name', profile.get('id', '?'))}",
        msg=f"Ended at {trace.endedAt} ({trace.verdict}).",
        progress=progress,
        level=level,
        node_instance=f"walk_profile:{profile.get('id', idx)}",
        registry=reg,
    )
    return {"walks": [trace]}
```

- [ ] **Step 4: Run, watch pass**

```bash
pytest tests/test_node_walk_profile.py -v
```

Expected: 1/1 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/qa/nodes/walk_profile.py apps/api/tests/test_node_walk_profile.py
git commit -m "feat(qa): add walk_profile node (single-profile simulation)"
```

---

## Task 13: QA node — `verdict_summary`

**Files:**
- Create: `apps/api/app/qa/nodes/verdict_summary.py`
- Create: `apps/api/tests/test_node_verdict_summary.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_node_verdict_summary.py`:

```python
from __future__ import annotations

from pydantic import BaseModel

from app.qa.nodes.verdict_summary import verdict_summary
from app.qa.schemas import FitFinding, Finding, WalkStep, WalkTrace
from app.qa.store import RunRegistry


class _Resp(BaseModel):
    verdict: str
    summary: str


async def test_verdict_summary_writes_state(stub_model):
    reg = RunRegistry()
    run = reg.create(journey_id="j1", segment_id="s1", profile_count=1)
    stub_model("verdict_summary", _Resp(verdict="warn", summary="overall warn"))
    state = {
        "run_id": run.run_id,
        "fit": FitFinding(verdict="pass", score=0.8, reasons=[], summary=""),
        "structure": [Finding(nodeId="n1", severity="warn", message="x")],
        "walks": [WalkTrace(profile={"id": "p1"}, steps=[WalkStep(nodeId="n1", verdict="pass", reason="ok")], endedAt="n1", verdict="pass")],
    }
    out = await verdict_summary(state, registry=reg)
    assert out["verdict"] == "warn"
    assert out["summary"] == "overall warn"
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_node_verdict_summary.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Implement node**

Create `apps/api/app/qa/nodes/verdict_summary.py`:

```python
"""Write the executive summary + overall verdict for a QA run."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel

from app.llm.router import get_chat_model
from app.qa.emit import emit_step
from app.qa.prompts import VERDICT_PROMPT
from app.qa.store import RunRegistry, registry as default_registry


class _VerdictResponse(BaseModel):
    verdict: str
    summary: str


async def verdict_summary(state: dict[str, Any], *, registry: RunRegistry | None = None) -> dict[str, Any]:
    reg = registry or default_registry
    run_id = state["run_id"]
    fit = state["fit"]
    structure = state.get("structure", [])
    walks = state.get("walks", [])

    prompt = VERDICT_PROMPT.format(
        fit_json=fit.model_dump_json(),
        structure_json=json.dumps([f.model_dump() for f in structure]),
        walks_json=json.dumps([w.model_dump() for w in walks]),
    )

    llm = get_chat_model("verdict_summary").with_structured_output(_VerdictResponse)
    resp: _VerdictResponse = await llm.ainvoke(prompt) if hasattr(llm, "ainvoke") else llm.invoke(prompt)

    level = "info" if resp.verdict == "pass" else ("warn" if resp.verdict == "warn" else "err")
    await emit_step(
        run_id,
        node_id="verdict_summary",
        label="Verdict",
        msg=resp.summary[:140],
        progress=95,
        level=level,
        registry=reg,
    )
    return {"verdict": resp.verdict, "summary": resp.summary}
```

- [ ] **Step 4: Run, watch pass**

```bash
pytest tests/test_node_verdict_summary.py -v
```

Expected: 1/1 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/qa/nodes/verdict_summary.py apps/api/tests/test_node_verdict_summary.py
git commit -m "feat(qa): add verdict_summary node"
```

---

## Task 14: LangGraph assembly with `Send` fan-out

**Files:**
- Create: `apps/api/app/qa/graph.py`
- Create: `apps/api/tests/test_graph_e2e.py`

- [ ] **Step 1: Write the failing end-to-end test**

Create `apps/api/tests/test_graph_e2e.py`:

```python
from __future__ import annotations

import json

import pytest
from pydantic import BaseModel

from app.qa.graph import build_qa_graph
from app.qa.schemas import FitFinding, Finding, WalkStep, WalkTrace
from app.qa.store import RunRegistry


class _VerdictResp(BaseModel):
    verdict: str
    summary: str


async def test_graph_end_to_end_with_stub_llms(stub_model):
    reg = RunRegistry()
    run = reg.create(
        journey_id="season-ticket-renewal-journey",
        segment_id="seg_high_ltv_customers_who",
        profile_count=2,
    )

    stub_model("fit_check", FitFinding(verdict="pass", score=0.9, reasons=["aligned"], summary="ok"))
    stub_model("structure_check", [])
    stub_model("profile_synth", [
        {"id": "p1", "name": "A", "region": "DE", "age": 35, "consent": True, "fcap": 0, "lastSend": "10d",
         "ltvTier": "High", "engagementTier": "Low", "recency": "High", "contentAffinity": "Medium"},
        {"id": "p2", "name": "B", "region": "FR", "age": 50, "consent": False, "fcap": 3, "lastSend": "1d",
         "ltvTier": "High", "engagementTier": "Low", "recency": "High", "contentAffinity": "Low"},
    ])
    stub_model("walk_profile", WalkTrace(
        profile={},  # node will overwrite
        steps=[WalkStep(nodeId="n1", verdict="pass", reason="ok")],
        endedAt="n1",
        verdict="pass",
    ))
    stub_model("verdict_summary", _VerdictResp(verdict="pass", summary="all good"))

    graph = build_qa_graph(registry=reg)
    final = await graph.ainvoke({
        "run_id": run.run_id,
        "journey_id": "season-ticket-renewal-journey",
        "segment_id": "seg_high_ltv_customers_who",
        "profile_count": 2,
    })
    assert final["verdict"] == "pass"
    assert len(final["walks"]) == 2
    assert final["fit"].verdict == "pass"
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_graph_e2e.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.qa.graph'`.

- [ ] **Step 3: Implement the graph**

Create `apps/api/app/qa/graph.py`:

```python
"""Assemble the QA LangGraph DAG.

Topology:
    load_inputs → fit_check → structure_check → profile_synth →
        walk_fanout (Send → walk_profile × N) → aggregate_walks → verdict_summary → END

Each LLM node is registered with its own name; the router uses that name
to pick a model and provider.
"""

from __future__ import annotations

from typing import Any

from langgraph.constants import Send
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
```

- [ ] **Step 4: Run the test, watch pass**

```bash
pytest tests/test_graph_e2e.py -v
```

Expected: 1/1 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/qa/graph.py apps/api/tests/test_graph_e2e.py
git commit -m "feat(qa): assemble langgraph DAG with profile-walk fan-out via Send"
```

---

## Task 15: Segments router

**Files:**
- Create: `apps/api/app/routers/segments.py`
- Modify: `apps/api/app/main.py:14, 32`
- Create: `apps/api/tests/test_segments_router.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_segments_router.py`:

```python
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_list_segments(client):
    resp = await client.get("/segments")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 4
    ids = {s["id"] for s in body}
    assert "seg_high_ltv_customers_who" in ids


async def test_get_segment_by_id(client):
    resp = await client.get("/segments/seg_high_ltv_customers_who")
    assert resp.status_code == 200
    assert resp.json()["id"] == "seg_high_ltv_customers_who"


async def test_get_segment_unknown_returns_404(client):
    resp = await client.get("/segments/nope")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_segments_router.py -v
```

Expected: 404s or `AttributeError` because `/segments` isn't registered.

- [ ] **Step 3: Implement segments router**

Create `apps/api/app/routers/segments.py`:

```python
"""Segment endpoints — list all + fetch one by id."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.data.loaders import get_segment_by_id, load_segments
from app.qa.schemas import SegmentModel

router = APIRouter(tags=["segments"])


@router.get("/segments", response_model=list[SegmentModel])
def list_segments() -> list[dict]:
    return load_segments()


@router.get("/segments/{segment_id}", response_model=SegmentModel)
def get_segment(segment_id: str) -> dict:
    seg = get_segment_by_id(segment_id)
    if seg is None:
        raise HTTPException(status_code=404, detail=f"Unknown segment {segment_id!r}")
    return seg
```

- [ ] **Step 4: Register router in main.py**

Modify `apps/api/app/main.py`. Change line 14 (the import):

```python
from app.routers import journey, profiles, runs, segments
```

And add a line after `app.include_router(runs.router)` (currently line 34):

```python
app.include_router(segments.router)
```

- [ ] **Step 5: Run, watch pass**

```bash
pytest tests/test_segments_router.py -v
```

Expected: 3/3 PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/segments.py apps/api/app/main.py apps/api/tests/test_segments_router.py
git commit -m "feat(api): add /segments routes backed by examples/segments/*.json"
```

---

## Task 16: Replace journey router with examples-backed loader

**Files:**
- Modify: `apps/api/app/routers/journey.py` (rewrite)
- Modify: `apps/api/app/data/fixtures.py` (drop old `JOURNEY`/`JOURNEY_SUMMARIES`)
- Modify: `apps/api/app/routers/runs.py` (drop the import of old `JOURNEY`)
- Create: `apps/api/tests/test_journey_router.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_journey_router.py`:

```python
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_list_journeys_returns_18(client):
    resp = await client.get("/journeys")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 18
    # Each summary must have id + name to power the dropdown.
    assert all("id" in j and "name" in j for j in body)


async def test_get_journey_returns_rich_shape(client):
    resp = await client.get("/journey?id=season-ticket-renewal-journey")
    assert resp.status_code == 200
    j = resp.json()
    assert j["useCaseId"] == "season-ticket-renewal-journey"
    assert "entryCriteria" in j and "touchpoints" in j and "journey" in j


async def test_get_journey_unknown_returns_404(client):
    resp = await client.get("/journey?id=nope")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_journey_router.py -v
```

Expected: tests for the new shape will fail (current journey returns the old fixture shape with `nodes`/`edges` at top level).

- [ ] **Step 3: Rewrite journey router**

Replace the contents of `apps/api/app/routers/journey.py`:

```python
"""Journey endpoints — list summaries + return a single journey by id.

Data source: examples/journey.json (18 real journeys).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.data.loaders import get_journey_by_id, load_journeys

router = APIRouter(tags=["journey"])


@router.get("/journeys")
def list_journeys() -> list[dict[str, Any]]:
    """Lightweight list for the journey dropdown."""
    return [
        {
            "id": j["useCaseId"],
            "name": j.get("name", j["useCaseId"]),
            "category": j.get("category", {}).get("categoryName", "Uncategorized"),
            "status": j.get("status", "Draft"),
            "version": j.get("version", "1"),
        }
        for j in load_journeys()
    ]


@router.get("/journey")
def get_journey(id: str = Query(..., description="Journey useCaseId")) -> dict[str, Any]:
    journey = get_journey_by_id(id)
    if journey is None:
        raise HTTPException(status_code=404, detail=f"Unknown journey {id!r}")
    return journey
```

- [ ] **Step 4: Strip stale references**

In `apps/api/app/data/fixtures.py`, **delete** the `_JOURNEY_GRAPH`, `JOURNEY_SUMMARIES`, `get_journey_by_id`, and `JOURNEY` symbols (everything before the `PROFILES` block). The profiles section and `generate_profiles` stay — they're still used by the profiles router.

In `apps/api/app/routers/runs.py`, **replace the entire file** with a minimal stub (Task 17 fills it in with the real QA endpoints):

```python
"""Run endpoints — temporary stub. Full implementation lands in Task 17."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["runs"])
```

This avoids a broken intermediate state between Task 16 and Task 17.

- [ ] **Step 5: Run tests, watch pass**

```bash
pytest tests/test_journey_router.py -v
```

Expected: 3/3 PASS. Also run the full suite:

```bash
pytest -v
```

All tests so far must still pass. If `tests/test_segments_router.py` or others now break because of the fixtures cleanup, they should fail loudly with import errors, not silently — fix forward.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/journey.py apps/api/app/data/fixtures.py apps/api/app/routers/runs.py apps/api/tests/test_journey_router.py
git commit -m "refactor(api): serve journeys from examples/journey.json instead of in-memory fixture"
```

---

## Task 17: QA run endpoints (`POST /runs/qa`, `GET /runs/{id}/report`) + SSE stream

**Files:**
- Modify: `apps/api/app/routers/runs.py` (rewrite)
- Create: `apps/api/tests/test_runs_qa.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_runs_qa.py`:

```python
from __future__ import annotations

import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.llm import router as router_mod
from app.main import app
from app.qa.schemas import FitFinding, WalkStep, WalkTrace


class _Resp(BaseModel):
    verdict: str
    summary: str


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
def _install_stubs():
    class Stub:
        def __init__(self, r): self.r = r
        def with_structured_output(self, _s): return self
        def invoke(self, _p): return self.r
        async def ainvoke(self, _p): return self.r

    router_mod.set_override("fit_check", Stub(FitFinding(verdict="pass", score=0.9, reasons=[], summary="ok")))
    router_mod.set_override("structure_check", Stub([]))
    router_mod.set_override("profile_synth", Stub([
        {"id": "p1", "name": "A", "region": "DE", "age": 30, "consent": True, "fcap": 0, "lastSend": "5d",
         "ltvTier": "High", "engagementTier": "Low", "recency": "High", "contentAffinity": "Medium"},
    ]))
    router_mod.set_override("walk_profile", Stub(WalkTrace(
        profile={}, steps=[WalkStep(nodeId="n1", verdict="pass", reason="ok")], endedAt="n1", verdict="pass",
    )))
    router_mod.set_override("verdict_summary", Stub(_Resp(verdict="pass", summary="all clear")))
    yield
    router_mod.clear_overrides()


async def test_post_runs_qa_returns_run_id(client):
    resp = await client.post("/runs/qa", json={
        "journeyId": "season-ticket-renewal-journey",
        "segmentId": "seg_high_ltv_customers_who",
        "profileCount": 1,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "runId" in body and body["status"] == "queued"


async def test_post_runs_qa_404_on_unknown_ids(client):
    resp = await client.post("/runs/qa", json={"journeyId": "x", "segmentId": "y"})
    assert resp.status_code == 404


async def test_qa_run_produces_report(client):
    resp = await client.post("/runs/qa", json={
        "journeyId": "season-ticket-renewal-journey",
        "segmentId": "seg_high_ltv_customers_who",
        "profileCount": 1,
    })
    run_id = resp.json()["runId"]
    # Give the background task time to finish (stubs are instant; small grace period).
    for _ in range(50):
        await asyncio.sleep(0.05)
        r = await client.get(f"/runs/{run_id}/report")
        if r.status_code == 200:
            break
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["verdict"] == "pass"
    assert report["modelProvider"] in ("anthropic", "databricks")
    assert len(report["walks"]) == 1
```

- [ ] **Step 2: Run, watch fail**

```bash
pytest tests/test_runs_qa.py -v
```

Expected: 404 / 405 — `POST /runs/qa` not registered yet.

- [ ] **Step 3: Rewrite runs router**

Replace the contents of `apps/api/app/routers/runs.py`:

```python
"""Run endpoints — QA mode only.

POST /runs/qa starts a LangGraph QA run in the background. Step events stream
over SSE via GET /runs/{run_id}/stream. The final report can be polled at
GET /runs/{run_id}/report once the stream emits `done`.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.data.loaders import get_journey_by_id, get_segment_by_id
from app.llm.router import current_provider
from app.qa.emit import emit_done
from app.qa.graph import build_qa_graph
from app.qa.schemas import QAReport, QARunRequest, QARunResponse
from app.qa.store import registry

router = APIRouter(tags=["runs"])

_graph = build_qa_graph()


def _build_report(run_id: str, final_state: dict, started: float, provider: str) -> dict:
    duration_ms = int((time.time() - started) * 1000)
    return QAReport(
        runId=run_id,
        journeyId=final_state["journey"]["useCaseId"],
        segmentId=final_state["segment"]["id"],
        modelProvider=provider,
        verdict=final_state.get("verdict", "fail"),
        summary=final_state.get("summary", ""),
        fit=final_state["fit"],
        structure=list(final_state.get("structure", [])),
        walks=list(final_state.get("walks", [])),
        createdAt=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        durationMs=duration_ms,
    ).model_dump(mode="json")


async def _execute_run(run_id: str, journey_id: str, segment_id: str, profile_count: int) -> None:
    started = time.time()
    provider = current_provider()
    try:
        final_state = await _graph.ainvoke({
            "run_id": run_id,
            "journey_id": journey_id,
            "segment_id": segment_id,
            "profile_count": profile_count,
        })
        report = _build_report(run_id, final_state, started, provider)
        registry.save_report(run_id, report)
        status = "passed" if report["verdict"] != "fail" else "failed"
        await emit_done(run_id, status=status, duration_ms=report["durationMs"], report_url=f"/runs/{run_id}/report")
    except Exception as exc:
        await emit_done(run_id, status="failed", duration_ms=int((time.time() - started) * 1000),
                        report_url=f"/runs/{run_id}/report")
        registry.save_report(run_id, {"runId": run_id, "verdict": "fail", "summary": f"Run errored: {exc}",
                                       "journeyId": journey_id, "segmentId": segment_id,
                                       "modelProvider": provider, "fit": None, "structure": [], "walks": [],
                                       "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                                       "durationMs": int((time.time() - started) * 1000)})


@router.post("/runs/qa", response_model=QARunResponse)
async def start_qa_run(req: QARunRequest) -> QARunResponse:
    if get_journey_by_id(req.journeyId) is None:
        raise HTTPException(status_code=404, detail=f"Unknown journey {req.journeyId!r}")
    if get_segment_by_id(req.segmentId) is None:
        raise HTTPException(status_code=404, detail=f"Unknown segment {req.segmentId!r}")

    run = registry.create(journey_id=req.journeyId, segment_id=req.segmentId, profile_count=req.profileCount)
    asyncio.create_task(_execute_run(run.run_id, req.journeyId, req.segmentId, req.profileCount))
    return QARunResponse(runId=run.run_id, status="queued")


@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str) -> EventSourceResponse:
    if registry.get(run_id) is None:
        raise HTTPException(status_code=404, detail="Unknown run id")

    async def gen() -> AsyncIterator[dict[str, str]]:
        async for ev in registry.subscribe(run_id):
            yield ev

    return EventSourceResponse(gen())


@router.get("/runs/{run_id}/report")
async def get_report(run_id: str) -> dict:
    report = registry.get_report(run_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not ready or unknown run id")
    return report
```

- [ ] **Step 4: Run, watch pass**

```bash
pytest tests/test_runs_qa.py -v
```

Expected: 3/3 PASS.

- [ ] **Step 5: Run full suite**

```bash
pytest -v
```

Expected: every test green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/runs.py apps/api/tests/test_runs_qa.py
git commit -m "feat(api): add POST /runs/qa + GET /runs/{id}/report backed by LangGraph"
```

---

## Task 18: Wire dotenv loading at process start

**Files:**
- Modify: `apps/api/app/main.py:9-15` (insert dotenv load before imports that read env)

- [ ] **Step 1: Edit `main.py`**

Replace the top of `apps/api/app/main.py` (lines 9-15 in the current file) so it reads:

```python
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # Read apps/api/.env if present.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import journey, profiles, runs, segments
```

The rest of the file stays the same.

- [ ] **Step 2: Verify server boots**

```bash
cd apps/api
uvicorn app.main:app --port 8000 --reload &
sleep 2
curl -s http://localhost:8000/health
kill %1
```

Expected: `{"status":"ok"}`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/main.py
git commit -m "chore(api): load .env at startup so MODEL_PROVIDER takes effect"
```

---

## Task 19: Frontend types

**Files:**
- Modify: `apps/web/lib/types.ts` (append at the end)

- [ ] **Step 1: Append types**

Append to `apps/web/lib/types.ts`:

```typescript
// ─── QA Automation types ────────────────────────────────────────────────────

export interface SegmentRule {
  id: string;
  field: string;
  value: string;
  joiner: string;
}

export interface Segment {
  id: string;
  name: string;
  purpose: string;
  size: string;
  refresh: string;
  exclusions: string;
  status: string;
  rules: SegmentRule[];
  isPreset: boolean;
}

export type QAVerdict = "pass" | "warn" | "fail";
export type QASeverity = "info" | "warn" | "err";

export interface FitFinding {
  verdict: QAVerdict;
  score: number;
  reasons: string[];
  summary: string;
}

export interface StructureFinding {
  nodeId: string;
  severity: QASeverity;
  message: string;
}

export interface WalkStep {
  nodeId: string;
  verdict: QAVerdict;
  reason: string;
}

export interface WalkTrace {
  profile: Record<string, unknown>;
  steps: WalkStep[];
  endedAt: string;
  verdict: QAVerdict;
}

export interface QAReport {
  runId: string;
  journeyId: string;
  segmentId: string;
  modelProvider: string;
  verdict: QAVerdict;
  summary: string;
  fit: FitFinding;
  structure: StructureFinding[];
  walks: WalkTrace[];
  createdAt: string;
  durationMs: number;
}

export interface QARunRequest {
  journeyId: string;
  segmentId: string;
  profileCount?: number;
}

export interface QARunResponse {
  runId: string;
  status: "queued";
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/types.ts
git commit -m "feat(web): add QA automation types"
```

---

## Task 20: Frontend API client extensions

**Files:**
- Modify: `apps/web/lib/api.ts:4` (extend imports), `apps/web/lib/api.ts:19-75` (extend `api` object)

- [ ] **Step 1: Update imports**

In `apps/web/lib/api.ts`, replace the existing import line:

```typescript
import type { Journey, JourneySummary, Profile, TestEvent, LogLine, RunStats } from "./types";
```

with:

```typescript
import type {
  Journey, JourneySummary, Profile, TestEvent, LogLine, RunStats,
  Segment, QAReport, QARunRequest, QARunResponse,
} from "./types";
```

- [ ] **Step 2: Add QA methods to the `api` object**

Inside the `export const api = { ... }` block, add these methods (place them after `subscribeRun`):

```typescript
  async listSegments(): Promise<Segment[]> {
    return http<Segment[]>("/segments");
  },
  async getSegment(id: string): Promise<Segment> {
    return http<Segment>(`/segments/${encodeURIComponent(id)}`);
  },
  async startQARun(req: QARunRequest): Promise<QARunResponse> {
    return http<QARunResponse>("/runs/qa", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
  async getReport(runId: string): Promise<QAReport> {
    return http<QAReport>(`/runs/${encodeURIComponent(runId)}/report`);
  },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/api.ts
git commit -m "feat(web): add api.listSegments / startQARun / getReport"
```

---

## Task 21: SubHeader — segment dropdown + Run QA button

**Files:**
- Modify: `apps/web/components/SubHeader.tsx` (full rewrite if needed)
- Modify: `apps/web/components/App.tsx` (pass new state down)

- [ ] **Step 1: Read current SubHeader to understand its API**

```bash
cat apps/web/components/SubHeader.tsx
```

The component currently owns the journey dropdown and `Save draft`. The change: add a Segment dropdown next to the Journey dropdown and a `Run QA` button on the right.

- [ ] **Step 2: Modify SubHeader props**

In `apps/web/components/SubHeader.tsx`, extend the `interface Props` to include:

```typescript
interface Props {
  // ... existing props (journeys, selectedJourneyId, onJourneyChange, ...)
  segments: Segment[];
  selectedSegmentId: string | null;
  onSegmentChange: (id: string) => void;
  onRunQA: () => void;
  qaRunning: boolean;
}
```

Add an `import type { Segment } from "@/lib/types";` near the top if not present.

In the JSX, locate the existing journey dropdown block. Immediately after it (still inside the left-side container), add a second `<select>`:

```tsx
<select
  className="jo-select"
  value={selectedSegmentId ?? ""}
  onChange={(e) => onSegmentChange(e.target.value)}
  aria-label="Segment"
>
  <option value="" disabled>
    Select segment…
  </option>
  {segments.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name} ({s.size})
    </option>
  ))}
</select>
```

Replace the existing `Save draft` button area's right-hand side to include a `Run QA` button before `Save draft`:

```tsx
<button
  type="button"
  className="jo-btn jo-btn--primary"
  disabled={!selectedSegmentId || qaRunning}
  onClick={onRunQA}
>
  {qaRunning ? "Running QA…" : "Run QA"}
</button>
```

- [ ] **Step 3: Wire App.tsx**

Open `apps/web/components/App.tsx`. The existing state lives on `runState` (a `RunState` object with `logs`, `progress`, `active`, `visited`, `status`). We extend it.

1. Extend the type imports (line 11):

```typescript
import type { Journey, JourneySummary, Profile, RunState, Segment, QAReport } from "@/lib/types";
```

Add `useCallback` to the React import on line 3.

2. Add new state declarations next to the existing `useState` calls (around line 30):

```typescript
const [segments, setSegments] = useState<Segment[]>([]);
const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
const [qaRunning, setQaRunning] = useState(false);
const [qaReport, setQaReport] = useState<QAReport | null>(null);
```

3. Inside the bootstrap `useEffect` (around line 33-55), extend the `Promise.all` call to also load segments. Replace:

```typescript
const [js, j, p] = await Promise.all([
  api.listJourneys(),
  api.getJourney(),
  api.getProfiles(),
]);
```

with:

```typescript
const [js, j, p, segs] = await Promise.all([
  api.listJourneys(),
  api.getJourney(),
  api.getProfiles(),
  api.listSegments(),
]);
```

And add `setSegments(segs);` next to the existing setters.

4. Add the QA handler just before the `return (` JSX block:

```typescript
const handleRunQA = useCallback(async () => {
  if (!activeJourneyId || !selectedSegmentId) return;
  setQaRunning(true);
  setQaReport(null);
  setRunState({ status: "running", visited: new Set(), active: null, logs: [], progress: 0 });
  try {
    const { runId } = await api.startQARun({
      journeyId: activeJourneyId,
      segmentId: selectedSegmentId,
    });
    api.subscribeRun(runId, {
      onStep: (line) => {
        setRunState((prev) => ({
          ...prev,
          status: "running",
          active: line.nodeId,
          progress: line.progress,
          logs: [...prev.logs, { ts: line.ts, level: line.level, node: line.node, label: line.label, msg: line.msg }],
        }));
      },
      onDone: async (payload) => {
        setQaRunning(false);
        setRunState((prev) => ({
          ...prev,
          status: payload.status,
          progress: 100,
          duration: payload.duration,
        }));
        try {
          const report = await api.getReport(runId);
          setQaReport(report);
        } catch (e) {
          console.error(e);
        }
      },
      onError: () => setQaRunning(false),
    });
  } catch (e) {
    console.error(e);
    setQaRunning(false);
  }
}, [activeJourneyId, selectedSegmentId]);
```

5. Pass new props to `<SubHeader />` (find the existing JSX use) — add these props to whatever the existing call looks like:

```tsx
segments={segments}
selectedSegmentId={selectedSegmentId}
onSegmentChange={setSelectedSegmentId}
onRunQA={handleRunQA}
qaRunning={qaRunning}
```

6. Pass `qaReport` to `<Inspector />` (used in Task 23):

```tsx
<Inspector
  // ... existing props
  qaReport={qaReport}
/>
```

- [ ] **Step 4: Smoke-test the UI**

```bash
pnpm dev:web &
DEV_PID=$!
sleep 3
# Open http://localhost:3000 manually; verify: (a) journey dropdown still works,
# (b) new Segment dropdown is populated with 4 entries, (c) "Run QA" is disabled
# until a segment is picked.
kill $DEV_PID
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/SubHeader.tsx apps/web/components/App.tsx
git commit -m "feat(web): add segment dropdown + Run QA button to SubHeader"
```

---

## Task 22: RunPanel — handle new QA nodeIds

**Files:**
- Modify: `apps/web/components/RunPanel.tsx`

- [ ] **Step 1: Add QA node labels**

Near the top of `RunPanel.tsx`, add a small dictionary used when rendering step events:

```typescript
const QA_NODE_LABELS: Record<string, string> = {
  load_inputs: "Load inputs",
  fit_check: "Segment fit",
  structure_check: "Journey structure",
  profile_synth: "Synthesize profiles",
  walk_profile: "Profile walk",
  aggregate_walks: "Aggregate",
  verdict_summary: "Verdict",
};
```

Wherever the panel currently renders `line.label` or `line.node`, fall back to `QA_NODE_LABELS[line.nodeId] ?? line.label`. (Search for `label` rendering in the existing JSX and update those sites.)

- [ ] **Step 2: Smoke-test**

```bash
pnpm dev:web &
sleep 3
# In browser, run a QA flow; the panel's step rows should show the new labels.
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/RunPanel.tsx
git commit -m "feat(web): render QA node labels in RunPanel step events"
```

---

## Task 23: Inspector tab — QA report rendering

**Files:**
- Modify: `apps/web/components/inspector/InspectTab.tsx`

- [ ] **Step 1: Add a Props field for the report**

In `apps/web/components/inspector/InspectTab.tsx`, extend the props interface:

```typescript
import type { QAReport } from "@/lib/types";

interface Props {
  // ... existing
  qaReport: QAReport | null;
}
```

- [ ] **Step 2: Render the report**

Add a section at the top of the rendered JSX (above existing content), conditional on `qaReport`:

```tsx
{qaReport && (
  <section className="jo-section">
    <div className={`jo-badge jo-badge--${qaReport.verdict === "pass" ? "live" : qaReport.verdict === "warn" ? "draft" : "draft"}`}>
      {qaReport.verdict.toUpperCase()}
    </div>
    <p className="jo-section__summary">{qaReport.summary}</p>

    <h4>Fit ({qaReport.fit.verdict}, score {qaReport.fit.score.toFixed(2)})</h4>
    <ul>
      {qaReport.fit.reasons.map((r, i) => (<li key={i}>{r}</li>))}
    </ul>

    <h4>Structure findings</h4>
    {qaReport.structure.length === 0 ? (
      <p>No structural issues detected.</p>
    ) : (
      <ul>
        {qaReport.structure.map((f, i) => (
          <li key={i}><strong>{f.severity.toUpperCase()}</strong> — {f.nodeId}: {f.message}</li>
        ))}
      </ul>
    )}

    <h4>Profile walks</h4>
    <ol>
      {qaReport.walks.map((w, i) => (
        <li key={i}>
          <details>
            <summary>
              {String((w.profile as { name?: string }).name ?? `Profile ${i + 1}`)} — {w.verdict} (ended at {w.endedAt})
            </summary>
            <ul>
              {w.steps.map((s, j) => (
                <li key={j}>{s.nodeId} — {s.verdict}: {s.reason}</li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ol>
  </section>
)}
```

- [ ] **Step 3: Pass the report from `Inspector.tsx`**

In `apps/web/components/Inspector.tsx`, accept a `qaReport` prop and forward it to `<InspectTab />`. In `App.tsx`, pass `qaReport` (added in Task 21) down through `<Inspector qaReport={qaReport} />`.

- [ ] **Step 4: Smoke-test**

```bash
pnpm dev:web &
sleep 3
# In browser: pick a journey + segment, click Run QA, wait for the run to finish,
# verify the Inspector tab now shows verdict + fit reasons + structure list + walks.
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/inspector/InspectTab.tsx apps/web/components/Inspector.tsx apps/web/components/App.tsx
git commit -m "feat(web): render QA report in Inspector tab"
```

---

## Task 24: Frontend vitest test for segment dropdown + Run QA wiring

**Files:**
- Modify: `apps/web/package.json` (add deps + `test` script)
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/test/setup.ts`
- Create: `apps/web/components/SubHeader.test.tsx`

- [ ] **Step 1: Add vitest + RTL deps**

Edit `apps/web/package.json`:

- Add to `scripts`: `"test": "vitest run"`.
- Add to `devDependencies`:
  ```
  "vitest": "^2.0.0",
  "@vitest/ui": "^2.0.0",
  "jsdom": "^25.0.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/jest-dom": "^6.4.0",
  "@testing-library/user-event": "^14.5.0",
  "@vitejs/plugin-react": "^4.3.0"
  ```

Then install:

```bash
cd apps/web
pnpm install
```

- [ ] **Step 2: Add vitest config**

Create `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globals: true,
  },
});
```

Create `apps/web/test/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Write the failing test**

Create `apps/web/components/SubHeader.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubHeader from "./SubHeader";
import type { JourneySummary, Segment } from "@/lib/types";

const journeys: JourneySummary[] = [
  { id: "j1", name: "Renewal", status: "Live", version: 1, updated: "x", owner: "x" },
];

const segments: Segment[] = [
  { id: "s1", name: "High LTV", purpose: "test", size: "1K", refresh: "Daily",
    exclusions: "None", status: "Draft", rules: [], isPreset: false },
  { id: "s2", name: "Low engagement", purpose: "test", size: "2K", refresh: "Daily",
    exclusions: "None", status: "Draft", rules: [], isPreset: false },
];

describe("SubHeader", () => {
  it("renders both dropdowns and disables Run QA until a segment is picked", async () => {
    const onSegmentChange = vi.fn();
    const onRunQA = vi.fn();

    render(
      <SubHeader
        journeys={journeys}
        selectedJourneyId="j1"
        onJourneyChange={() => {}}
        segments={segments}
        selectedSegmentId={null}
        onSegmentChange={onSegmentChange}
        onRunQA={onRunQA}
        qaRunning={false}
      />,
    );

    const runBtn = screen.getByRole("button", { name: /run qa/i });
    expect(runBtn).toBeDisabled();

    const segmentSelect = screen.getByLabelText(/segment/i) as HTMLSelectElement;
    await userEvent.selectOptions(segmentSelect, "s2");
    expect(onSegmentChange).toHaveBeenCalledWith("s2");
  });

  it("invokes onRunQA when clicked with a segment selected", async () => {
    const onRunQA = vi.fn();
    render(
      <SubHeader
        journeys={journeys}
        selectedJourneyId="j1"
        onJourneyChange={() => {}}
        segments={segments}
        selectedSegmentId="s1"
        onSegmentChange={() => {}}
        onRunQA={onRunQA}
        qaRunning={false}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /run qa/i }));
    expect(onRunQA).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 4: Run vitest**

```bash
pnpm --filter web test
```

Expected: 2/2 PASS. If the existing `SubHeader.tsx` exposes props with different names than the ones used in the test, adapt the test imports to match the actual prop names introduced in Task 21 (the prop *names* in Task 21 are canonical — fix the SubHeader implementation if the test exposes a real mismatch).

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/test/setup.ts apps/web/components/SubHeader.test.tsx apps/web/pnpm-lock.yaml
git commit -m "test(web): add vitest setup + SubHeader QA-wiring test"
```

---

## Task 25: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Backend test suite**

```bash
cd apps/api
pytest -v
```

Expected: every test green.

- [ ] **Step 2: Frontend type-check + lint + tests**

```bash
cd ../..
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web test
```

Expected: no errors; vitest passes.

- [ ] **Step 3: Smoke-run with Anthropic**

```bash
cd apps/api
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY=<real key>, MODEL_PROVIDER=anthropic
source .venv/bin/activate
uvicorn app.main:app --port 8000 --reload &
cd ../..
pnpm dev:web &
# Open http://localhost:3000, pick a journey + segment, click "Run QA".
# Verify: SSE step events stream, Inspector shows a report with non-empty fit/structure/walks.
```

- [ ] **Step 4: Smoke-run with Databricks (optional, only if creds available)**

Stop the API. In `.env` set `MODEL_PROVIDER=databricks`, fill `DATABRICKS_HOST` + `DATABRICKS_TOKEN`. Restart `uvicorn`. Rerun the same flow — verify a report is produced with `modelProvider: "databricks"`.

- [ ] **Step 5: Final commit (any doc tweaks)**

If you made any final doc updates (README addendum, etc.):

```bash
git add -A
git commit -m "docs: note QA automation usage in README"
```

Otherwise this task closes without a commit.

---

## Self-review notes (for the executing agent)

Before declaring done, confirm:
1. `MODEL_PROVIDER=anthropic` works without any Databricks env vars set.
2. `MODEL_PROVIDER=databricks` fails fast and clearly if `DATABRICKS_HOST`/`DATABRICKS_TOKEN` are missing.
3. The 18 journeys + 4 segments from `examples/` are the only data sources — no hand-coded JOURNEY remains.
4. None of the "DO NOT undo" items in `CLAUDE.md` was re-introduced (no top bar, no mode switcher, no Validate/Publish, no Suites tab, no external branding).
5. `pytest -v` and `pnpm --filter web typecheck` both clean.
