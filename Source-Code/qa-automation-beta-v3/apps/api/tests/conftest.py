"""Shared pytest fixtures: a tiny stub chat model for QA-node tests."""

from __future__ import annotations

from typing import Any

import pytest

from app.llm import router as router_mod


class StubStructuredModel:
    """Returns a pre-set Pydantic object from `.invoke()` / `.ainvoke()` regardless of input.

    `.bind()` returns self so that `invoke_structured`'s json_mode path works:
    `llm.bind(response_format=...).ainvoke(...)` still returns the stubbed response.
    """

    def __init__(self, response: Any) -> None:
        self._response = response

    def bind(self, **_kwargs: Any) -> "StubStructuredModel":
        return self

    def with_structured_output(self, _schema: Any, **_kwargs: Any) -> "StubStructuredModel":
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
