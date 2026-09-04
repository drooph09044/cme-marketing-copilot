"""
generate_household_links.py
Generates household_links.csv from golden_records.csv household_id column.
Uses the authoritative household assignment from Step 5 (device_id OR address+zip).

Run from legacy_idres/:
    python generate_household_links.py
    python generate_household_links.py --source-systems sports
"""
from __future__ import annotations

import argparse
import csv
import os
from collections import defaultdict
from pathlib import Path

from services.household_link_service import HouseholdLinkService
from services.pipeline_base import PipelineStepContext
import pipeline_uc_bootstrap  # noqa: F401

from legacy_pipeline_config import household_source_systems, pipeline_directory


ROOT = Path(__file__).resolve().parent
GOLDEN_CSV = ROOT / "golden_records.csv"
HOUSEHOLD_CSV = ROOT / "household_links.csv"
GOLDEN_OUTPUT_DIR = ROOT / pipeline_directory("golden_records_output", "golden_records_output")
DEFAULT_SOURCE_SYSTEMS = tuple(household_source_systems())


def uc_mode():
    return os.getenv("CODEX_DATA_SOURCE", "").strip().lower() == "uc"


def build_household_link_service():
    return HouseholdLinkService(
        context=PipelineStepContext(
            source_systems=list(DEFAULT_SOURCE_SYSTEMS),
            default_source_systems=list(DEFAULT_SOURCE_SYSTEMS),
        ),
        abort_if_uc_runtime=pipeline_uc_bootstrap.abort_if_uc_runtime,
        uc_mode=uc_mode,
        source_paths=source_paths,
        build_household_links=build_household_links,
        default_golden_csv=GOLDEN_CSV,
        default_household_csv=HOUSEHOLD_CSV,
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Generate household_links from golden_records")
    parser.add_argument(
        "--source-systems",
        default=os.getenv("SOURCE_SYSTEMS", ""),
        help="Comma-separated source systems. In UC mode defaults come from backend config.",
    )
    return parser.parse_args()


def get_selected_source_systems(raw_value):
    selected = [s.strip().lower() for s in str(raw_value or "").split(",") if s.strip()]
    invalid = [s for s in selected if s not in DEFAULT_SOURCE_SYSTEMS]
    if invalid:
        raise ValueError(f"Invalid source system(s): {invalid}. Allowed: {list(DEFAULT_SOURCE_SYSTEMS)}")
    return selected


def source_paths(source_system):
    source_dir = GOLDEN_OUTPUT_DIR / source_system
    return source_dir / "golden_records.csv", source_dir / "household_links.csv"


def build_household_links(golden_path, household_path):
    if not golden_path.exists():
        print(f"ERROR: {golden_path} not found")
        return 0, 0

    # Group golden records by household_id.
    hh_groups = defaultdict(list)
    with open(golden_path, "r", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            hh_id = row.get("household_id", "").strip()
            gid = row.get("golden_id", "").strip()
            if not hh_id or not gid:
                continue
            hh_groups[hh_id].append(
                {
                    "golden_id": gid,
                    "full_name": row.get("full_name", "").strip(),
                    "email": row.get("email", "").strip(),
                    "address": row.get("address", "").strip(),
                    "zip": row.get("zip", "").strip(),
                }
            )

    # Write household links only for groups with two or more members.
    os.makedirs(household_path.parent, exist_ok=True)
    written = 0
    households = 0
    with open(household_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "golden_id",
                "household_golden_id",
                "full_name",
                "email",
                "address",
                "zip",
                "relationship",
                "household_id",
            ],
        )
        writer.writeheader()
        for hh_id, members in hh_groups.items():
            if len(members) < 2:
                continue
            households += 1
            for index, member in enumerate(members):
                for other_index, other in enumerate(members):
                    if index == other_index:
                        continue
                    writer.writerow(
                        {
                            "golden_id": member["golden_id"],
                            "household_golden_id": other["golden_id"],
                            "full_name": other["full_name"],
                            "email": other["email"],
                            "address": other["address"],
                            "zip": other["zip"],
                            "relationship": "Household Member",
                            "household_id": hh_id,
                        }
                    )
                    written += 1

    print(f"Done - {written} household links written to {household_path}")
    print(f"Households found: {households}")
    return written, households


def main():
    args = parse_args()
    try:
        selected_source_systems = get_selected_source_systems(args.source_systems)
    except ValueError as exc:
        print(f"ERROR: {exc}")
        return

    build_household_link_service().run(selected_source_systems)


if __name__ == "__main__":
    main()
