import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

import yaml

import pipeline_uc_bootstrap  # noqa: F401


ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "enhanced_identity_config" / "media_identity_config.yaml"


def load_yaml(path):
    with open(path, "r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def resolve_path(path_text):
    path = Path(path_text)
    return path if path.is_absolute() else ROOT / path


def read_csv(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def looks_like_email(value):
    text = str(value or "").strip()
    return "@" in text and "." in text.split("@")[-1]


def looks_like_phone(value):
    text = str(value or "").strip()
    if any(ch.isalpha() for ch in text):
        return False
    digits = "".join(ch for ch in text if ch.isdigit())
    return len(digits) >= 7 and "@" not in text


def first_value(records, field, validator=None):
    counts = defaultdict(int)
    first_seen = {}
    for record in records:
        value = str(record.get(field, "")).strip()
        if validator and not validator(value):
            continue
        if value:
            counts[value] += 1
            first_seen.setdefault(value, len(first_seen))
    if not counts:
        return ""
    return sorted(counts, key=lambda value: (-counts[value], first_seen[value]))[0]


def collect_values(records, field, validator=None):
    values = []
    seen = set()
    for record in records:
        value = str(record.get(field, "")).strip()
        if validator and not validator(value):
            continue
        if value and value not in seen:
            seen.add(value)
            values.append(value)
    return "|".join(values)


def first_phone_value(records, config):
    phone_field = derived_field(config, "phone_raw")
    email_field = derived_field(config, "email_raw")
    return first_value(records, phone_field, looks_like_phone) or first_value(records, email_field, looks_like_phone)


def collect_phone_values(records, config):
    phone_field = derived_field(config, "phone_raw")
    email_field = derived_field(config, "email_raw")
    values = []
    seen = set()
    for field in [phone_field, email_field]:
        for value in collect_values(records, field, looks_like_phone).split("|"):
            if value and value not in seen:
                seen.add(value)
                values.append(value)
    return "|".join(values)


def provenance_candidates(records, fields, validator=None):
    candidates = []
    for record in records:
        for field in fields:
            value = str(record.get(field, "")).strip()
            if validator and not validator(value):
                continue
            if not value:
                continue
            candidates.append({
                "value": value,
                "source": record.get("source_file", ""),
                "record_id": record.get("record_id", ""),
            })
    return candidates


def chosen_candidate_details(candidates, chosen_value):
    for candidate in candidates:
        if candidate["value"] == chosen_value:
            return candidate.get("source", ""), candidate.get("record_id", "")
    return "", ""


def provenance_entry(candidates, chosen_value, rule="Most Frequent Value"):
    chosen_source, chosen_record = chosen_candidate_details(candidates, chosen_value)
    if not candidates:
        return {
            "candidates": [],
            "chosen_value": "",
            "chosen_source": "",
            "chosen_record": "",
            "rule": rule,
            "reason": "No data available",
        }
    count = sum(1 for candidate in candidates if candidate["value"] == chosen_value)
    source_count = sum(
        1
        for candidate in candidates
        if candidate["value"] == chosen_value and candidate["source"] == chosen_source
    )
    reason = f"Most frequent value ({count} occurrence{'s' if count != 1 else ''}"
    if chosen_source:
        reason += f", {source_count} from {chosen_source}"
    reason += ")"
    return {
        "candidates": candidates,
        "chosen_value": chosen_value,
        "chosen_source": chosen_source,
        "chosen_record": chosen_record,
        "rule": rule,
        "reason": reason,
    }


def build_provenance(members, config, chosen_values):
    fields = {
        "full_name": ([derived_field(config, "name_raw")], None),
        "email": ([derived_field(config, "email_raw")], looks_like_email),
        "phone": ([derived_field(config, "phone_raw"), derived_field(config, "email_raw")], looks_like_phone),
        "address": ([derived_field(config, "address_raw")], None),
        "city": ([source_field(config, "city")], None),
        "state": ([source_field(config, "state")], None),
        "zip": ([derived_field(config, "zip")], None),
    }
    provenance = {}
    for output_field, (candidate_fields, validator) in fields.items():
        candidates = provenance_candidates(members, candidate_fields, validator)
        provenance[output_field] = provenance_entry(
            candidates,
            chosen_values.get(output_field, ""),
            "Most Frequent Valid Value",
        )
    return provenance


def derived_field(config, logical_name):
    field_names = config.get("matching_field_preparation", {}).get("derived_field_names", {})
    try:
        return field_names[logical_name]
    except KeyError as exc:
        raise KeyError(
            f"Missing config value: matching_field_preparation.derived_field_names.{logical_name}"
        ) from exc


def source_field(config, logical_name):
    field_names = config.get("input", {}).get("field_names", {})
    try:
        return field_names[logical_name]
    except KeyError as exc:
        raise KeyError(f"Missing config value: input.field_names.{logical_name}") from exc


def source_system_value(config):
    return config.get("input", {}).get("source_system_value", config.get("domain", ""))


def output_column(config, logical_name):
    try:
        return config["output"]["column_names"][logical_name]
    except KeyError as exc:
        raise KeyError(f"Missing config value: output.column_names.{logical_name}") from exc


def source_record_id(record, config):
    return record.get(config["input"]["record_id_field"], "")


def household_key(records, config):
    for record in records:
        address = str(record.get(derived_field(config, "address_standardized"), "")).strip()
        zip_code = str(record.get(derived_field(config, "zip"), "")).strip()
        if address and zip_code:
            return f"{address}|{zip_code}"
    return ""


def main():
    parser = argparse.ArgumentParser(description="Enhanced golden record builder.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--source-systems", default="")
    args = parser.parse_args()

    config = load_yaml(Path(args.config))
    clustered_path = resolve_path(config["output"]["clustered_records"])
    golden_path = resolve_path(config["output"]["golden_records"])
    superseded_path = resolve_path(config["output"]["superseded_ids"])
    summary_path = resolve_path(config["output"]["golden_record_summary"])
    provenance_path = resolve_path(
        config["output"].get(
            "golden_record_provenance",
            str(Path(config["output"]["golden_records"]).with_name("golden_record_provenance.json")),
        )
    )
    golden_path.parent.mkdir(parents=True, exist_ok=True)

    records = read_csv(clustered_path)
    if not records:
        raise RuntimeError(
            "Golden-record generation received zero clustered records; "
            "existing golden outputs were not replaced."
        )
    clusters = defaultdict(list)
    for record in records:
        clusters[record[output_column(config, "cluster_id")]].append(record)

    household_prefix = config["clustering"]["household_id_prefix"]
    household_ids = {}
    for key in sorted({household_key(members, config) for members in clusters.values()} - {""}):
        household_ids[key] = f"{household_prefix}-{len(household_ids) + 1:06d}"

    golden_rows = []
    superseded_rows = []
    provenance_rows = {}
    cluster_prefix = config["clustering"]["cluster_id_prefix"]
    golden_prefix = config["clustering"]["golden_id_prefix"]
    for cluster_id, members in sorted(clusters.items()):
        golden_id = cluster_id.replace(cluster_prefix, golden_prefix, 1) if cluster_prefix else f"{golden_prefix}-{len(golden_rows) + 1:06d}"
        key = household_key(members, config)
        household_id = household_ids.get(key, "")
        chosen_values = {
            "full_name": first_value(members, derived_field(config, "name_raw")),
            "email": first_value(members, derived_field(config, "email_raw"), looks_like_email),
            "phone": first_phone_value(members, config),
            "address": first_value(members, derived_field(config, "address_raw")),
            "city": first_value(members, source_field(config, "city")),
            "state": first_value(members, source_field(config, "state")),
            "zip": first_value(members, derived_field(config, "zip")),
        }
        golden_rows.append({
            "cluster_id": cluster_id,
            "golden_id": golden_id,
            "household_id": household_id,
            "source_system": source_system_value(config),
            **chosen_values,
            "record_count": len(members),
            "all_emails": collect_values(members, derived_field(config, "email_raw"), looks_like_email),
            "all_phones": collect_phone_values(members, config),
            "all_names": collect_values(members, derived_field(config, "name_raw")),
            "all_addresses": collect_values(members, derived_field(config, "address_raw")),
        })
        provenance_rows[golden_id] = build_provenance(members, config, chosen_values)

        for member in members:
            superseded_rows.append({
                "record_id": source_record_id(member, config),
                "source_file": member.get(config["input"]["source_field"], ""),
                "source_system": member.get("source_system", source_system_value(config)),
                "cluster_id": cluster_id,
                "golden_id": golden_id,
                "household_id": household_id,
            })

    golden_fields = config["output"]["golden_record_columns"]
    with open(golden_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=golden_fields)
        writer.writeheader()
        writer.writerows(golden_rows)

    with open(superseded_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=config["output"]["superseded_id_columns"])
        writer.writeheader()
        writer.writerows(superseded_rows)

    with open(provenance_path, "w", encoding="utf-8") as handle:
        json.dump(provenance_rows, handle, indent=2)

    multi_record = sum(1 for row in golden_rows if int(row["record_count"]) > 1)
    summary = {
        "total_golden_records": len(golden_rows),
        "multi_record_golden_records": multi_record,
        "single_record_golden_records": len(golden_rows) - multi_record,
        "superseded_id_count": len(superseded_rows),
        "household_id_count": len(household_ids),
    }
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)

    print(f"Wrote {len(golden_rows)} enhanced golden records to {golden_path}")
    print(f"Wrote {len(superseded_rows)} enhanced superseded IDs to {superseded_path}")
    print(f"Wrote provenance for {len(provenance_rows)} enhanced golden records to {provenance_path}")


if __name__ == "__main__":
    main()
