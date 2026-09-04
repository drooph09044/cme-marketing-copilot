"""Service orchestration for Step 2 preprocessing."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

from services.pipeline_base import LegacyPipelineService, PipelineStepContext


class PreprocessingService(LegacyPipelineService):
    """Runs Step 2 preprocessing through a class-based service boundary."""

    def __init__(
        self,
        context: PipelineStepContext,
        tag_mappings_file: str,
        output_dir: str,
        abort_if_uc_runtime: Callable[[str], None],
        path_exists: Callable[[str], bool],
        load_json: Callable[[str], dict[str, Any]],
        get_files_to_process: Callable[[dict[str, Any], list[str]], list[str]],
        get_tag_mapping: Callable[[dict[str, Any], str], dict[str, Any]],
        get_source_system: Callable[[str], str],
        preprocess_file: Callable[[str, dict[str, Any]], list[dict[str, Any]]],
        write_csv: Callable[[str, list[dict[str, Any]]], None],
        write_union_csv: Callable[[str, list[dict[str, Any]]], None],
        join_path: Callable[..., str],
        union_filename: str = "all_preprocessed",
    ) -> None:
        super().__init__(context)
        self.tag_mappings_file = tag_mappings_file
        self.output_dir = output_dir
        self.abort_if_uc_runtime = abort_if_uc_runtime
        self.path_exists = path_exists
        self.load_json = load_json
        self.get_files_to_process = get_files_to_process
        self.get_tag_mapping = get_tag_mapping
        self.get_source_system = get_source_system
        self.preprocess_file = preprocess_file
        self.write_csv = write_csv
        self.write_union_csv = write_union_csv
        self.join_path = join_path
        self.union_filename = union_filename

    def run(self, selected_source_systems: Iterable[str]) -> None:
        selected = list(selected_source_systems)
        if not selected:
            raise RuntimeError("Preprocessing requires at least one source system.")

        self.abort_if_uc_runtime("step2_preprocess.py")

        print("=== Step 2: Preprocessing ===\n")

        if not self.path_exists(self.tag_mappings_file):
            raise RuntimeError(
                f"Preprocessing cannot start because {self.tag_mappings_file} was not found. "
                "Run step1_semantic_tagging.py first."
            )

        tag_mappings = self.load_json(self.tag_mappings_file)
        print(f"Selected source systems: {', '.join(selected)}\n")

        source_files = self.get_files_to_process(tag_mappings, selected)
        print(source_files)

        files_by_system: dict[str, list[str]] = {system: [] for system in selected}
        mappings_by_file: dict[str, dict[str, Any]] = {}
        missing_mappings: dict[str, list[str]] = {}
        for source_file in source_files:
            source_system = self.get_source_system(source_file)
            files_by_system.setdefault(source_system, []).append(source_file)
            mapping = self.get_tag_mapping(tag_mappings, source_file)
            mappings_by_file[source_file] = mapping
            if not mapping and source_system != "automotive":
                missing_mappings.setdefault(source_system, []).append(source_file)

        missing_inputs = [system for system in selected if not files_by_system.get(system)]
        if missing_inputs:
            raise RuntimeError(
                "No preprocessing input files were found for source system(s): "
                f"{', '.join(missing_inputs)}."
            )

        if missing_mappings:
            details = "; ".join(
                f"{system}: {', '.join(files)}"
                for system, files in missing_mappings.items()
            )
            raise RuntimeError(
                "Missing semantic tag mappings for preprocessing input file(s): "
                f"{details}."
            )

        all_rows_by_system: dict[str, list[dict[str, Any]]] = {system: [] for system in selected}

        for source_file in source_files:
            mapping = mappings_by_file[source_file]
            source_system = self.get_source_system(source_file)

            rows = self.preprocess_file(source_file, mapping)
            print(f"  {source_file}: {len(rows)} rows preprocessed")

            system_dir = self.join_path(self.output_dir, source_system)
            out_path = self.join_path(system_dir, f"preprocessed_{source_file}")
            self.write_csv(out_path, rows)

            all_rows_by_system.setdefault(source_system, []).extend(rows)

        empty_outputs = [system for system in selected if not all_rows_by_system.get(system)]
        if empty_outputs:
            raise RuntimeError(
                "Preprocessing produced zero rows for source system(s): "
                f"{', '.join(empty_outputs)}. Union outputs were not published."
            )

        for source_system, rows in all_rows_by_system.items():
            system_dir = self.join_path(self.output_dir, source_system)
            union_path = self.join_path(system_dir, self.union_filename)
            self.write_union_csv(union_path, rows)

            all_columns = set()
            for row in rows:
                all_columns.update(row.keys())

            print(
                f"\n  {source_system}/{self.union_filename}: "
                f"{len(rows)} total rows, {len(all_columns)} columns"
            )

        print("\n=== Preprocessing complete! ===")
