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
    """Clear all test overrides. Call at the top of each test that uses get_chat_model."""
    _overrides.clear()


def set_override(node: str, model: Any) -> None:
    """Install a test double for a given node. Cleared by clear_overrides()."""
    _overrides[node] = model


def clear_overrides() -> None:
    """Remove all test doubles installed via set_override()."""
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
    if provider == "openai":
        return providers.build_openai(cfg)
    if provider == "azure_openai":
        return providers.build_azure_openai(cfg, node)
    if provider == "databricks":
        return providers.build_databricks(cfg)
    raise ValueError(
        f"Unsupported MODEL_PROVIDER={provider!r} "
        "(expected 'anthropic', 'openai', 'azure_openai', or 'databricks')"
    )
