from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock, patch

import pytest

from app.llm import router as router_mod
from app.llm.config import NODE_MODEL_CONFIG


def test_node_model_config_covers_all_nodes():
    expected = {"fit_check", "structure_check", "profile_synth", "walk_profile", "verdict_summary"}
    assert expected.issubset(NODE_MODEL_CONFIG.keys())
    for cfg in NODE_MODEL_CONFIG.values():
        assert "anthropic" in cfg and "databricks" in cfg
        assert "openai" in cfg and "azure_openai" in cfg
        assert "temperature" in cfg and "max_tokens" in cfg


def test_router_selects_anthropic_by_default(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    with patch("langchain_anthropic.ChatAnthropic") as mock_anthropic:
        router_mod.get_chat_model("fit_check")
        mock_anthropic.assert_called_once()
        kwargs = mock_anthropic.call_args.kwargs
        assert kwargs["model"] == NODE_MODEL_CONFIG["fit_check"]["anthropic"]
        # Claude 4.x deprecated temperature — it must NOT be passed to the API.
        assert "temperature" not in kwargs


def test_router_switches_to_databricks(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "databricks")
    monkeypatch.setenv("DATABRICKS_HOST", "https://x.databricks.com")
    monkeypatch.setenv("DATABRICKS_TOKEN", "dapi-test")

    mock_db_cls = MagicMock()
    fake_module = types.ModuleType("langchain_databricks")
    fake_module.ChatDatabricks = mock_db_cls  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "langchain_databricks", fake_module)

    router_mod.get_chat_model("walk_profile")
    mock_db_cls.assert_called_once()
    kwargs = mock_db_cls.call_args.kwargs
    assert kwargs["endpoint"] == NODE_MODEL_CONFIG["walk_profile"]["databricks"]


def test_router_raises_for_unknown_node(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    with pytest.raises(KeyError):
        router_mod.get_chat_model("nonexistent_node")


def test_router_selects_openai(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    with patch("langchain_openai.ChatOpenAI") as mock_oai:
        router_mod.get_chat_model("fit_check")
        mock_oai.assert_called_once()
        kwargs = mock_oai.call_args.kwargs
        assert kwargs["model"] == NODE_MODEL_CONFIG["fit_check"]["openai"]
        assert kwargs["temperature"] == NODE_MODEL_CONFIG["fit_check"]["temperature"]


def test_router_selects_azure_openai(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/")
    monkeypatch.setenv("AZURE_API_KEY", "azure-test-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", "marketing-segmentation-deployment")
    monkeypatch.setenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
    with patch("langchain_openai.AzureChatOpenAI") as mock_az:
        router_mod.get_chat_model("fit_check")
        mock_az.assert_called_once()
        kwargs = mock_az.call_args.kwargs
        assert kwargs["azure_deployment"] == "marketing-segmentation-deployment"
        assert kwargs["azure_endpoint"] == "https://test.openai.azure.com/"
        assert kwargs["openai_api_version"] == "2024-12-01-preview"
        assert kwargs["temperature"] == NODE_MODEL_CONFIG["fit_check"]["temperature"]


def test_azure_openai_deployment_name_overrides_config(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/")
    monkeypatch.setenv("AZURE_API_KEY", "azure-test-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", "my-custom-deployment")
    monkeypatch.delenv("AZURE_OPENAI_DEPLOYMENT_FIT_CHECK", raising=False)
    with patch("langchain_openai.AzureChatOpenAI") as mock_az:
        router_mod.get_chat_model("fit_check")
        kwargs = mock_az.call_args.kwargs
        assert kwargs["azure_deployment"] == "my-custom-deployment"


def test_azure_openai_per_node_deployment_overrides_global(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/")
    monkeypatch.setenv("AZURE_API_KEY", "azure-test-key")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", "global-deployment")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_FIT_CHECK", "fit-check-specific-deployment")
    with patch("langchain_openai.AzureChatOpenAI") as mock_az:
        router_mod.get_chat_model("fit_check")
        kwargs = mock_az.call_args.kwargs
        assert kwargs["azure_deployment"] == "fit-check-specific-deployment"
    # Other nodes still use global
    router_mod._reset_cache_for_tests()
    with patch("langchain_openai.AzureChatOpenAI") as mock_az:
        router_mod.get_chat_model("walk_profile")
        kwargs = mock_az.call_args.kwargs
        assert kwargs["azure_deployment"] == "global-deployment"


def test_azure_openai_raises_without_credentials(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "azure_openai")
    monkeypatch.delenv("AZURE_OPENAI_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="AZURE_OPENAI_ENDPOINT and AZURE_API_KEY"):
        router_mod.get_chat_model("fit_check")


def test_router_raises_for_unknown_provider(monkeypatch):
    router_mod._reset_cache_for_tests()
    monkeypatch.setenv("MODEL_PROVIDER", "cohere")
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
