"""Config-backed legacy pipeline mappings.

The legacy step scripts keep their standalone algorithms, but source-system,
file, prefix, blocking, and account-id mappings live in backend/config.yaml.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "backend" / "config.yaml"


@lru_cache(maxsize=1)
def load_backend_config() -> dict[str, Any]:
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def legacy_pipeline_config() -> dict[str, Any]:
    return dict(load_backend_config().get("legacy_pipeline") or {})


def default_source_systems() -> list[str]:
    return list(legacy_pipeline_config().get("default_source_systems") or [])


def household_source_systems() -> list[str]:
    configured = legacy_pipeline_config().get("household_source_systems")
    return list(configured or default_source_systems())


def source_systems() -> list[str]:
    return default_source_systems()


def all_source_systems() -> list[str]:
    ordered: list[str] = []
    for source in default_source_systems() + household_source_systems():
        if source not in ordered:
            ordered.append(source)
    return ordered


def source_file_map(stage: str) -> dict[str, dict[str, list[str]]]:
    key = {
        "semantic": "semantic_source_files",
        "preprocessing": "preprocessing_source_files",
    }.get(stage, stage)
    raw = legacy_pipeline_config().get(key) or {}
    return {
        str(system): {
            str(name): [str(alias) for alias in aliases]
            for name, aliases in dict(files or {}).items()
        }
        for system, files in dict(raw).items()
    }


def standardization_source_files() -> dict[str, list[str]]:
    raw = legacy_pipeline_config().get("standardization_source_files") or {}
    return {
        str(system): [str(item) for item in files or []]
        for system, files in dict(raw).items()
    }


def source_prefixes() -> dict[str, str]:
    configured = legacy_pipeline_config().get("source_volume_prefixes") or {}
    if configured:
        return {str(source): str(prefix) for source, prefix in dict(configured).items()}

    supported = ((load_backend_config().get("sources") or {}).get("supported") or {})
    prefixes: dict[str, str] = {}
    for source, metadata in dict(supported).items():
        values = list((metadata or {}).get("prefixes") or [])
        if values:
            prefixes[str(source)] = str(values[0])
    return prefixes


def source_prefix(source_system: str) -> str:
    source_system = str(source_system)
    return source_prefixes().get(source_system, source_system)


def pipeline_directory(name: str, default: str) -> str:
    directories = legacy_pipeline_config().get("directories") or {}
    return str(dict(directories).get(name) or default)


def pipeline_directories() -> list[str]:
    directories = legacy_pipeline_config().get("directories") or {}
    return [str(value) for value in dict(directories).values()]


def column_aliases(source_system: str) -> dict[str, str]:
    aliases = legacy_pipeline_config().get("column_aliases") or {}
    return {
        str(source): str(target)
        for source, target in dict(dict(aliases).get(source_system) or {}).items()
    }


def tag_mapping_aliases() -> dict[str, str]:
    aliases = legacy_pipeline_config().get("tag_mapping_aliases") or {}
    return {str(source): str(target) for source, target in dict(aliases).items()}


def account_id_fields(source_system: str | None = None) -> list[str]:
    golden = legacy_pipeline_config().get("golden_record") or {}
    configured = golden.get("account_id_fields") or {}
    if source_system:
        return [str(item) for item in dict(configured).get(source_system, []) or []]
    fields: list[str] = []
    for values in dict(configured).values():
        for item in values or []:
            text = str(item)
            if text not in fields:
                fields.append(text)
    return fields


def blocking_rules(source_system: str) -> list[dict[str, Any]]:
    blocking = legacy_pipeline_config().get("blocking") or {}
    configured = ((blocking.get("source_rules") or {}).get(source_system) or [])
    return [dict(item) for item in configured]


def blocking_tag_defaults() -> dict[str, dict[str, Any]]:
    blocking = legacy_pipeline_config().get("blocking") or {}
    return {
        str(tag): dict(values or {})
        for tag, values in dict(blocking.get("tag_defaults") or {}).items()
    }

