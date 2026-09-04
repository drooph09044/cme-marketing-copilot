import argparse
import csv
import re
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


def clean_text(value):
    return " ".join(str(value or "").strip().split())


def source_field(config, logical_name):
    field_names = config.get("input", {}).get("field_names", {})
    return field_names.get(logical_name, "")


def derived_field(config, logical_name):
    field_names = config.get("matching_field_preparation", {}).get("derived_field_names", {})
    try:
        return field_names[logical_name]
    except KeyError as exc:
        raise KeyError(
            f"Missing config value: matching_field_preparation.derived_field_names.{logical_name}"
        ) from exc


def prepare_email(value, config):
    prep = config["matching_field_preparation"]
    email_rules = prep["email_normalization"]
    email_raw = clean_text(value)
    email = email_raw
    if email_rules["lowercase"]:
        email = email.lower()
    if email_rules["remove_spaces"]:
        email = email.replace(" ", "")
    if email_rules["collapse_repeated_at"]:
        email = re.sub(r"@+", "@", email)
    if not email or "@" not in email:
        return {
            derived_field(config, "email_raw"): email_raw,
            derived_field(config, "email_standardized"): "",
            derived_field(config, "email_name_part"): "",
            derived_field(config, "email_provider"): "",
        }

    name_part, provider = email.rsplit("@", 1)
    if email_rules["remove_plus_tags"] and "+" in name_part:
        name_part = name_part.split("+", 1)[0]
    if email_rules["collapse_repeated_dots"]:
        name_part = re.sub(r"\.{2,}", ".", name_part)
    if email_rules["strip_outer_dots"]:
        name_part = name_part.strip(".")
        provider = provider.strip(".")
    if email_rules["correct_domain_typos"]:
        provider = str(prep["email_domain_corrections"].get(provider, provider))
    if email_rules["lowercase"]:
        provider = provider.lower()

    return {
        derived_field(config, "email_raw"): email_raw,
        derived_field(config, "email_standardized"): f"{name_part}@{provider}" if name_part and provider else "",
        derived_field(config, "email_name_part"): name_part,
        derived_field(config, "email_provider"): provider,
    }


def prepare_phone(value, config):
    phone_rules = config["matching_field_preparation"]["phone_normalization"]
    phone_raw = clean_text(value)
    digits = re.sub(r"\D", "", phone_raw) if phone_rules["digits_only"] else phone_raw
    if phone_rules["remove_us_country_code"] and len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    minimum_digits = int(phone_rules.get("minimum_digits", 0) or 0)
    minimum_unique_digits = int(phone_rules.get("minimum_unique_digits", 0) or 0)
    low_quality_values = {str(item) for item in phone_rules.get("low_quality_values", [])}
    if (
        (minimum_digits and len(digits) < minimum_digits)
        or (minimum_unique_digits and len(set(digits)) < minimum_unique_digits)
        or digits in low_quality_values
    ):
        digits = ""
    return {
        derived_field(config, "phone_raw"): phone_raw,
        derived_field(config, "phone_standardized"): digits,
    }


def prepare_name(row, config):
    prep = config["matching_field_preparation"]
    name_rules = prep["name_normalization"]
    title_words = set(prep["name_title_words"]) if name_rules["remove_titles"] else set()
    suffix_words = set(prep["name_suffix_words"]) if name_rules["remove_suffixes"] else set()
    nickname_map = prep.get("nickname_mappings", {}) if name_rules["apply_nicknames"] else {}

    name_field = source_field(config, "name")
    first_name_field = source_field(config, "first_name")
    last_name_field = source_field(config, "last_name")
    source_first_name = clean_text(row.get(first_name_field, "")) if first_name_field else ""
    source_last_name = clean_text(row.get(last_name_field, "")) if last_name_field else ""
    name_raw = clean_text(row.get(name_field, "")) if name_field else ""
    non_person_values = {
        str(value).strip().upper()
        for value in prep.get("name_non_person_values", [])
        if str(value or "").strip()
    }
    if name_raw.upper() in non_person_values:
        name_raw = ""
    if not name_raw:
        name_raw = clean_text(f"{source_first_name} {source_last_name}")
    if name_raw.upper() in non_person_values:
        name_raw = ""

    parts = [p for p in re.sub(r"[^A-Za-z ]", " ", name_raw).upper().split() if p]
    parts = [p for p in parts if p not in title_words and p not in suffix_words]
    if not parts:
        return {
            derived_field(config, "name_raw"): name_raw,
            derived_field(config, "first_name"): "",
            derived_field(config, "last_name"): "",
            derived_field(config, "first_initial"): "",
            derived_field(config, "last_initial"): "",
        }

    prepared_source_first = re.sub(r"[^A-Za-z]", "", source_first_name).upper()
    prepared_source_last = re.sub(r"[^A-Za-z]", "", source_last_name).upper()
    first_name = prepared_source_first or parts[0]
    last_name = prepared_source_last or (parts[-1] if len(parts) > 1 else "")
    first_name = str(nickname_map.get(first_name, first_name))
    last_name = str(nickname_map.get(last_name, last_name))

    return {
        derived_field(config, "name_raw"): name_raw,
        derived_field(config, "first_name"): first_name,
        derived_field(config, "last_name"): last_name,
        derived_field(config, "first_initial"): first_name[:1],
        derived_field(config, "last_initial"): last_name[:1],
    }


def prepare_address(row, config):
    address_rules = config["matching_field_preparation"]["address_normalization"]
    address_field = source_field(config, "address")
    zip_field = source_field(config, "zip")
    address_raw = clean_text(row.get(address_field, "")) if address_field else ""
    address_standardized = address_raw
    if address_rules["remove_punctuation"]:
        address_standardized = re.sub(r"[^A-Za-z0-9 ]", " ", address_standardized)
    if address_rules["uppercase"]:
        address_standardized = address_standardized.upper()
    address_standardized = " ".join(address_standardized.split())
    tokens = address_standardized.split()
    split_house_number = address_rules["split_house_number"]
    house_number = tokens[0] if split_house_number and tokens and tokens[0].isdigit() else ""
    street_name = " ".join(tokens[1:] if house_number else tokens)
    return {
        derived_field(config, "address_raw"): address_raw,
        derived_field(config, "address_standardized"): address_standardized,
        derived_field(config, "house_number"): house_number,
        derived_field(config, "street_name"): street_name,
        derived_field(config, "zip"): clean_text(row.get(zip_field, "")) if zip_field else "",
    }


def prepare_exact_identifiers(row, config):
    prepared = {}
    for item in config["matching_field_preparation"].get("exact_identifier_fields", []):
        source_name = item.get("source_field", "")
        output_name = item.get("prepared_field", "")
        if not source_name or not output_name:
            continue
        value = clean_text(row.get(source_name, ""))
        if item.get("uppercase", False):
            value = value.upper()
        if item.get("lowercase", False):
            value = value.lower()
        if item.get("remove_spaces", False):
            value = value.replace(" ", "")
        prepared[output_name] = value
    return prepared


def prepare_record(row, config):
    prepared = dict(row)
    prepared.update(prepare_email(row.get(source_field(config, "email"), ""), config))
    prepared.update(prepare_phone(row.get(source_field(config, "phone"), ""), config))
    prepared.update(prepare_name(row, config))
    prepared.update(prepare_address(row, config))
    prepared.update(prepare_exact_identifiers(row, config))
    device_field = source_field(config, "device_id")
    ip_field = source_field(config, "ip_address")
    if device_field:
        prepared[device_field] = clean_text(row.get(device_field, ""))
    if ip_field:
        prepared[ip_field] = clean_text(row.get(ip_field, ""))
    return prepared


def read_source_records(config):
    input_path = resolve_path(config["input"]["standardized_records"])
    with open(input_path, "r", encoding="utf-8-sig", newline="") as handle:
        return [prepare_record(row, config) for row in csv.DictReader(handle)]


def deduplicate_source_records(records, config):
    """Return one prepared row per globally unique source-record identifier.

    The downstream candidate scorer and union-find clusterer use ``record_id``
    as their node key.  Allowing the same identifier to occur more than once
    therefore inflates golden-record counts while the graph can represent only
    one node.  Exact duplicate input rows are safe to collapse.  Conflicting
    rows with the same identifier are rejected because silently choosing one
    would make identity evidence non-deterministic.
    """
    record_id_field = str(config.get("input", {}).get("record_id_field") or "").strip()
    if not record_id_field:
        raise RuntimeError("Missing config value: input.record_id_field")

    unique_records = []
    fingerprints_by_id = {}
    missing_id_rows = []
    conflicting_ids = set()
    duplicate_rows_removed = 0

    for row_number, record in enumerate(records, start=1):
        record_id = clean_text(record.get(record_id_field, ""))
        if not record_id:
            missing_id_rows.append(row_number)
            continue

        # CSV values are strings; sorting the complete prepared row gives a
        # deterministic equality check without dropping identity attributes.
        fingerprint = tuple(
            sorted((str(key), str(value or "")) for key, value in record.items())
        )
        previous = fingerprints_by_id.get(record_id)
        if previous is None:
            fingerprints_by_id[record_id] = fingerprint
            unique_records.append(record)
        elif previous == fingerprint:
            duplicate_rows_removed += 1
        else:
            conflicting_ids.add(record_id)

    if missing_id_rows:
        sample_rows = ", ".join(str(value) for value in missing_id_rows[:10])
        raise RuntimeError(
            f"Standardized input contains {len(missing_id_rows)} row(s) without "
            f"{record_id_field}; sample data-row numbers: {sample_rows}. "
            "Existing identity outputs were not replaced."
        )
    if conflicting_ids:
        sample_ids = ", ".join(sorted(conflicting_ids)[:10])
        raise RuntimeError(
            f"Standardized input contains {len(conflicting_ids)} conflicting "
            f"duplicate {record_id_field} value(s); sample identifiers: "
            f"{sample_ids}. Existing identity outputs were not replaced."
        )

    return unique_records, duplicate_rows_removed


def write_prepared_records(records, config):
    if not records:
        raise RuntimeError(
            "Matching-field preparation received zero standardized records; "
            "existing identity outputs were not replaced."
        )
    output_path = resolve_path(config["output"]["prepared_records"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(records[0].keys()) if records else []
    with open(output_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Enhanced matching-field preparation.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--source-systems", default="")
    args = parser.parse_args()

    config = load_yaml(Path(args.config))
    input_records = read_source_records(config)
    records, duplicate_rows_removed = deduplicate_source_records(input_records, config)
    output_path = write_prepared_records(records, config)
    print(
        f"Wrote {len(records)} enhanced prepared records to {output_path} "
        f"from {len(input_records)} standardized rows; removed "
        f"{duplicate_rows_removed} exact duplicate source rows"
    )


if __name__ == "__main__":
    main()
