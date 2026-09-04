"""Shared runtime context and base classes for backend modules."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from config_loader import get_config, get_default_source, get_directory, get_supported_sources
from databricks_uc_io import uc_enabled


@dataclass(frozen=True)
class RuntimeContext:
    """Config-backed context shared by service and repository classes."""

    config: Mapping[str, Any]
    app_root: Path
    legacy_root: Path
    default_source: str
    supported_sources: Mapping[str, Any]
    data_source: str

    @classmethod
    def from_config(cls) -> "RuntimeContext":
        config = get_config()
        return cls(
            config=config,
            app_root=get_directory("app_root"),
            legacy_root=get_directory("legacy_root"),
            default_source=get_default_source(config),
            supported_sources=get_supported_sources(config),
            data_source="uc" if uc_enabled() else "local",
        )

    @property
    def supported_source_names(self) -> set[str]:
        return {str(source).strip().lower() for source in self.supported_sources}


class BaseModule:
    """Base class for config-aware backend modules."""

    def __init__(self, context: RuntimeContext | None = None) -> None:
        self.context = context or RuntimeContext.from_config()

    def normalize_source_system(self, value: Any, fallback: str | None = None) -> str:
        fallback_source = fallback or self.context.default_source
        candidate = str(value or "").strip().lower()
        return candidate if candidate in self.context.supported_source_names else fallback_source


class BaseService(BaseModule):
    """Base class for orchestration/service modules."""


class BaseRepository(BaseModule):
    """Base class for persistence/repository modules."""


class BaseDataProvider(BaseModule):
    """Base class for local/Unity Catalog data access providers."""

