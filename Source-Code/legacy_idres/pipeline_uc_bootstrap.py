"""Install Databricks UC compatibility for active IDR pipeline scripts."""

from __future__ import annotations

import builtins
import io
import os
import sys
import tempfile
import time
from pathlib import Path

from legacy_pipeline_config import all_source_systems, pipeline_directories, pipeline_directory


LEGACY_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = LEGACY_ROOT.parent
BACKEND_ROOT = PROJECT_ROOT / "backend"
DATA_DIR_MARKERS = set(pipeline_directories())
GENERATED_DATA_DIR = pipeline_directory("generated_data", "generated_data")
PREPROCESSED_DATA_DIR = pipeline_directory("preprocessed_data", "preprocessed_data")
STANDARDIZED_DATA_DIR = pipeline_directory("standardized_data", "standardized_data")
MATCHING_OUTPUT_DIR = pipeline_directory("matching_output", "matching_output")
CLUSTERING_OUTPUT_DIR = pipeline_directory("clustering_output", "clustering_output")
GOLDEN_RECORDS_OUTPUT_DIR = pipeline_directory("golden_records_output", "golden_records_output")
UC_FILESTYLE_IO_FLAG = "CODEX_ALLOW_UC_FILESTYLE_IO"
PIPELINE_CONTEXT_FLAG = "CODEX_IDENTITY_PIPELINE_CONTEXT"
_TRUE_VALUES = {"1", "true", "yes", "on"}


def _truthy(value: object) -> bool:
    return str(value or "").strip().lower() in _TRUE_VALUES


def _config_allows_uc_filestyle_io() -> bool:
    config_path = BACKEND_ROOT / "config.yaml"
    try:
        import yaml

        loaded = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    except Exception:
        return False
    databricks = loaded.get("databricks", {})
    if not isinstance(databricks, dict):
        return False
    return _truthy(databricks.get("allow_uc_filestyle_io"))


def uc_filestyle_io_enabled() -> bool:
    return _truthy(os.getenv(UC_FILESTYLE_IO_FLAG, "")) or _config_allows_uc_filestyle_io()


def abort_if_uc_runtime(script_name: str) -> None:
    if os.getenv("CODEX_DATA_SOURCE", "").strip().lower() == "uc" and not uc_filestyle_io_enabled():
        raise SystemExit(
            f"{script_name} is local-file based and is disabled when CODEX_DATA_SOURCE=uc. "
            f"Set {UC_FILESTYLE_IO_FLAG}=1 to run it through the UC compatibility layer."
        )


def _source_from_path(path_or_name: object) -> str | None:
    parts = [part.lower() for part in Path(path_or_name).parts]
    for source in all_source_systems():
        if source in parts:
            return source
    return None


def _logical_dataset_for_path(path_or_name: object) -> tuple[str, str | None] | None:
    path = Path(path_or_name)
    parts = [part.lower() for part in path.parts]
    name = path.stem.lower() if path.suffix.lower() == ".csv" else path.name.lower()
    source = _source_from_path(path)
    if PREPROCESSED_DATA_DIR in parts and name == "all_preprocessed":
        return "all_preprocessed", source
    if (
        PREPROCESSED_DATA_DIR in parts
        and path.suffix.lower() == ".csv"
        and name.startswith("preprocessed_")
    ):
        # Publish each source-scoped preprocessing output through the same
        # validated, atomic CSV staging path as the union artifact.  Falling
        # through to the generic compatibility writer emits hundreds of small
        # INSERT statements for larger source tables and can keep an App
        # request occupied for hours.
        return name, source
    if STANDARDIZED_DATA_DIR in parts and name == "all_standardized":
        return "all_standardized", source
    if (
        STANDARDIZED_DATA_DIR in parts
        and path.suffix.lower() == ".csv"
        and name.startswith("standardized_")
    ):
        return name, source
    if MATCHING_OUTPUT_DIR in parts and name == "enhanced_prepared_records":
        return "enhanced_prepared_records", source
    if MATCHING_OUTPUT_DIR in parts and name == "candidate_pairs":
        return "candidate_pairs", source
    if CLUSTERING_OUTPUT_DIR in parts and name == "clustered_records":
        return "clustered_records", source
    if GOLDEN_RECORDS_OUTPUT_DIR in parts and name == "golden_records":
        return "golden_records", source
    if GOLDEN_RECORDS_OUTPUT_DIR in parts and name == "superseded_ids":
        return "superseded_ids", source
    if (
        GOLDEN_RECORDS_OUTPUT_DIR in parts or CLUSTERING_OUTPUT_DIR in parts
    ) and name == "household_links":
        return "household_links", source
    if name == "customer_profile_export":
        return "customer_profile_export", source
    return None


def _is_pipeline_artifact(path_or_name: object) -> bool:
    parts = {part.lower() for part in Path(path_or_name).parts}
    return bool(parts & DATA_DIR_MARKERS) or Path(path_or_name).name.lower() in {
        "tag_mappings.json",
        "tag_mappings_cache.json",
        "source_preferences.json",
        "blocking_config.json",
    }


if os.getenv("CODEX_DATA_SOURCE", "uc").strip().lower() == "uc":
    # This module is imported only by identity-resolution batch steps. Mark the
    # child process explicitly so raw and per-source intermediate reads use the
    # pipeline ceiling while normal API requests retain the smaller UI ceiling.
    os.environ[PIPELINE_CONTEXT_FLAG] = "1"
    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))

    from databricks_uc_io import install_databricks_compat, write_table_csv_file

    install_databricks_compat(LEGACY_ROOT, extra_roots=(PROJECT_ROOT,))

    _original_open = builtins.open
    _original_exists = os.path.exists
    _original_getmtime = os.path.getmtime
    _original_makedirs = os.makedirs

    class _TableCsvWriteBuffer(io.TextIOBase):
        """Stream pipeline output to disk, then atomically publish it to UC."""

        def __init__(self, path_or_name: object, encoding: str, newline: str | None):
            super().__init__()
            self._path = path_or_name
            self._encoding = encoding
            file_descriptor, self._temp_path = tempfile.mkstemp(
                prefix="codex-idres-",
                suffix=".csv",
            )
            os.close(file_descriptor)
            self._stream = _original_open(
                self._temp_path,
                "w",
                encoding=encoding,
                newline=newline,
            )

        @property
        def encoding(self):
            return self._encoding

        def writable(self) -> bool:
            return True

        def write(self, value: str) -> int:
            return self._stream.write(value)

        def flush(self) -> None:
            if not self._stream.closed:
                self._stream.flush()

        def close(self) -> None:
            if self.closed:
                return
            try:
                self._stream.flush()
                self._stream.close()
                target = _logical_dataset_for_path(self._path)
                if target is not None:
                    logical_name, source = target
                    write_table_csv_file(
                        logical_name,
                        self._temp_path,
                        source=source,
                        mode="overwrite",
                        encoding=self._encoding,
                    )
            finally:
                try:
                    Path(self._temp_path).unlink(missing_ok=True)
                finally:
                    super().close()

    def _open(file, mode="r", buffering=-1, encoding=None, errors=None, newline=None, closefd=True, opener=None):
        if any(flag in mode for flag in ("w", "a", "x")) and _logical_dataset_for_path(file):
            return _TableCsvWriteBuffer(file, encoding or "utf-8", newline)
        return _original_open(file, mode, buffering, encoding, errors, newline, closefd, opener)

    def _exists(path) -> bool:
        if _logical_dataset_for_path(path):
            return True
        if _is_pipeline_artifact(path):
            return Path(path).exists()
        return _original_exists(path)

    def _getmtime(path) -> float:
        if _logical_dataset_for_path(path):
            return time.time()
        if _is_pipeline_artifact(path) and Path(path).exists():
            return time.time()
        return _original_getmtime(path)

    def _makedirs(name, mode=0o777, exist_ok=False):
        if _is_pipeline_artifact(name):
            return None
        return _original_makedirs(name, mode=mode, exist_ok=exist_ok)

    builtins.open = _open
    os.path.exists = _exists
    os.path.getmtime = _getmtime
    os.makedirs = _makedirs
