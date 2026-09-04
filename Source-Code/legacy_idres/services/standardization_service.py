"""Service orchestration for Step 2b standardization."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

from services.pipeline_base import LegacyPipelineService, PipelineStepContext


class StandardizationService(LegacyPipelineService):
    """Runs Step 2b standardization through a class-based service boundary."""

    def __init__(
        self,
        context: PipelineStepContext,
        input_dir: str,
        output_dir: str,
        stats: dict[str, int],
        get_files_to_process: Callable[[list[str]], list[tuple[str, str]]],
        expected_files_by_system: dict[str, list[str]],
        standardize_file: Callable[[str, str], list[dict[str, Any]]],
        get_source_system: Callable[[str], str],
        write_csv: Callable[[str, list[dict[str, Any]]], None],
        write_union_csv: Callable[[str, list[dict[str, Any]]], None],
        join_path: Callable[..., str],
        makedirs: Callable[..., Any],
        union_filename: str = "all_standardized",
    ) -> None:
        super().__init__(context)
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.stats = stats
        self.get_files_to_process = get_files_to_process
        self.expected_files_by_system = expected_files_by_system
        self.standardize_file = standardize_file
        self.get_source_system = get_source_system
        self.write_csv = write_csv
        self.write_union_csv = write_union_csv
        self.join_path = join_path
        self.makedirs = makedirs
        self.union_filename = union_filename

    def run(self, selected_source_systems: Iterable[str]) -> None:
        selected = list(selected_source_systems)
        if not selected:
            raise RuntimeError("Standardization requires at least one source system.")

        print("=== Step 2b: Standardization & Cleaning ===\n")
        print(f"Selected source systems: {', '.join(selected)}\n")

        print("Rules applied:")
        print("  Email  : lowercase -> fix domain typos -> preserve +tags -> exclude generics -> UPPERCASE")
        print("  Phone  : strip +1 country code -> remove non-digits -> 10 digits")
        print("  Name   : UPPERCASE (nicknames preserved for Jaro-Winkler)")
        print("  Address: parse with usaddress -> expand abbreviations -> UPPERCASE")
        print("  Date   : parse multiple formats -> ISO-8601 (YYYY-MM-DD)")
        print("  Postal : strip ZIP+4 -> zero-pad to 5 digits")
        print()

        files_to_process = self.get_files_to_process(selected)
        print(files_to_process)
        if not files_to_process:
            raise RuntimeError(
                f"No matching preprocessed CSV files were found in {self.input_dir} "
                f"for source system(s): {', '.join(selected)}."
            )

        files_by_system: dict[str, list[str]] = {system: [] for system in selected}
        for system, filename in files_to_process:
            files_by_system.setdefault(system, []).append(filename)

        missing_configured_inputs: dict[str, list[str]] = {}
        for system in selected:
            available = set(files_by_system.get(system, []))
            missing = [
                filename
                for filename in self.expected_files_by_system.get(system, [])
                if filename not in available
            ]
            if missing:
                missing_configured_inputs[system] = missing

        if missing_configured_inputs:
            details = "; ".join(
                f"{system}: {', '.join(files)}"
                for system, files in missing_configured_inputs.items()
            )
            raise RuntimeError(
                "Missing configured standardization input file(s): "
                f"{details}. Union outputs were not published."
            )

        missing_inputs = [system for system in selected if not files_by_system.get(system)]
        if missing_inputs:
            raise RuntimeError(
                "No standardization input files were found for source system(s): "
                f"{', '.join(missing_inputs)}."
            )

        all_rows_by_system: dict[str, list[dict[str, Any]]] = {system: [] for system in selected}

        for system, filename in files_to_process:
            rows = self.standardize_file(system, filename)
            print(f"  {filename}: {len(rows)} rows standardized")

            source_system = self.get_source_system(filename)

            system_dir = self.join_path(self.output_dir, source_system)
            self.makedirs(system_dir, exist_ok=True)

            out_filename = filename.replace("preprocessed_", "standardized_")
            out_path = self.join_path(system_dir, out_filename)
            self.write_csv(out_path, rows)

            if source_system in all_rows_by_system:
                all_rows_by_system[source_system].extend(rows)

        empty_outputs = [system for system in selected if not all_rows_by_system.get(system)]
        if empty_outputs:
            raise RuntimeError(
                "Standardization produced zero rows for source system(s): "
                f"{', '.join(empty_outputs)}. Union outputs were not published."
            )

        for source_system in selected:
            rows = all_rows_by_system.get(source_system, [])
            system_dir = self.join_path(self.output_dir, source_system)
            self.makedirs(system_dir, exist_ok=True)

            union_path = self.join_path(system_dir, self.union_filename)
            self.write_union_csv(union_path, rows)

            all_columns = set()
            for row in rows:
                all_columns.update(row.keys())

            print(
                f"\n  {source_system}/{self.union_filename}: "
                f"{len(rows)} total rows, {len(all_columns)} columns"
            )

        print("\nStandardization stats:")
        print(
            f"  Emails  - typos fixed: {self.stats['email_fixed_typo']}, "
            f"+tags preserved: {self.stats['email_plus_tag_preserved']}, "
            f"generics excluded: {self.stats['email_excluded_generic']}, "
            f"dot-fixes: {self.stats['email_fixed_dots']}"
        )
        print(
            f"  Phones  - normalized to 10 digits: {self.stats['phone_normalized']}, "
            f"country code stripped: {self.stats['phone_stripped_country']}"
        )
        print(f"  Names   - uppercased: {self.stats['name_uppercased']}")
        print(
            f"  Address - parsed via usaddress: {self.stats['address_parsed_usaddress']}, "
            f"expanded: {self.stats['address_expanded']}"
        )
        print(f"  Dates   - reformatted: {self.stats['date_reformatted']}")
        print(
            f"  ZIP     - stripped +4: {self.stats['zip_stripped_plus4']}, "
            f"zero-padded: {self.stats['zip_zero_padded']}"
        )

        print("\n=== Standardization complete! ===")
