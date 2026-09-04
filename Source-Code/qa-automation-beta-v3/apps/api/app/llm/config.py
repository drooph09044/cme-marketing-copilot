"""Per-node model preferences for the LLM router.

Each key is a LangGraph node name. Each value provides a model identifier
per provider plus sampling params. Add a node here BEFORE calling
`get_chat_model(node)` from a new node.

`max_tokens = 0` (or omitted) means "no cap" — the provider receives no
max_tokens parameter and the model uses its full output budget.
"""

from __future__ import annotations

from typing import TypedDict


class NodeModelConfig(TypedDict):
    anthropic: str
    databricks: str
    openai: str
    azure_openai: str  # deployment name (overridden by AZURE_OPENAI_DEPLOYMENT_NAME env var)
    temperature: float
    max_tokens: int  # 0 = no cap


NODE_MODEL_CONFIG: dict[str, NodeModelConfig] = {
    "fit_check": {
        "anthropic": "claude-opus-4-7",
        "databricks": "databricks-dbrx-instruct",
        "openai": "gpt-4o",
        "azure_openai": "marketing-segmentation-deployment",
        "temperature": 0.2,
        "max_tokens": 0,
    },
    "structure_check": {
        "anthropic": "claude-sonnet-4-6",
        "databricks": "databricks-meta-llama-3-1-70b-instruct",
        "openai": "gpt-4o-mini",
        "azure_openai": "marketing-segmentation-deployment",
        "temperature": 0.1,
        "max_tokens": 0,
    },
    "profile_synth": {
        "anthropic": "claude-sonnet-4-6",
        "databricks": "databricks-meta-llama-3-1-70b-instruct",
        "openai": "gpt-4o-mini",
        "azure_openai": "marketing-segmentation-deployment",
        "temperature": 0.7,
        "max_tokens": 0,
    },
    "walk_profile": {
        "anthropic": "claude-haiku-4-5-20251001",
        "databricks": "databricks-meta-llama-3-1-8b-instruct",
        "openai": "gpt-4o-mini",
        "azure_openai": "marketing-segmentation-deployment",
        "temperature": 0.1,
        "max_tokens": 0,
    },
    "verdict_summary": {
        "anthropic": "claude-opus-4-7",
        "databricks": "databricks-dbrx-instruct",
        "openai": "gpt-4o",
        "azure_openai": "marketing-segmentation-deployment",
        "temperature": 0.3,
        "max_tokens": 0,
    },
}
