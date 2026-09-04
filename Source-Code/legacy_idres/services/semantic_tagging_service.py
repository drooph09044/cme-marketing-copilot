"""Service orchestration for Step 1 semantic tagging."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from services.pipeline_base import LegacyPipelineService, PipelineStepContext


class SemanticTaggingService(LegacyPipelineService):
    """Runs Step 1 semantic tagging through a class-based service boundary."""

    def __init__(
        self,
        context: PipelineStepContext,
        input_dir: str,
        abort_if_uc_runtime: Callable[[str], None],
        get_selected_source_systems: Callable[[], list[str]],
        get_source_files: Callable[[list[str]], list[str]],
        load_existing_mappings_if_valid: Callable[[list[str]], dict[str, Any] | None],
        ensure_ml: Callable[[], bool],
        sentence_transformer_factory: Callable[[str], Any],
        source_system_files: dict[str, dict[str, list[str]]],
        resolve_input_filepath: Callable[[str], str | None],
        load_columns: Callable[[str], list[str]],
        is_missing_input_error: Callable[[Exception], bool],
        compute_tag_mapping: Callable[[Any, list[str], str], dict[str, str]],
        manual_overrides: dict[str, dict[str, str]],
        automotive_common_overrides: dict[str, str],
        output_file: str,
        cache_file: str,
        write_json: Callable[[str, dict[str, Any]], None],
        ml_required: bool = False,
        skip_missing_inputs: bool = True,
    ) -> None:
        super().__init__(context)
        self.input_dir = input_dir
        self.abort_if_uc_runtime = abort_if_uc_runtime
        self.get_selected_source_systems_callback = get_selected_source_systems
        self.get_source_files = get_source_files
        self.load_existing_mappings_if_valid = load_existing_mappings_if_valid
        self.ensure_ml = ensure_ml
        self.sentence_transformer_factory = sentence_transformer_factory
        self.source_system_files = source_system_files
        self.resolve_input_filepath = resolve_input_filepath
        self.load_columns = load_columns
        self.is_missing_input_error = is_missing_input_error
        self.compute_tag_mapping = compute_tag_mapping
        self.manual_overrides = manual_overrides
        self.automotive_common_overrides = automotive_common_overrides
        self.output_file = output_file
        self.cache_file = cache_file
        self.write_json = write_json
        self.ml_required = ml_required
        self.skip_missing_inputs = skip_missing_inputs

    def run(self) -> dict[str, Any] | None:
        self.abort_if_uc_runtime("step1_semantic_tagging.py")

        print("=== Step 1: Semantic Tagging ===\n")

        selected_source_systems = self.get_selected_source_systems_callback()
        source_files = self.get_source_files(selected_source_systems)

        print(f"Selected source systems: {', '.join(selected_source_systems)}")
        print(f"Expected canonical source files: {len(source_files)}\n")

        existing = self.load_existing_mappings_if_valid(source_files)
        if existing is not None:
            return existing

        if self.ensure_ml():
            print("Loading SentenceTransformers model (all-MiniLM-L6-v2)...")
            model = self.sentence_transformer_factory("all-MiniLM-L6-v2")
            print("Model loaded.\n")
        elif self.ml_required:
            print("[ERROR] sentence-transformers not available and no valid cached mappings found.")
            print("Install with: pip install sentence-transformers")
            raise SystemExit(1)
        else:
            model = None
            print("[WARN] sentence-transformers not available; using manual overrides only.")
            print("[WARN] Unmapped columns will keep their original column names.\n")

        all_mappings: dict[str, Any] = {}

        for source_system in selected_source_systems:
            print(f"--- Processing source system: {source_system} ---")

            for canonical_source_file in self.source_system_files.get(source_system, {}).keys():
                filepath = self.resolve_input_filepath(canonical_source_file)

                if not filepath:
                    print(f"  SKIP: {canonical_source_file} not found (no matching alias in {self.input_dir})")
                    continue

                actual_input_name = Path(filepath).name
                try:
                    columns = self.load_columns(filepath)
                except Exception as exc:
                    if self.skip_missing_inputs and self.is_missing_input_error(exc):
                        print(f"  SKIP: {canonical_source_file} not found in UC ({exc})")
                        continue
                    raise

                mapping = self.compute_tag_mapping(model, columns, canonical_source_file)
                all_mappings[canonical_source_file] = mapping

                print(f"  {canonical_source_file} (from {actual_input_name}):")
                for col, tag in mapping.items():
                    is_override = (
                        col in self.manual_overrides.get(canonical_source_file, {})
                        or (canonical_source_file.startswith("aut_") and col in self.automotive_common_overrides)
                    )
                    marker = " (override)" if is_override else ""
                    print(f"    {col:35s} -> {tag}{marker}")
                print()

        self.write_json(self.output_file, all_mappings)
        print(f"Saved tag mappings to {self.output_file}")

        self.write_json(self.cache_file, all_mappings)
        print(f"Cached mappings to {self.cache_file}")

        print("\n=== Semantic tagging complete! ===")
        return all_mappings
