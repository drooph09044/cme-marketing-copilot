"""Shared base classes for legacy pipeline step services."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class PipelineStepContext:
    """Config-backed runtime context for one legacy pipeline step."""

    source_systems: list[str]
    default_source_systems: list[str]


class LegacyPipelineService:
    """Base class for class-based legacy pipeline step orchestration."""

    def __init__(self, context: PipelineStepContext) -> None:
        self.context = context

    def get_selected_source_systems(self, raw_value: str) -> list[str]:
        selected = [source.strip().lower() for source in str(raw_value or "").split(",") if source.strip()]
        invalid = [source for source in selected if source not in self.context.source_systems]
        if invalid:
            raise ValueError(
                f"Invalid source system(s): {invalid}. Allowed: {self.context.source_systems}"
            )
        return selected if selected else list(self.context.default_source_systems)

    def run(self, selected_source_systems: Iterable[str]) -> None:
        raise NotImplementedError

