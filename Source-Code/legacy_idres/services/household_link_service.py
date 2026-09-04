"""Service orchestration for household link generation."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from pathlib import Path

from services.pipeline_base import LegacyPipelineService, PipelineStepContext


class HouseholdLinkService(LegacyPipelineService):
    """Runs household link generation through a class-based service boundary."""

    def __init__(
        self,
        context: PipelineStepContext,
        abort_if_uc_runtime: Callable[[str], None],
        uc_mode: Callable[[], bool],
        source_paths: Callable[[str], tuple[Path, Path]],
        build_household_links: Callable[[Path, Path], tuple[int, int]],
        default_golden_csv: Path,
        default_household_csv: Path,
    ) -> None:
        super().__init__(context)
        self.abort_if_uc_runtime = abort_if_uc_runtime
        self.uc_mode = uc_mode
        self.source_paths = source_paths
        self.build_household_links = build_household_links
        self.default_golden_csv = default_golden_csv
        self.default_household_csv = default_household_csv

    def run(self, selected_source_systems: Iterable[str]) -> None:
        selected = list(selected_source_systems)
        self.abort_if_uc_runtime("generate_household_links.py")

        if not selected and self.uc_mode():
            selected = list(self.context.default_source_systems)

        if selected:
            for source_system in selected:
                golden_path, household_path = self.source_paths(source_system)
                print(f"=== Household links: {source_system} ===")
                self.build_household_links(golden_path, household_path)
            return

        self.build_household_links(self.default_golden_csv, self.default_household_csv)

