"""Logical dataset registry backed by backend/config.yaml.

This phase adds the registry without wiring it into runtime reads. The existing
Databricks compatibility layer remains the active resolver until a later phase.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from config_loader import ConfigError, get_databricks_schema, load_config
from tag_resolver import normalize_source, prefixes_for_source, supported_sources


@dataclass(frozen=True)
class DatasetRef:
    logical_name: str
    schema: str
    table: str
    source: str | None = None
    required: bool = True
    aliases: tuple[str, ...] = ()

    @property
    def key(self) -> str:
        return normalize_dataset_key(self.logical_name)


def normalize_dataset_key(value: object) -> str:
    text = str(value or "").replace("\\", "/").strip().lower()
    name = Path(text).name
    stem = name.rsplit(".", 1)[0]
    return re.sub(r"[^a-z0-9]+", "_", stem).strip("_")


def normalize_dataset_alias(value: object) -> str:
    text = str(value or "").replace("\\", "/").strip().lower()
    text = text.rsplit(".", 1)[0] if "." in Path(text).name else text
    return re.sub(r"[^a-z0-9/]+", "_", text).strip("_/")


def _aliases_for(entry: dict[str, Any], source: str | None = None) -> tuple[str, ...]:
    aliases = []
    for alias in entry.get("aliases", ()) or ():
        text = str(alias)
        if source:
            text = text.replace("{source}", source)
        aliases.append(text)
    return tuple(aliases)


def _append_ref(target: dict[str, list[DatasetRef]], key: str, ref: DatasetRef) -> None:
    if not key:
        return
    refs = target.setdefault(key, [])
    marker = (ref.schema, ref.table, ref.source)
    if marker not in {(item.schema, item.table, item.source) for item in refs}:
        refs.append(ref)


def _add_ref(index: dict[str, list[DatasetRef]], aliases: dict[str, list[DatasetRef]], ref: DatasetRef) -> None:
    for key in {ref.key, normalize_dataset_key(ref.table)}:
        _append_ref(index, key, ref)
    for alias in ref.aliases:
        alias_key = normalize_dataset_alias(alias)
        _append_ref(aliases, alias_key, ref)


def build_registry(config: dict[str, Any] | None = None) -> tuple[dict[str, list[DatasetRef]], dict[str, list[DatasetRef]]]:
    cfg = config or load_config()
    index: dict[str, list[DatasetRef]] = {}
    alias_index: dict[str, list[DatasetRef]] = {}
    datasets = cfg["datasets"]

    source_schema = datasets["marketing_sources"]["schema"]
    source_required = bool(datasets["marketing_sources"].get("required", True))
    for group_name, group_value in datasets["marketing_sources"]["tables"].items():
        if isinstance(group_value, dict) and "table" in group_value:
            ref = DatasetRef(
                logical_name=group_name,
                schema=source_schema,
                table=str(group_value["table"]),
                required=source_required,
                aliases=_aliases_for(group_value),
            )
            _add_ref(index, alias_index, ref)
            continue
        if isinstance(group_value, dict):
            source = group_name if group_name in supported_sources(cfg) else None
            for logical_name, entry in group_value.items():
                if not isinstance(entry, dict) or "table" not in entry:
                    continue
                ref = DatasetRef(
                    logical_name=logical_name,
                    schema=source_schema,
                    table=str(entry["table"]),
                    source=source,
                    required=source_required,
                    aliases=_aliases_for(entry, source=source),
                )
                _add_ref(index, alias_index, ref)

    cdp = datasets["marketing_cdp"]
    cdp_schema = cdp["schema"]
    cdp_required = bool(cdp.get("required", True))
    for source in supported_sources(cfg):
        normalized_source = normalize_source(source, config=cfg)
        prefixes = prefixes_for_source(normalized_source, config=cfg)
        prefix = prefixes[0] if prefixes else normalized_source
        for logical_name, entry in cdp.get("source_scoped_tables", {}).items():
            table = str(entry["table_pattern"]).format(source=normalized_source, prefix=prefix)
            ref = DatasetRef(
                logical_name=logical_name,
                schema=cdp_schema,
                table=table,
                source=normalized_source,
                required=cdp_required,
                aliases=_aliases_for(entry, source=normalized_source),
            )
            _add_ref(index, alias_index, ref)

    for logical_name, entry in cdp.get("generated_tables", {}).items():
        ref = DatasetRef(
            logical_name=logical_name,
            schema=cdp_schema,
            table=str(entry["table"]),
            required=cdp_required,
            aliases=_aliases_for(entry),
        )
        _add_ref(index, alias_index, ref)

    for section_name in ("marketing_copilot", "marketing_audit"):
        section = datasets.get(section_name, {})
        schema = section.get("schema")
        if not schema:
            continue
        required = bool(section.get("required", False))
        for logical_name, entry in section.get("tables", {}).items():
            if not isinstance(entry, dict) or "table" not in entry:
                continue
            ref = DatasetRef(
                logical_name=logical_name,
                schema=str(schema),
                table=str(entry["table"]),
                required=required,
                aliases=_aliases_for(entry),
            )
            _add_ref(index, alias_index, ref)

    return index, alias_index


class DataRegistry:
    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or load_config()
        self._index, self._alias_index = build_registry(self.config)

    def get(self, logical_name: object, source: str | None = None, required: bool = True) -> DatasetRef | None:
        alias_key = normalize_dataset_alias(logical_name)
        key = normalize_dataset_key(logical_name)
        candidates = []
        if alias_key in self._alias_index:
            candidates.extend(self._alias_index[alias_key])
        # A deployed source path can retain a legacy basename even when the
        # governed UC table has a source prefix.  For example,
        # ``generated_data/media/app_events.csv`` must resolve through the
        # configured ``app_events`` alias to ``marketing_sources.med_app_events``.
        # Looking up the basename alias before any discovery fallback also
        # prevents unrelated ``app_events`` tables in CDP/Copilot schemas from
        # making the read ambiguous.
        if key in self._alias_index:
            candidates.extend(self._alias_index[key])
        if key in self._index:
            candidates.extend(self._index[key])
        if not candidates:
            if required:
                raise ConfigError(f"Unknown logical dataset: {logical_name}")
            return None
        if source:
            normalized_source = normalize_source(source, config=self.config)
            source_specific = [ref for ref in candidates if ref.source == normalized_source]
            generic = [ref for ref in candidates if ref.source is None]
            if source_specific:
                candidates = source_specific
            elif generic:
                candidates = generic
        return candidates[0]

    def all(self) -> tuple[DatasetRef, ...]:
        seen = set()
        refs = []
        for index_refs in self._index.values():
            for ref in index_refs:
                marker = (ref.schema, ref.table, ref.source)
                if marker in seen:
                    continue
                seen.add(marker)
                refs.append(ref)
        return tuple(refs)

    def schema_for_kind(self, kind: str) -> str:
        return get_databricks_schema(kind, self.config)


def get_registry(config: dict[str, Any] | None = None) -> DataRegistry:
    return DataRegistry(config=config)
