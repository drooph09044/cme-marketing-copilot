"""Comprehensive tests for invoke_utils with azure_openai (and other providers).

Each test exercises a distinct code path:
- Direct Pydantic return from stub (all providers)
- JSON text in AIMessage.content (openai / azure_openai path)
- JSON with markdown fences stripped
- Trailing-comma / comment repair
- Literal field validation (Verdict = "pass"|"warn"|"fail")
- invoke_json_list unwrapping patterns
- LengthFinishReasonError re-raise
- Unsupported provider falls through to Anthropic path
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch

import pytest
from pydantic import BaseModel

from app.qa.invoke_utils import invoke_structured, invoke_json_list
from app.qa.schemas import FitFinding, WalkTrace, WalkStep


# ─── Minimal AIMessage stub ────────────────────────────────────────────────

class FakeAIMessage:
    """Minimal stand-in for langchain_core.messages.AIMessage."""

    def __init__(self, content: str = "", tool_calls: list | None = None) -> None:
        self.content = content
        self.tool_calls = tool_calls or []
        self.additional_kwargs: dict[str, Any] = {}


# ─── LLM stub helpers ──────────────────────────────────────────────────────

class SyncLLM:
    """Synchronous stub (no ainvoke — forces the `llm.invoke` fallback branch)."""

    def __init__(self, response: Any) -> None:
        self._response = response

    def bind(self, **_kw: Any) -> "SyncLLM":
        return self

    def invoke(self, _prompt: Any) -> Any:
        return self._response


class AsyncLLM:
    """Async stub used for all provider paths."""

    def __init__(self, response: Any) -> None:
        self._response = response
        self._bind_kwargs: dict[str, Any] = {}

    def bind(self, **kwargs: Any) -> "AsyncLLM":
        bound = AsyncLLM(self._response)
        bound._bind_kwargs = kwargs
        return bound

    async def ainvoke(self, _prompt: Any) -> Any:
        return self._response


class ErrorLLM:
    """Raises a configurable exception from ainvoke."""

    def __init__(self, exc: Exception) -> None:
        self._exc = exc

    def bind(self, **_kw: Any) -> "ErrorLLM":
        return self

    async def ainvoke(self, _prompt: Any) -> Any:
        raise self._exc


# ─── Helper: set MODEL_PROVIDER in environment ─────────────────────────────

def _provider(monkeypatch: pytest.MonkeyPatch, name: str) -> None:
    monkeypatch.setenv("MODEL_PROVIDER", name)
    # Reset router cache so current_provider() re-reads the env var.
    from app.llm import router as router_mod
    router_mod._reset_cache_for_tests()


# ═══════════════════════════════════════════════════════════════════════════
# invoke_structured — openai / azure_openai path
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_json_in_content(monkeypatch, provider):
    """Real LLM response: JSON in AIMessage.content — the golden path."""
    _provider(monkeypatch, provider)
    payload = {"verdict": "pass", "score": 0.95, "reasons": ["aligned"], "summary": "all good"}
    llm = AsyncLLM(FakeAIMessage(content=json.dumps(payload)))
    result = await invoke_structured(llm, "check fit\njson please", FitFinding)
    assert isinstance(result, FitFinding)
    assert result.verdict == "pass"
    assert result.score == pytest.approx(0.95)


@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_json_in_fenced_content(monkeypatch, provider):
    """Model wraps its JSON in a markdown code fence — must be stripped."""
    _provider(monkeypatch, provider)
    payload = {"verdict": "warn", "score": 0.6, "reasons": ["partial"], "summary": "mostly ok"}
    fenced = f"```json\n{json.dumps(payload)}\n```"
    llm = AsyncLLM(FakeAIMessage(content=fenced))
    result = await invoke_structured(llm, "json", FitFinding)
    assert result.verdict == "warn"


@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_literal_verdict_field(monkeypatch, provider):
    """Literal["pass","warn","fail"] on WalkTrace — must not raise OutputParserException."""
    _provider(monkeypatch, provider)
    payload = {
        "steps": [{"nodeId": "n1", "verdict": "warn", "reason": "channel off"}],
        "endedAt": "n1",
        "verdict": "warn",
    }
    llm = AsyncLLM(FakeAIMessage(content=json.dumps(payload)))
    result = await invoke_structured(llm, "walk this profile json", WalkTrace)
    assert isinstance(result, WalkTrace)
    assert result.verdict == "warn"
    assert result.steps[0].verdict == "warn"


@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_json_repair_trailing_comma(monkeypatch, provider):
    """Trailing-comma JSON (common LLM quirk) must be repaired and parsed."""
    _provider(monkeypatch, provider)
    # Trailing comma before closing brace
    bad_json = '{"verdict": "pass", "score": 0.8, "reasons": ["ok",], "summary": "fine",}'
    llm = AsyncLLM(FakeAIMessage(content=bad_json))
    result = await invoke_structured(llm, "json", FitFinding)
    assert result.verdict == "pass"


@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_real_aimessage_not_coerced(monkeypatch, provider):
    """Regression: real langchain AIMessage is a BaseModel — must NOT be coerced via
    model_dump(); its JSON lives in .content and must go through _extract_text."""
    _provider(monkeypatch, provider)
    from langchain_core.messages import AIMessage
    payload = {"verdict": "pass", "score": 0.9, "reasons": ["ok"], "summary": "good"}
    llm = AsyncLLM(AIMessage(content=json.dumps(payload)))
    result = await invoke_structured(llm, "check fit json", FitFinding)
    assert isinstance(result, FitFinding)
    assert result.verdict == "pass"


@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_pydantic_stub_passthrough(monkeypatch, provider):
    """Test stubs returning a Pydantic object directly are returned without JSON parsing."""
    _provider(monkeypatch, provider)
    direct = FitFinding(verdict="fail", score=0.1, reasons=["mismatch"], summary="bad")
    llm = AsyncLLM(direct)
    result = await invoke_structured(llm, "json", FitFinding)
    assert result is direct


@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_compatible_pydantic_coerced(monkeypatch, provider):
    """A structurally compatible BaseModel from a different class is coerced."""
    _provider(monkeypatch, provider)

    class CompatModel(BaseModel):
        verdict: str
        score: float
        reasons: list[str]
        summary: str

    compat = CompatModel(verdict="pass", score=0.9, reasons=[], summary="ok")
    llm = AsyncLLM(compat)
    result = await invoke_structured(llm, "json", FitFinding)
    assert isinstance(result, FitFinding)
    assert result.verdict == "pass"


@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_json_injected_when_missing(monkeypatch, provider):
    """When prompt lacks 'json', the word is auto-injected before the LLM call."""
    _provider(monkeypatch, provider)

    captured_prompts: list[Any] = []

    class CapturingLLM:
        def bind(self, **_kw): return self
        async def ainvoke(self, messages):
            captured_prompts.extend(messages)
            payload = {"verdict": "pass", "score": 1.0, "reasons": [], "summary": ""}
            return FakeAIMessage(content=json.dumps(payload))

    result = await invoke_structured(CapturingLLM(), "Evaluate segment fit", FitFinding)
    assert result.verdict == "pass"
    # The injected suffix must mention JSON
    prompt_text = " ".join(
        (m.content if hasattr(m, "content") else str(m)) for m in captured_prompts
    ).lower()
    assert "json" in prompt_text


@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_length_error_reraises_runtime(monkeypatch, provider):
    """LengthFinishReasonError (or any 'length' exception) is surfaced as RuntimeError."""
    _provider(monkeypatch, provider)

    class LengthError(Exception):
        pass

    llm = ErrorLLM(LengthError("max_tokens exceeded"))
    with pytest.raises(RuntimeError, match="max_tokens"):
        await invoke_structured(llm, "json", FitFinding)


@pytest.mark.parametrize("provider", ["openai", "azure_openai"])
async def test_invoke_structured_other_error_propagates(monkeypatch, provider):
    """Non-length exceptions propagate unchanged."""
    _provider(monkeypatch, provider)
    llm = ErrorLLM(ValueError("network error"))
    with pytest.raises(ValueError, match="network error"):
        await invoke_structured(llm, "json", FitFinding)


# ═══════════════════════════════════════════════════════════════════════════
# invoke_structured — Anthropic / Databricks path
# ═══════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("provider", ["anthropic", "databricks"])
async def test_invoke_structured_anthropic_direct_pydantic(monkeypatch, provider):
    """Anthropic/Databricks path: stub returning Pydantic is returned as-is."""
    _provider(monkeypatch, provider)
    direct = FitFinding(verdict="pass", score=0.9, reasons=[], summary="")
    llm = AsyncLLM(direct)
    result = await invoke_structured(llm, "check", FitFinding)
    assert result is direct


@pytest.mark.parametrize("provider", ["anthropic", "databricks"])
async def test_invoke_structured_anthropic_json_text(monkeypatch, provider):
    """Anthropic path: plain JSON string in content field."""
    _provider(monkeypatch, provider)
    payload = {"verdict": "fail", "score": 0.2, "reasons": ["no match"], "summary": "bad"}
    llm = AsyncLLM(FakeAIMessage(content=json.dumps(payload)))
    result = await invoke_structured(llm, "check", FitFinding)
    assert result.verdict == "fail"


@pytest.mark.parametrize("provider", ["anthropic", "databricks"])
async def test_invoke_structured_sync_llm_fallback(monkeypatch, provider):
    """When llm has no ainvoke, synchronous invoke() is used."""
    _provider(monkeypatch, provider)
    payload = {"verdict": "warn", "score": 0.5, "reasons": [], "summary": ""}
    llm = SyncLLM(FakeAIMessage(content=json.dumps(payload)))
    result = await invoke_structured(llm, "check", FitFinding)
    assert result.verdict == "warn"


# ═══════════════════════════════════════════════════════════════════════════
# invoke_json_list
# ═══════════════════════════════════════════════════════════════════════════

async def test_invoke_json_list_bare_array(monkeypatch):
    """Model returns a bare JSON array in content."""
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    items = [{"id": "a"}, {"id": "b"}]
    llm = AsyncLLM(FakeAIMessage(content=json.dumps(items)))
    result = await invoke_json_list(llm, "generate profiles")
    assert result == items


async def test_invoke_json_list_wrapped_in_items_key(monkeypatch):
    """Model returns {"items": [...]} — common LLM wrapper pattern."""
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    items = [{"id": "x"}]
    llm = AsyncLLM(FakeAIMessage(content=json.dumps({"items": items})))
    result = await invoke_json_list(llm, "go")
    assert result == items


async def test_invoke_json_list_single_object_wrapped(monkeypatch):
    """Model returns a single dict — should be wrapped in a list."""
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    obj = {"id": "p1", "name": "Solo"}
    llm = AsyncLLM(FakeAIMessage(content=json.dumps(obj)))
    result = await invoke_json_list(llm, "go")
    assert result == [obj]


async def test_invoke_json_list_stub_returns_python_list(monkeypatch):
    """Test stub that directly returns a Python list (bypasses text extraction)."""
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    items = [{"id": "p1"}, {"id": "p2"}]
    llm = AsyncLLM(items)
    result = await invoke_json_list(llm, "go")
    assert result == items


async def test_invoke_json_list_fenced_array(monkeypatch):
    """Model wraps array in a code fence."""
    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    items = [{"suite": "Happy Path"}]
    llm = AsyncLLM(FakeAIMessage(content=f"```json\n{json.dumps(items)}\n```"))
    result = await invoke_json_list(llm, "suites")
    assert result == items


# ═══════════════════════════════════════════════════════════════════════════
# azure_openai bind() contract
# ═══════════════════════════════════════════════════════════════════════════

async def test_azure_openai_binds_json_mode(monkeypatch):
    """bind() is called with response_format json_object for azure_openai."""
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    from app.llm import router as router_mod
    router_mod._reset_cache_for_tests()

    bind_calls: list[dict] = []

    class SpyLLM:
        def bind(self, **kwargs):
            bind_calls.append(kwargs)
            return self

        async def ainvoke(self, _messages):
            payload = {"verdict": "pass", "score": 1.0, "reasons": [], "summary": ""}
            return FakeAIMessage(content=json.dumps(payload))

    await invoke_structured(SpyLLM(), "Evaluate fit json", FitFinding)
    assert len(bind_calls) == 1
    assert bind_calls[0].get("response_format") == {"type": "json_object"}


async def test_openai_does_not_bind_for_anthropic(monkeypatch):
    """Anthropic provider must NOT call bind() on the LLM."""
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    from app.llm import router as router_mod
    router_mod._reset_cache_for_tests()

    bind_called = False

    class SpyLLM:
        def bind(self, **_kw):
            nonlocal bind_called
            bind_called = True
            return self

        async def ainvoke(self, _messages):
            payload = {"verdict": "pass", "score": 1.0, "reasons": [], "summary": ""}
            return FakeAIMessage(content=json.dumps(payload))

    await invoke_structured(SpyLLM(), "check", FitFinding)
    assert not bind_called, "bind() must not be called for anthropic provider"


# ═══════════════════════════════════════════════════════════════════════════
# azure_openai router integration
# ═══════════════════════════════════════════════════════════════════════════

def test_current_provider_returns_azure_openai(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    from app.llm.router import current_provider
    assert current_provider() == "azure_openai"


def test_get_chat_model_azure_openai_uses_deployment_name(monkeypatch):
    from app.llm import router as router_mod
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/")
    monkeypatch.setenv("AZURE_API_KEY", "key123")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", "marketing-segmentation-deployment")
    with patch("langchain_openai.AzureChatOpenAI") as mock_az:
        router_mod.get_chat_model("fit_check")
        kwargs = mock_az.call_args.kwargs
        assert kwargs["azure_deployment"] == "marketing-segmentation-deployment"
        assert kwargs["azure_endpoint"] == "https://test.openai.azure.com/"
        assert "openai_api_version" in kwargs


def test_get_chat_model_azure_per_node_env_overrides_global(monkeypatch):
    from app.llm import router as router_mod
    from app.llm.config import NODE_MODEL_CONFIG
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/")
    monkeypatch.setenv("AZURE_API_KEY", "key123")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", "global-dep")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_VERDICT_SUMMARY", "verdict-dep")
    with patch("langchain_openai.AzureChatOpenAI") as mock_az:
        router_mod.get_chat_model("verdict_summary")
        assert mock_az.call_args.kwargs["azure_deployment"] == "verdict-dep"
    # Other nodes still use global
    router_mod._reset_cache_for_tests()
    with patch("langchain_openai.AzureChatOpenAI") as mock_az:
        router_mod.get_chat_model("fit_check")
        assert mock_az.call_args.kwargs["azure_deployment"] == "global-dep"


def test_get_chat_model_azure_falls_back_to_config_default(monkeypatch):
    from app.llm import router as router_mod
    from app.llm.config import NODE_MODEL_CONFIG
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/")
    monkeypatch.setenv("AZURE_API_KEY", "key123")
    monkeypatch.delenv("AZURE_OPENAI_DEPLOYMENT_NAME", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_DEPLOYMENT_FIT_CHECK", raising=False)
    with patch("langchain_openai.AzureChatOpenAI") as mock_az:
        router_mod.get_chat_model("fit_check")
        expected = NODE_MODEL_CONFIG["fit_check"]["azure_openai"]
        assert mock_az.call_args.kwargs["azure_deployment"] == expected


def test_get_chat_model_azure_raises_without_endpoint(monkeypatch):
    from app.llm import router as router_mod
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    monkeypatch.delenv("AZURE_OPENAI_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="AZURE_OPENAI_ENDPOINT"):
        router_mod.get_chat_model("fit_check")
