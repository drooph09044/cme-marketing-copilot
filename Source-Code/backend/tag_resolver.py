"""Source and tag resolution helpers backed by backend/config.yaml.

This module is standalone in this phase. Runtime code can adopt it later after
smoke tests confirm parity with the existing hardcoded source maps.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from config_loader import ConfigError, load_config


def _normalize_token(value: object) -> str:
    return str(value or "").strip().lower()


def _source_config(config: dict[str, Any] | None = None) -> dict[str, Any]:
    cfg = config or load_config()
    return cfg["sources"]


def supported_sources(config: dict[str, Any] | None = None) -> tuple[str, ...]:
    sources = _source_config(config)["supported"]
    return tuple(sources.keys())


def default_source(config: dict[str, Any] | None = None) -> str:
    return str(_source_config(config)["default"])


def source_labels(config: dict[str, Any] | None = None) -> dict[str, str]:
    sources = _source_config(config)["supported"]
    return {source: str(meta.get("label") or source) for source, meta in sources.items()}


def source_prefixes(config: dict[str, Any] | None = None) -> dict[str, tuple[str, ...]]:
    sources = _source_config(config)["supported"]
    return {
        source: tuple(str(prefix).lower() for prefix in meta.get("prefixes", ()))
        for source, meta in sources.items()
    }


def source_aliases(config: dict[str, Any] | None = None) -> dict[str, tuple[str, ...]]:
    sources = _source_config(config)["supported"]
    return {
        source: tuple(str(alias).lower() for alias in meta.get("aliases", ()))
        for source, meta in sources.items()
    }


def normalize_source(
    value: object,
    fallback: str | None = None,
    config: dict[str, Any] | None = None,
) -> str:
    sources = _source_config(config)["supported"]
    candidate = _normalize_token(value)
    if not candidate:
        return fallback or default_source(config)
    if candidate in sources:
        return candidate
    for source, meta in sources.items():
        aliases = {_normalize_token(alias) for alias in meta.get("aliases", ())}
        prefixes = {_normalize_token(prefix) for prefix in meta.get("prefixes", ())}
        if candidate in aliases or candidate in prefixes:
            return source
    if fallback is not None:
        return fallback
    return default_source(config)


def source_label(source: object, config: dict[str, Any] | None = None) -> str:
    normalized = normalize_source(source, config=config)
    return source_labels(config).get(normalized, normalized)


def infer_source_from_name(
    path_or_name: object,
    explicit_source: str | None = None,
    config: dict[str, Any] | None = None,
) -> str | None:
    if explicit_source:
        return normalize_source(explicit_source, config=config)

    text = str(path_or_name or "").replace("\\", "/").lower()
    parts = [part for part in text.split("/") if part]
    stem = Path(text).name.rsplit(".", 1)[0]

    for source, prefixes in source_prefixes(config).items():
        if source in parts:
            return source
        if any(stem.startswith(prefix + "_") for prefix in prefixes):
            return source
    for source, aliases in source_aliases(config).items():
        if any(alias in parts for alias in aliases):
            return source
    return None


def prefixes_for_source(source: object, config: dict[str, Any] | None = None) -> tuple[str, ...]:
    normalized = normalize_source(source, config=config)
    prefixes = source_prefixes(config)
    if normalized not in prefixes:
        raise ConfigError(f"Unknown source system: {source}")
    return prefixes[normalized]

