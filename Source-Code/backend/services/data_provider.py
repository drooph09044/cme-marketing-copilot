"""Local and Unity Catalog compatible data access provider."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from databricks_uc_io import (
    DatabricksDataAccessError,
    list_volume_json,
    pandas_read_csv,
    read_volume_text,
    uc_enabled,
    write_volume_text,
)
from services.base import BaseDataProvider, RuntimeContext


class RuntimeDataProvider(BaseDataProvider):
    """Reads and writes artifacts through the active runtime storage mode."""

    def __init__(self, context: RuntimeContext | None = None, uc_mode: bool | None = None) -> None:
        super().__init__(context)
        self._uc_mode = uc_mode

    @property
    def uc_mode(self) -> bool:
        return uc_enabled() if self._uc_mode is None else bool(self._uc_mode)

    def list_json_paths(self, directory: Path) -> Iterable[Path]:
        if self.uc_mode:
            return list_volume_json(str(directory))
        return sorted(Path(directory).glob("*.json"))

    def read_json(self, path: Path, default: Any = None) -> Any:
        if self.uc_mode:
            return json.loads(read_volume_text(str(path), required=True))
        try:
            return json.loads(Path(path).read_text(encoding="utf-8"))
        except FileNotFoundError:
            return default

    def read_json_with_local_fallback(self, path: Path, default: Any = None) -> Any:
        if self.uc_mode:
            try:
                return json.loads(read_volume_text(str(path), required=True))
            except (DatabricksDataAccessError, FileNotFoundError, OSError):
                # Configuration and demonstration reports are packaged with the
                # application. Keep them available when the optional UC Volume
                # mirror has not been provisioned yet.
                pass
        try:
            with Path(path).open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except FileNotFoundError:
            return default

    def write_json(self, path: Path, payload: Any) -> None:
        text = json.dumps(payload, indent=2)
        if self.uc_mode:
            write_volume_text(str(path), text, encoding="utf-8")
            return
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def read_csv(self, path_or_buffer: Any, *args: Any, **kwargs: Any):
        return pandas_read_csv(path_or_buffer, *args, **kwargs)
