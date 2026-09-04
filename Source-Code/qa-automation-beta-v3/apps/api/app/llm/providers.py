"""Concrete provider factories. Imported lazily by `router.py`.

A `max_tokens` of 0 in the node config means "no cap". For OpenAI/Databricks
we simply omit the parameter so the model uses its full output budget. For
Anthropic — which requires `max_tokens` — we pass a generous 16K default that
is well above what any node needs but comfortably under each model's hard cap.
"""

from __future__ import annotations

import os
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel

from app.llm.config import NodeModelConfig

# Generous default for Anthropic when the node config says "no cap" (max_tokens=0).
# Well above any prompt we issue and within every Anthropic model's hard limit.
_ANTHROPIC_NO_CAP_DEFAULT = 16384


def build_anthropic(cfg: NodeModelConfig) -> BaseChatModel:
    try:
        from langchain_anthropic import ChatAnthropic  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError(
            "langchain-anthropic is not installed. "
            "Run: pip install -r requirements-anthropic.txt"
        ) from exc
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    max_tokens = cfg["max_tokens"] or _ANTHROPIC_NO_CAP_DEFAULT
    # Claude 4.x+ (opus-4-7, sonnet-4-6, haiku-4-5) deprecated the temperature
    # parameter — passing it returns HTTP 400. Use model defaults.
    return ChatAnthropic(
        model=cfg["anthropic"],
        max_tokens=max_tokens,
        api_key=api_key,
    )


def build_openai(cfg: NodeModelConfig) -> BaseChatModel:
    try:
        from langchain_openai import ChatOpenAI  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError(
            "langchain-openai is not installed. "
            "Run: pip install -r requirements-openai.txt"
        ) from exc
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    kwargs: dict[str, Any] = {
        "model": cfg["openai"],
        "temperature": cfg["temperature"],
        "api_key": api_key,
    }
    # Omit max_tokens entirely when 0 — model uses its full output budget.
    if cfg["max_tokens"]:
        kwargs["max_tokens"] = cfg["max_tokens"]
    return ChatOpenAI(**kwargs)


def build_azure_openai(cfg: NodeModelConfig, node: str = "") -> BaseChatModel:
    try:
        from langchain_openai import AzureChatOpenAI  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError(
            "langchain-openai is not installed. "
            "Run: pip install -r requirements-openai.txt"
        ) from exc
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = os.environ.get("AZURE_API_KEY")
    api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    # Deployment resolution order (most → least specific):
    #  1. AZURE_OPENAI_DEPLOYMENT_<NODE_UPPER>  e.g. AZURE_OPENAI_DEPLOYMENT_WALK_PROFILE
    #  2. AZURE_OPENAI_DEPLOYMENT_NAME          global override for all nodes
    #  3. cfg["azure_openai"]                   per-node default in config.py
    node_env_key = f"AZURE_OPENAI_DEPLOYMENT_{node.upper()}" if node else ""
    deployment = (
        (os.environ.get(node_env_key) if node_env_key else None)
        or os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME")
        or cfg["azure_openai"]
    )

    if not endpoint or not api_key:
        raise RuntimeError(
            "AZURE_OPENAI_ENDPOINT and AZURE_API_KEY must be set for MODEL_PROVIDER=azure_openai"
        )
    # Reasoning deployments (o1/o3/gpt-reasoning) can take 30-90s per call. A short
    # default timeout would cut them off and surface as errors. Generous + configurable.
    timeout = float(os.environ.get("AZURE_OPENAI_TIMEOUT", "180"))
    kwargs: dict[str, Any] = {
        "azure_endpoint": endpoint,
        "api_key": api_key,
        "azure_deployment": deployment,
        "openai_api_version": api_version,
        "temperature": cfg["temperature"],
        "timeout": timeout,
        # We run our own exponential-backoff retry in invoke_utils, so keep the
        # SDK's built-in retries modest to avoid compounding waits.
        "max_retries": 2,
    }
    if cfg["max_tokens"]:
        kwargs["max_tokens"] = cfg["max_tokens"]
    return AzureChatOpenAI(**kwargs)


def build_databricks(cfg: NodeModelConfig) -> BaseChatModel:
    try:
        from langchain_databricks import ChatDatabricks  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError(
            "langchain-databricks is not installed. "
            "Run: pip install -r requirements-databricks.txt"
        ) from exc
    host = os.environ.get("DATABRICKS_HOST")
    token = os.environ.get("DATABRICKS_TOKEN")
    if not host or not token:
        raise RuntimeError("DATABRICKS_HOST and DATABRICKS_TOKEN must be set")
    kwargs: dict[str, Any] = {
        "endpoint": cfg["databricks"],
        "temperature": cfg["temperature"],
    }
    if cfg["max_tokens"]:
        kwargs["max_tokens"] = cfg["max_tokens"]
    return ChatDatabricks(**kwargs)
