"""YAML-backed payload/template configuration loader."""

from __future__ import annotations

import copy
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parent.parent
PAYLOAD_CONFIG_DIR = ROOT / "config" / "payloads"
_ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


class PayloadConfigError(RuntimeError):
    """Raised when a payload configuration file is missing or invalid."""


def _payload_path(name: str) -> Path:
    return PAYLOAD_CONFIG_DIR / name


def _resolve_env_placeholders(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _resolve_env_placeholders(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_resolve_env_placeholders(item) for item in value]
    if isinstance(value, str):
        return _ENV_PATTERN.sub(lambda match: os.getenv(match.group(1), ""), value)
    return value


@lru_cache(maxsize=16)
def load_payload_config(name: str) -> dict[str, Any]:
    """Load one payload YAML file from ``config/payloads``."""
    path = _payload_path(name)
    if not path.exists():
        raise PayloadConfigError(f"Payload config not found: {path}")
    try:
        loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise PayloadConfigError(f"Invalid YAML in {path}: {exc}") from exc
    if not isinstance(loaded, dict):
        raise PayloadConfigError(f"Payload config must be a mapping: {path}")
    return loaded


def get_ajo_config() -> dict[str, Any]:
    return copy.deepcopy(load_payload_config("ajo_payloads.yml").get("ajo", {}))


def get_payload_value(file_name: str, section: str, key: str, default: Any = None) -> Any:
    payload = load_payload_config(file_name)
    section_value = payload.get(section, {})
    if not isinstance(section_value, dict):
        raise PayloadConfigError(f"{file_name}: section '{section}' must be a mapping")
    return copy.deepcopy(section_value.get(key, default))


def get_ajo_default(key: str, default: Any = "") -> Any:
    defaults = get_ajo_config().get("defaults", {})
    return defaults.get(key, default)


def get_ajo_env_value(key: str) -> str:
    env_names = get_ajo_default(key, [])
    if isinstance(env_names, str):
        env_names = [env_names]
    for name in env_names:
        value = os.getenv(str(name), "")
        if value:
            return value
    return ""


def get_ajo_api_key(source_system: str) -> str:
    env_map = get_ajo_default("api_key_env", {})
    env_name = env_map.get(source_system, "") if isinstance(env_map, dict) else ""
    return os.getenv(str(env_name), "") if env_name else ""


def get_ajo_payload(source_system: str) -> dict[str, Any]:
    payloads = get_ajo_config().get("payloads", {})
    key = source_system if source_system in payloads else "automotive"
    payload = payloads.get(key)
    if not isinstance(payload, dict):
        raise PayloadConfigError(f"AJO payload missing or invalid for source: {key}")
    return _resolve_env_placeholders(copy.deepcopy(payload))


def get_prebuilt_segments() -> list[dict[str, Any]]:
    segments = load_payload_config("segments.yml").get("prebuilt_segments", [])
    if not isinstance(segments, list):
        raise PayloadConfigError("segments.yml: prebuilt_segments must be a list")
    return copy.deepcopy(segments)


def get_journey_templates() -> dict[str, Any]:
    templates = load_payload_config("journeys.yml").get("journey_templates", {})
    if not isinstance(templates, dict):
        raise PayloadConfigError("journeys.yml: journey_templates must be a mapping")
    return copy.deepcopy(templates)

