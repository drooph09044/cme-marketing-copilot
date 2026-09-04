"""Repository classes that isolate artifact persistence from route code."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

from services.base import BaseRepository, RuntimeContext
from services.data_provider import RuntimeDataProvider


class ArtifactRepository(BaseRepository):
    """Repository for JSON and CSV-like runtime artifacts."""

    def __init__(
        self,
        context: RuntimeContext | None = None,
        data_provider: RuntimeDataProvider | None = None,
    ) -> None:
        super().__init__(context)
        self.data_provider = data_provider or RuntimeDataProvider(self.context)

    def list_json(self, directory: Path) -> Iterable[Path]:
        return self.data_provider.list_json_paths(directory)

    def read_json(self, path: Path, default: Any = None) -> Any:
        return self.data_provider.read_json(path, default=default)

    def read_json_with_local_fallback(self, path: Path, default: Any = None) -> Any:
        return self.data_provider.read_json_with_local_fallback(path, default=default)

    def write_json(self, path: Path, payload: Any) -> None:
        self.data_provider.write_json(path, payload)

    def read_csv(self, path_or_buffer: Any, *args: Any, **kwargs: Any):
        return self.data_provider.read_csv(path_or_buffer, *args, **kwargs)

