"""Configuration loading and validation helpers for Databricks metadata.

This module is intentionally standalone in this phase. Runtime code can import
it in a later phase after the config shape has been validated.
"""

from __future__ import annotations

import os
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


class ConfigError(RuntimeError):
    """Raised when backend/config.yaml is missing or invalid."""


DEFAULT_CONFIG_PATH = Path(__file__).resolve().with_name("config.yaml")
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PATHS_CONFIG_PATH = PROJECT_ROOT / "config" / "paths.yml"

REQUIRED_TOP_LEVEL_KEYS = (
    "version",
    "databricks",
    "sources",
    "table_resolution",
    "datasets",
    "artifacts",
    "columns",
    "events",
    "ajo",
)

REQUIRED_SCHEMA_KEYS = ("sources", "cdp", "copilot", "audit")


def _require_mapping(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ConfigError(f"Config section '{path}' must be a mapping.")
    return value


def _require_non_empty_string(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"Config value '{path}' must be a non-empty string.")
    return value.strip()


def _config_path(path: str | os.PathLike[str] | None = None) -> Path:
    return Path(path).resolve() if path is not None else DEFAULT_CONFIG_PATH


def validate_config(config: dict[str, Any]) -> None:
    """Validate required config sections without enforcing every dataset entry."""
    _require_mapping(config, "root")

    missing = [key for key in REQUIRED_TOP_LEVEL_KEYS if key not in config]
    if missing:
        raise ConfigError(f"Missing required config sections: {', '.join(missing)}")

    databricks = _require_mapping(config["databricks"], "databricks")
    _require_non_empty_string(databricks.get("catalog"), "databricks.catalog")

    schemas = _require_mapping(databricks.get("schemas"), "databricks.schemas")
    missing_schemas = [key for key in REQUIRED_SCHEMA_KEYS if key not in schemas]
    if missing_schemas:
        raise ConfigError(f"Missing Databricks schema keys: {', '.join(missing_schemas)}")
    for key in REQUIRED_SCHEMA_KEYS:
        _require_non_empty_string(schemas.get(key), f"databricks.schemas.{key}")

    volumes = _require_mapping(databricks.get("volumes"), "databricks.volumes")
    _require_non_empty_string(volumes.get("root"), "databricks.volumes.root")
    _require_non_empty_string(volumes.get("output_root"), "databricks.volumes.output_root")

    sources = _require_mapping(config["sources"], "sources")
    default_source = _require_non_empty_string(sources.get("default"), "sources.default")
    supported_sources = _require_mapping(sources.get("supported"), "sources.supported")
    if default_source not in supported_sources:
        raise ConfigError(f"sources.default '{default_source}' is not listed in sources.supported.")

    datasets = _require_mapping(config["datasets"], "datasets")
    for schema_name in ("marketing_sources", "marketing_cdp"):
        section = _require_mapping(datasets.get(schema_name), f"datasets.{schema_name}")
        _require_non_empty_string(section.get("schema"), f"datasets.{schema_name}.schema")

    artifacts = _require_mapping(config["artifacts"], "artifacts")
    _require_mapping(artifacts.get("volume_files"), "artifacts.volume_files")


@lru_cache(maxsize=4)
def load_config(path: str | os.PathLike[str] | None = None) -> dict[str, Any]:
    """Load and validate backend config from YAML."""
    config_path = _config_path(path)
    if not config_path.exists():
        raise ConfigError(f"Config file not found: {config_path}")
    try:
        loaded = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise ConfigError(f"Invalid YAML in {config_path}: {exc}") from exc
    config = _require_mapping(loaded, str(config_path))
    validate_config(config)
    return config


def reload_config(path: str | os.PathLike[str] | None = None) -> dict[str, Any]:
    """Clear the config cache and reload from disk."""
    load_config.cache_clear()
    return load_config(path)


def get_config(path: str | os.PathLike[str] | None = None) -> dict[str, Any]:
    """Return a defensive copy of the loaded config."""
    return deepcopy(load_config(path))


def get_databricks_catalog(config: dict[str, Any] | None = None) -> str:
    cfg = config or load_config()
    return str(cfg["databricks"]["catalog"])


def get_databricks_schema(kind: str, config: dict[str, Any] | None = None) -> str:
    cfg = config or load_config()
    schemas = cfg["databricks"]["schemas"]
    if kind not in schemas:
        raise ConfigError(f"Unknown Databricks schema kind: {kind}")
    return str(schemas[kind])


def get_databricks_volume_root(config: dict[str, Any] | None = None) -> str:
    cfg = config or load_config()
    return str(cfg["databricks"]["volumes"]["root"])


def get_databricks_output_volume_root(config: dict[str, Any] | None = None) -> str:
    cfg = config or load_config()
    return str(cfg["databricks"]["volumes"]["output_root"])


def get_supported_sources(config: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = config or load_config()
    return deepcopy(cfg["sources"]["supported"])


def get_default_source(config: dict[str, Any] | None = None) -> str:
    cfg = config or load_config()
    return str(cfg["sources"]["default"])


@lru_cache(maxsize=4)
def load_paths_config(path: str | os.PathLike[str] | None = None) -> dict[str, Any]:
    """Load centralized file/directory mappings."""
    config_path = Path(path).resolve() if path is not None else DEFAULT_PATHS_CONFIG_PATH
    if not config_path.exists():
        raise ConfigError(f"Paths config file not found: {config_path}")
    try:
        loaded = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise ConfigError(f"Invalid YAML in {config_path}: {exc}") from exc
    return _require_mapping(loaded, str(config_path))


def _resolve_path_root(root_name: str, paths_config: dict[str, Any]) -> Path:
    roots = _require_mapping(paths_config.get("roots"), "paths.roots")
    if root_name not in roots:
        raise ConfigError(f"Unknown path root alias: {root_name}")
    root_value = str(roots[root_name] or ".")
    return (PROJECT_ROOT / root_value).resolve()


def get_directory(name: str, paths_config: dict[str, Any] | None = None) -> Path:
    """Return a configured directory path."""
    cfg = paths_config or load_paths_config()
    directories = _require_mapping(cfg.get("directories"), "paths.directories")
    entry = _require_mapping(directories.get(name), f"paths.directories.{name}")
    root = _resolve_path_root(str(entry.get("root", "app_root")), cfg)
    return (root / str(entry.get("path", "."))).resolve()


def get_path(name: str, paths_config: dict[str, Any] | None = None) -> Path:
    """Return a configured file/artifact path."""
    cfg = paths_config or load_paths_config()
    paths = _require_mapping(cfg.get("paths"), "paths.paths")
    entry = _require_mapping(paths.get(name), f"paths.paths.{name}")
    root = _resolve_path_root(str(entry.get("root", "app_root")), cfg)
    return (root / str(entry.get("file", ""))).resolve()


def get_dynamic_path(name: str, paths_config: dict[str, Any] | None = None, **values: Any) -> Path:
    """Return a path from a configured directory + format pattern."""
    cfg = paths_config or load_paths_config()
    patterns = _require_mapping(cfg.get("dynamic_patterns"), "paths.dynamic_patterns")
    entry = _require_mapping(patterns.get(name), f"paths.dynamic_patterns.{name}")
    directory = get_directory(str(entry["directory"]), cfg)
    pattern = str(entry["pattern"]).format(**values)
    return (directory / pattern).resolve()

