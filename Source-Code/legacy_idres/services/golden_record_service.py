"""Service orchestration for Step 5 golden record generation."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

from services.pipeline_base import LegacyPipelineService, PipelineStepContext


class GoldenRecordService(LegacyPipelineService):
    """Runs Step 5 golden record generation through a class-based service boundary."""

    def __init__(
        self,
        context: PipelineStepContext,
        ground_truth_path: str,
        abort_if_uc_runtime: Callable[[str], None],
        load_source_prefs: Callable[[], dict[str, Any]],
        load_ground_truth: Callable[[], dict[str, Any] | None],
        process_source_system: Callable[[str, dict[str, Any], dict[str, Any] | None], None],
    ) -> None:
        super().__init__(context)
        self.ground_truth_path = ground_truth_path
        self.abort_if_uc_runtime = abort_if_uc_runtime
        self.load_source_prefs = load_source_prefs
        self.load_ground_truth = load_ground_truth
        self.process_source_system = process_source_system

    def run(self, selected_source_systems: Iterable[str]) -> None:
        selected = list(selected_source_systems)
        self.abort_if_uc_runtime("step5_golden_record.py")

        print("=== Step 5: Golden Record / Superseded ID Merge ===\n")
        print(f"Selected source systems: {', '.join(selected)}\n")

        source_prefs = self.load_source_prefs()
        if source_prefs:
            print(f"Source preferences loaded: {len(source_prefs)} tags configured")
        else:
            print("No source preferences configured (using completeness-based selection)")

        ground_truth = self.load_ground_truth()
        if ground_truth is None:
            print(f"[INFO] {self.ground_truth_path} not found - evaluation sections will be skipped.")

        for source_system in selected:
            self.process_source_system(source_system, source_prefs, ground_truth)

        print("\n=== Golden record merge complete! ===")

