"""
Step 2 — Preprocessing
Read raw CSVs + tag_mappings.json, rename columns to canonical names,
normalize values, output preprocessed CSVs + separate all_preprocessed.csv
per source system (media / sports / automotive).

Behavior:
- By default processes ALL source systems.
- Optional control via CLI:
    python step2_preprocessing.py --source-systems media
    python step2_preprocessing.py --source-systems sports
    python step2_preprocessing.py --source-systems media,sports,automotive
"""

import argparse
import csv
import json
import os
import re
from services.pipeline_base import PipelineStepContext
from services.preprocessing_service import PreprocessingService
import pipeline_uc_bootstrap  # noqa: F401

from legacy_pipeline_config import (
    column_aliases as configured_column_aliases,
    default_source_systems,
    pipeline_directory,
    source_file_map,
    tag_mapping_aliases,
)

def _csv_name(value):
    text = str(value)
    return text if text.lower().endswith(".csv") else f"{text}.csv"

def _configured_source_file_map(stage):
    return {
        source: {
            _csv_name(name): [_csv_name(alias) for alias in aliases]
            for name, aliases in files.items()
        }
        for source, files in source_file_map(stage).items()
    }

INPUT_DIR = pipeline_directory("generated_data", "generated_data")
OUTPUT_DIR = pipeline_directory("preprocessed_data", "preprocessed_data")
DEFAULT_SOURCE_SYSTEMS = default_source_systems()
AUTOMOTIVE_COLUMN_ALIASES = configured_column_aliases("automotive")
SOURCE_SYSTEM_FILES = _configured_source_file_map("preprocessing")
TAG_MAPPING_ALIASES = tag_mapping_aliases()


TAG_MAPPINGS_FILE = "tag_mappings.json"

os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_json_file(filepath):
    with open(filepath, "r", encoding="utf-8") as handle:
        return json.load(handle)


def get_tag_mapping(tag_mappings, source_file):
    """Resolve semantic mappings across governed and friendly source names.

    Semantic tagging intentionally exposes friendly Media keys such as
    ``app_events.csv`` while preprocessing reads the governed UC source name
    ``med_app_events.csv``.  The alias catalog in backend/config.yaml is the
    contract between those two stages; do not depend on an older cache
    containing both spellings.
    """
    direct = tag_mappings.get(source_file)
    if direct:
        return direct

    source_stem = os.path.splitext(str(source_file))[0]
    alias = TAG_MAPPING_ALIASES.get(source_stem)
    if not alias:
        return {}
    return tag_mappings.get(_csv_name(alias), {})


def build_preprocessing_service():
    return PreprocessingService(
        context=PipelineStepContext(
            source_systems=list(SOURCE_SYSTEM_FILES.keys()),
            default_source_systems=DEFAULT_SOURCE_SYSTEMS,
        ),
        tag_mappings_file=TAG_MAPPINGS_FILE,
        output_dir=OUTPUT_DIR,
        abort_if_uc_runtime=pipeline_uc_bootstrap.abort_if_uc_runtime,
        path_exists=os.path.exists,
        load_json=load_json_file,
        get_files_to_process=get_files_to_process,
        get_tag_mapping=get_tag_mapping,
        get_source_system=get_source_system,
        preprocess_file=preprocess_file,
        write_csv=write_csv,
        write_union_csv=write_union_csv,
        join_path=os.path.join,
        union_filename="all_preprocessed.csv",
    )




# ---------------------------------------------------------------------
# SOURCE FILES
# ---------------------------------------------------------------------
# canonical mapping key -> possible physical filenames in generated_data/

# Common email typos to fix
EMAIL_TYPO_FIXES = {
    "gmial.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gamil.com": "gmail.com",
    "yahooo.com": "yahoo.com",
    "yaho.com": "yahoo.com",
    "outlok.com": "outlook.com",
    "hotmal.com": "hotmail.com",
    "iclod.com": "icloud.com",
}

# Address abbreviation expansion
ADDRESS_EXPANSIONS = {
    r"\bSt\.?\b": "Street",
    r"\bAve\.?\b": "Avenue",
    r"\bBlvd\.?\b": "Boulevard",
    r"\bDr\.?\b": "Drive",
    r"\bLn\.?\b": "Lane",
    r"\bCt\.?\b": "Court",
    r"\bPl\.?\b": "Place",
    r"\bRd\.?\b": "Road",
    r"\bCir\.?\b": "Circle",
    r"\bWy\b": "Way",
    r"\bStr\b": "Street",
    r"\bAv\b": "Avenue",
    r"\bApt\.?\b": "Apartment",
    r"\bSte\.?\b": "Suite",
    r"\bN\.?\b": "North",
    r"\bS\.?\b": "South",
    r"\bE\.?\b": "East",
    r"\bW\.?\b": "West",
}


# ---------------------------------------------------------------------
# SOURCE-SYSTEM SELECTION
# ---------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description="Step 2 — Preprocessing")
    parser.add_argument(
        "--source-systems",
        default=",".join(DEFAULT_SOURCE_SYSTEMS),
        help="Comma-separated source systems to process. Default: media,sports,automotive",
    )
    return parser.parse_args()


def get_selected_source_systems(raw_value):
    selected = [s.strip().lower() for s in raw_value.split(",") if s.strip()]

    invalid = [s for s in selected if s not in SOURCE_SYSTEM_FILES]
    if invalid:
        print(f"[WARN] Ignoring unknown source systems: {invalid}")
        selected = [s for s in selected if s in SOURCE_SYSTEM_FILES]

    if not selected:
        selected = DEFAULT_SOURCE_SYSTEMS

    return selected


def get_expected_canonical_files(selected_source_systems):
    files = []
    for system in selected_source_systems:
        files.extend(SOURCE_SYSTEM_FILES.get(system, {}).keys())
    return files


def resolve_input_filepath(canonical_source_file):
    """
    Find the actual physical file in INPUT_DIR for a canonical source file key.
    Now supports subfolders like media/ and sports/.
    """
    for system, file_map in SOURCE_SYSTEM_FILES.items():
        aliases = file_map.get(canonical_source_file, [])

        for candidate_name in aliases:
            # NEW: check inside system folder (media/sports)
            candidate_path = os.path.join(INPUT_DIR, system, candidate_name)
            if os.path.exists(candidate_path):
                return candidate_path

            #  existing behavior (root level)
            candidate_path = os.path.join(INPUT_DIR, candidate_name)
            if os.path.exists(candidate_path):
                return candidate_path

    return None


def get_source_system(source_file):
    for system, file_map in SOURCE_SYSTEM_FILES.items():
        if source_file in file_map:
            return system
        for aliases in file_map.values():
            if source_file in aliases:
                return system

    if source_file.startswith("med_"):
        return "media"
    if source_file.startswith("spt_"):
        return "sports"
    if source_file.startswith("aut_"):
        return "automotive"

    return "unknown"


def get_column_aliases(source_system):
    if source_system == "automotive":
        return AUTOMOTIVE_COLUMN_ALIASES
    return {}


def build_record_id(source_file, raw_row, row_index):
    id_fields = [
        "record_id",
        "customer_id",
        "account_id",
        "contact_id",
        "address_id",
        "vehicle_id",
        "vin",
        "order_id",
        "service_order_id",
        "appointment_id",
        "case_id",
        "session_id",
        "event_id",
        "transaction_id",
        "claim_id",
        "policy_id",
        "eligibility_id",
    ]
    for field in id_fields:
        value = raw_row.get(field)
        if value and str(value).strip():
            return f"{source_file}:{str(value).strip()}"
    return f"{source_file}:row-{row_index + 1}"


# ---------------------------------------------------------------------
# NORMALIZATION HELPERS
# ---------------------------------------------------------------------

def is_blank(value):
    return value is None or not str(value).strip()


def normalize_name(name):
    if is_blank(name):
        return ""
    return str(name).strip().upper()


def normalize_email(email):
    if is_blank(email):
        return ""
    email = str(email).strip().lower()

    if "@" in email:
        local, domain = email.split("@", 1)
        domain = EMAIL_TYPO_FIXES.get(domain, domain)
        email = f"{local}@{domain}"

    return email


def normalize_phone(phone):
    if is_blank(phone):
        return ""
    digits = re.sub(r"\D", "", str(phone))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return digits
    return digits


def normalize_address(address):
    if is_blank(address):
        return ""
    addr = str(address).strip()
    for pattern, expansion in ADDRESS_EXPANSIONS.items():
        addr = re.sub(pattern, expansion, addr, flags=re.IGNORECASE)
    return addr.title()


def normalize_upper(value):
    if is_blank(value):
        return ""
    return str(value).strip().upper()


def normalize_strip(value):
    if is_blank(value):
        return ""
    return str(value).strip()


def normalize_zip(value):
    if is_blank(value):
        return ""
    return str(value).strip()[:5]


def normalize_date(date_str):
    if is_blank(date_str):
        return ""

    date_str = str(date_str).strip()

    if re.match(r"^\d{4}-\d{2}-\d{2}", date_str):
        return date_str[:10]

    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", date_str)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})\s+.*$", date_str)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    return date_str


def normalize_timestamp(value):
    if is_blank(value):
        return ""
    return str(value).strip()


def normalize_boolean(value):
    if is_blank(value):
        return ""
    v = str(value).strip().lower()

    truthy = {"true", "t", "yes", "y", "1"}
    falsy = {"false", "f", "no", "n", "0"}

    if v in truthy:
        return "true"
    if v in falsy:
        return "false"
    return str(value).strip()


def normalize_integer(value):
    if is_blank(value):
        return ""
    raw = str(value).strip().replace(",", "")
    try:
        num = float(raw)
        return str(int(num))
    except ValueError:
        return raw


def normalize_decimal(value):
    if is_blank(value):
        return ""
    raw = str(value).strip().replace(",", "").replace("$", "")
    try:
        num = float(raw)
        if num.is_integer():
            return str(int(num))
        return f"{num:.2f}"
    except ValueError:
        return raw


# ---------------------------------------------------------------------
# NORMALIZATION MAP
# ---------------------------------------------------------------------

NORMALIZERS = {
    "first_name": normalize_name,
    "last_name": normalize_name,
    "full_name": normalize_name,
    "email": normalize_email,
    "phone": normalize_phone,
    "address": normalize_address,
    "shipping_address": normalize_address,
    "city": normalize_upper,
    "state": normalize_upper,
    "shipping_city": normalize_upper,
    "shipping_state": normalize_upper,
    "zip": normalize_zip,
    "shipping_zip": normalize_zip,
    "dob": normalize_date,
    "signup_date": normalize_date,
    "created_date": normalize_date,
    "updated_date": normalize_date,
    "resolved_date": normalize_date,
    "send_date": normalize_date,
    "order_date": normalize_date,
    "billing_date": normalize_date,
    "enrolled_date": normalize_date,
    "last_activity_date": normalize_date,
    "event_date": normalize_date,

    "session_start": normalize_timestamp,
    "session_start_time": normalize_timestamp,
    "session_end": normalize_timestamp,
    "event_timestamp": normalize_timestamp,
    "open_date": normalize_timestamp,
    "click_date": normalize_timestamp,
    "unsubscribe_date": normalize_timestamp,
    "stream_started_at": normalize_timestamp,
    "stream_ended_at": normalize_timestamp,
    "last_login_at": normalize_timestamp,
    "converted_at": normalize_timestamp,

    "record_id": normalize_strip,
    "username": normalize_strip,
    "oauth_user_id": normalize_strip,
    "venue_id": normalize_strip,

    "email_bounce_type": normalize_upper,
    "campaign_name": normalize_strip,
    "click_url": normalize_strip,

    "fan_account_id": normalize_strip,
    "ticketing_account_id": normalize_strip,
    "ticket_account_id": normalize_strip,
    "loyalty_member_id": normalize_strip,
    "commerce_customer_id": normalize_strip,
    "streaming_account_id": normalize_strip,
    "fantasy_account_id": normalize_strip,
    "ticket_order_id": normalize_strip,
    "commerce_order_id": normalize_strip,
    "campaign_event_id": normalize_strip,
    "campaign_id": normalize_strip,
    "digital_session_id": normalize_strip,
    "streaming_session_id": normalize_strip,
    "authenticated_user_id": normalize_strip,
    "linked_fan_account_id": normalize_strip,
    "linked_ticketing_account_id": normalize_strip,
    "resolved_profile_id": normalize_strip,
    "original_purchaser_account_id": normalize_strip,

    "gender_code": normalize_upper,
    "favorite_team_code": normalize_upper,
    "primary_team_code": normalize_upper,
    "oauth_provider_code": normalize_upper,
    "consent_status_code": normalize_upper,
    "recipient_id_type": normalize_upper,
    "source_system_code": normalize_upper,
    "channel_code": normalize_upper,
    "delivery_status_code": normalize_upper,
    "device_os_code": normalize_upper,
    "session_context_code": normalize_upper,
    "platform_code": normalize_upper,
    "platform_name": normalize_upper,
    "away_team_code": normalize_upper,
    "home_team_code": normalize_upper,
    "content_type_code": normalize_upper,
    "device_type_code": normalize_upper,
    "geo_ip_city": normalize_upper,
    "geo_ip_state_code": normalize_upper,
    "platform_os_code": normalize_upper,
    "subscription_tier_code": normalize_upper,
    "delivery_method_code": normalize_upper,
    "purchase_channel_code": normalize_upper,
    "promo_code": normalize_upper,
    "row_label": normalize_upper,
    "section_code": normalize_upper,
    "ticket_type": normalize_upper,
    "order_status_code": normalize_upper,
    "referral_channel_code": normalize_upper,
    "payment_method_code": normalize_upper,
    "membership_tier": normalize_upper,
    "account_type_code": normalize_upper,
    "preferred_contest_format": normalize_upper,
    "kyc_document_type": normalize_upper,
    "conversion_event_type": normalize_upper,
    "device_type": normalize_upper,
    "device_platform": normalize_upper,
    "content_type": normalize_upper,
    "team": normalize_upper,
    "status": normalize_upper,
    "priority": normalize_upper,
    "subscription_tier": normalize_upper,
    "account_status": normalize_upper,
    "payment_method": normalize_upper,
    "order_status": normalize_upper,
    "email_client": normalize_upper,
    "ab_test_variant": normalize_upper,

    "team_id": normalize_strip,
    "product_category_list": normalize_strip,
    "product_sku_list": normalize_strip,
    "referral_source": normalize_strip,
    "kyc_document_hash": normalize_strip,
    "sport_list": normalize_strip,
    "screen_path_sequence": normalize_strip,
    "profile_name": normalize_strip,
    "registration_source": normalize_strip,
    "campaign_objective": normalize_strip,
    "event_id_context": normalize_strip,
    "referral_campaign_id": normalize_strip,
    "device_model": normalize_strip,
    "user_agent": normalize_strip,
    "ip_address": normalize_strip,
    "category": normalize_strip,
    "item": normalize_strip,
    "player_affinity_id": normalize_strip,
    "state_of_residence": normalize_strip,
    "personalization_tier": normalize_strip,

    "quantity": normalize_integer,
    "ticket_count": normalize_integer,
    "item_count": normalize_integer,
    "active_team_count": normalize_integer,
    "current_point_balance": normalize_integer,
    "lifetime_points_earned": normalize_integer,
    "lifetime_points_redeemed": normalize_integer,
    "lifetime_contest_count": normalize_integer,
    "content_item_count": normalize_integer,
    "attribution_window_days": normalize_integer,
    "concurrent_stream_count": normalize_integer,
    "fan_since_year": normalize_integer,

    "item_price": normalize_decimal,
    "billing_amount": normalize_decimal,
    "transaction_amount": normalize_decimal,
    "face_value_amount": normalize_decimal,
    "order_total_amount": normalize_decimal,
    "discount_amount": normalize_decimal,
    "shipping_amount": normalize_decimal,
    "subtotal_amount": normalize_decimal,
    "conversion_amount": normalize_decimal,
    "lifetime_entry_fee_amount": normalize_decimal,
    "lifetime_winnings_amount": normalize_decimal,
    "completion_pct": normalize_decimal,
    "primary_team_affinity": normalize_decimal,
    "satisfaction_score": normalize_decimal,

    "is_live": normalize_boolean,
    "opened": normalize_boolean,
    "clicked": normalize_boolean,
    "unsubscribed": normalize_boolean,
    "is_guest": normalize_boolean,
    "is_opt_in_email": normalize_boolean,
    "is_opt_in_push": normalize_boolean,
    "is_opt_in_sms": normalize_boolean,
    "is_send_time_optimized": normalize_boolean,
    "is_live_game_feature_engaged": normalize_boolean,
    "is_location_permission_granted": normalize_boolean,
    "is_push_notification_opened": normalize_boolean,
    "is_push_notification_received": normalize_boolean,
    "is_ticket_purchase_initiated": normalize_boolean,
    "is_ticket_purchase_completed": normalize_boolean,
    "is_out_of_market": normalize_boolean,
    "is_primary_profile": normalize_boolean,
    "is_transferred": normalize_boolean,
    "is_gift": normalize_boolean,
    "is_geo_restricted": normalize_boolean,
    "is_kyc_completed": normalize_boolean,
    "is_self_excluded": normalize_boolean,
}


# ---------------------------------------------------------------------
# PROCESSING
# ---------------------------------------------------------------------

def preprocess_file(canonical_source_file, tag_mapping):
    filepath = resolve_input_filepath(canonical_source_file)
    if not filepath:
        print(f"  SKIP: {canonical_source_file} not found")
        return []

    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        raw_rows = list(reader)

    if not raw_rows:
        return []

    source_system = get_source_system(canonical_source_file)

    processed_rows = []
    column_aliases = get_column_aliases(source_system)

    for row_index, raw_row in enumerate(raw_rows):
        new_row = {
            "source_file": canonical_source_file,
            "source_system": source_system,
        }

        for orig_col, value in raw_row.items():
            canonical = column_aliases.get(orig_col, tag_mapping.get(orig_col, orig_col))

            normalizer = NORMALIZERS.get(canonical)
            if normalizer:
                value = normalizer(value)
            else:
                value = normalize_strip(value)

            new_row[canonical] = value

        if not new_row.get("record_id"):
            new_row["record_id"] = build_record_id(canonical_source_file, raw_row, row_index)

        if source_system == "automotive":
            raw_record_id = str(new_row.get("record_id", "")).strip()
            source_record_id = raw_record_id.split(":", 1)[1] if ":" in raw_record_id else raw_record_id
            new_row["source_record_id"] = new_row.get("source_record_id") or source_record_id
            new_row["record_id"] = f"{canonical_source_file}:{source_record_id}:row-{row_index + 1}"

        processed_rows.append(new_row)

    return processed_rows


def write_csv(filepath, rows):
    if not rows:
        return

    parent = os.path.dirname(filepath)
    if parent:
        os.makedirs(parent, exist_ok=True)

    fieldnames = list(rows[0].keys())
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_union_csv(filepath, rows):
    if not rows:
        return

    parent = os.path.dirname(filepath)
    if parent:
        os.makedirs(parent, exist_ok=True)

    all_columns = set()
    for row in rows:
        all_columns.update(row.keys())
    all_columns = sorted(all_columns)

    for row in rows:
        for col in all_columns:
            if col not in row:
                row[col] = ""

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=all_columns)
        writer.writeheader()
        writer.writerows(rows)


def get_files_to_process(tag_mappings, selected_source_systems):
    """Return only config-governed inputs for the selected source systems.

    ``tag_mappings`` is an enrichment artifact, not a source inventory.  It can
    legitimately retain keys from an older deployment, so allowing its extra
    keys to expand the run would reintroduce retired or optional source tables.
    """
    ordered = []
    seen = set()

    expected_files = get_expected_canonical_files(selected_source_systems)

    for source_file in expected_files:
        if source_file not in seen:
            ordered.append(source_file)
            seen.add(source_file)

    return ordered


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main():
    args = parse_args()
    selected_source_systems = get_selected_source_systems(args.source_systems)
    return build_preprocessing_service().run(selected_source_systems)

    print("=== Step 2: Preprocessing ===\n")

    if not os.path.exists(TAG_MAPPINGS_FILE):
        print(f"ERROR: {TAG_MAPPINGS_FILE} not found. Run step1_semantic_tagging.py first.")
        return

    with open(TAG_MAPPINGS_FILE, "r", encoding="utf-8") as f:
        tag_mappings = json.load(f)

    print(f"Selected source systems: {', '.join(selected_source_systems)}\n")

    source_files = get_files_to_process(tag_mappings, selected_source_systems)
    print(source_files)
    all_rows_by_system = {system: [] for system in selected_source_systems}

    for source_file in source_files:
        mapping = tag_mappings.get(source_file, {})
        source_system = get_source_system(source_file)
        if not mapping and source_system != "automotive":
            print(f"  SKIP: No tag mapping for {source_file}")
            continue

        rows = preprocess_file(source_file, mapping)
        print(f"  {source_file}: {len(rows)} rows preprocessed")

        system_dir = os.path.join(OUTPUT_DIR, source_system)
        out_path = os.path.join(system_dir, f"preprocessed_{source_file}")
        write_csv(out_path, rows)

        all_rows_by_system.setdefault(source_system, []).extend(rows)

    for source_system, rows in all_rows_by_system.items():
        if not rows:
            continue

        system_dir = os.path.join(OUTPUT_DIR, source_system)
        union_path = os.path.join(system_dir, "all_preprocessed.csv")
        write_union_csv(union_path, rows)

        all_columns = set()
        for row in rows:
            all_columns.update(row.keys())

        print(
            f"\n  {source_system}/all_preprocessed.csv: "
            f"{len(rows)} total rows, {len(all_columns)} columns"
        )

    print("\n=== Preprocessing complete! ===")


if __name__ == "__main__":
    main()
