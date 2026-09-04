"""Service orchestration for Step 3 blocking and matching."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

from services.pipeline_base import LegacyPipelineService, PipelineStepContext


class MatchingService(LegacyPipelineService):
    """Runs Step 3 matching through a class-based service boundary."""

    def __init__(
        self,
        context: PipelineStepContext,
        config_file: str,
        path_exists: Callable[[str], bool],
        load_config: Callable[[], dict[str, Any]],
        process_source_system: Callable[[str, dict[str, Any]], None],
    ) -> None:
        super().__init__(context)
        self.config_file = config_file
        self.path_exists = path_exists
        self.load_config = load_config
        self.process_source_system = process_source_system

    def run(self, selected_source_systems: Iterable[str]) -> None:
        selected = list(selected_source_systems)

        print("=== Step 3: Blocking & Matching ===\n")
        print(f"Selected source systems: {', '.join(selected)}\n")

        if not self.path_exists(self.config_file):
            print(f"ERROR: {self.config_file} not found.")
            return

        config = self.load_config()

        for source_system in selected:
            self.process_source_system(source_system, config)

