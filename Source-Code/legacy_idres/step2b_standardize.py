"""
Step 2b — Standardization & Cleaning
Applies rule-based standardization to preprocessed data:
  - Email: lowercase, fix domain typos, preserve plus addressing, exclude generic patterns
  - Phone: strip country code, remove non-digits, normalize to 10 digits
  - Name: uppercase, preserve nicknames/abbreviations
  - Address: uppercase, expand abbreviations (St->Street, Ave->Avenue, etc.) using usaddress
  - Birthdate / date fields: parse multiple formats -> ISO-8601 (YYYY-MM-DD)
  - Postal: strip ZIP+4, zero-pad to 5 digits

Supports MULTIPLE source systems (media + sports + automotive).
User can control which source systems to process via:
    --source-systems media
    --source-systems sports
    --source-systems media,sports,automotive

Output:
  - standardized individual CSVs
  - standardized_data/media/all_standardized.csv
  - standardized_data/sports/all_standardized.csv
  - standardized_data/automotive/all_standardized.csv
"""

import argparse
import csv
import os
import re
from datetime import datetime
from services.pipeline_base import PipelineStepContext
from services.standardization_service import StandardizationService
import pipeline_uc_bootstrap  # noqa: F401

from legacy_pipeline_config import (
    default_source_systems,
    pipeline_directory,
    standardization_source_files,
)

INPUT_DIR = pipeline_directory("preprocessed_data", "preprocessed_data")
OUTPUT_DIR = pipeline_directory("standardized_data", "standardized_data")
DEFAULT_SOURCE_SYSTEMS = default_source_systems()


try:
    import usaddress
    _USADDRESS_AVAILABLE = True
except ImportError:
    _USADDRESS_AVAILABLE = False

try:
    from email_typo_fixer import normalize_email as fix_email_typo
    _EMAIL_FIXER_AVAILABLE = True
except ImportError:
    _EMAIL_FIXER_AVAILABLE = False

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------
# SOURCE FILES
# ---------------------------------------------------------------------


def _csv_name(value):
    text = str(value)
    return text if text.lower().endswith(".csv") else f"{text}.csv"


# Keep preprocessing and standardization on the same config-backed registry.
# A hard-coded copy previously omitted the Sports campaign-events input and
# silently published a seven-table aggregate.
SOURCE_SYSTEM_FILES = {
    source: [_csv_name(filename) for filename in files]
    for source, files in standardization_source_files().items()
}

VALID_SOURCE_SYSTEMS = set(SOURCE_SYSTEM_FILES.keys())

# Generic / throwaway email patterns to exclude from matching keys
GENERIC_EMAIL_PATTERNS = [
    r"^noreply@",
    r"^no-reply@",
    r"^donotreply@",
    r"^do-not-reply@",
    r"^info@",
    r"^admin@",
    r"^support@",
    r"^test@",
    r"^example@",
    r"@example\.com$",
    r"@test\.com$",
]

# Street type expansions
STREET_TYPE_MAP = {
    "st": "STREET",
    "st.": "STREET",
    "str": "STREET",
    "ave": "AVENUE",
    "ave.": "AVENUE",
    "av": "AVENUE",
    "blvd": "BOULEVARD",
    "blvd.": "BOULEVARD",
    "dr": "DRIVE",
    "dr.": "DRIVE",
    "ln": "LANE",
    "ln.": "LANE",
    "ct": "COURT",
    "ct.": "COURT",
    "pl": "PLACE",
    "pl.": "PLACE",
    "rd": "ROAD",
    "rd.": "ROAD",
    "cir": "CIRCLE",
    "cir.": "CIRCLE",
    "wy": "WAY",
    "pkwy": "PARKWAY",
    "pkwy.": "PARKWAY",
    "hwy": "HIGHWAY",
    "hwy.": "HIGHWAY",
    "trl": "TRAIL",
    "trl.": "TRAIL",
    "ter": "TERRACE",
    "ter.": "TERRACE",
}

# Directional expansions
DIRECTIONAL_MAP = {
    "n": "NORTH",
    "n.": "NORTH",
    "s": "SOUTH",
    "s.": "SOUTH",
    "e": "EAST",
    "e.": "EAST",
    "w": "WEST",
    "w.": "WEST",
    "ne": "NORTHEAST",
    "nw": "NORTHWEST",
    "se": "SOUTHEAST",
    "sw": "SOUTHWEST",
}

# Unit type expansions
UNIT_TYPE_MAP = {
    "apt": "APARTMENT",
    "apt.": "APARTMENT",
    "ste": "SUITE",
    "ste.": "SUITE",
    "unit": "UNIT",
    "fl": "FLOOR",
    "fl.": "FLOOR",
    "rm": "ROOM",
    "rm.": "ROOM",
    "bldg": "BUILDING",
    "bldg.": "BUILDING",
}

# Counters for reporting
stats = {
    "email_fixed_typo": 0,
    "email_stripped_tag": 0,   # kept for compatibility/reporting
    "email_plus_tag_preserved": 0,
    "email_excluded_generic": 0,
    "email_fixed_dots": 0,
    "phone_normalized": 0,
    "phone_stripped_country": 0,
    "name_uppercased": 0,
    "address_expanded": 0,
    "address_parsed_usaddress": 0,
    "date_reformatted": 0,
    "zip_stripped_plus4": 0,
    "zip_zero_padded": 0,
}


def build_standardization_service():
    return StandardizationService(
        context=PipelineStepContext(
            source_systems=sorted(VALID_SOURCE_SYSTEMS),
            default_source_systems=DEFAULT_SOURCE_SYSTEMS,
        ),
        input_dir=INPUT_DIR,
        output_dir=OUTPUT_DIR,
        stats=stats,
        get_files_to_process=get_files_to_process,
        expected_files_by_system=SOURCE_SYSTEM_FILES,
        standardize_file=standardize_file,
        get_source_system=get_source_system,
        write_csv=write_csv,
        write_union_csv=write_union_csv,
        join_path=os.path.join,
        makedirs=os.makedirs,
        union_filename="all_standardized.csv",
    )


# ---------------------------------------------------------------------
# ARGUMENT PARSING / SOURCE SYSTEM CONTROL
# ---------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Step 2b — Standardization & Cleaning for selected source systems."
    )
    parser.add_argument(
        "--source-systems",
        default=",".join(DEFAULT_SOURCE_SYSTEMS),
        help="Comma-separated list of source systems to process. "
             "Allowed values: media, sports, automotive. Default: media,sports,automotive"
    )
    return parser.parse_args()


def get_selected_source_systems(raw_value):
    selected = [s.strip().lower() for s in raw_value.split(",") if s.strip()]

    invalid = [s for s in selected if s not in VALID_SOURCE_SYSTEMS]
    if invalid:
        raise ValueError(
            f"Invalid source system(s): {invalid}. "
            f"Allowed values: {sorted(VALID_SOURCE_SYSTEMS)}"
        )

    if not selected:
        return DEFAULT_SOURCE_SYSTEMS

    return selected


# ---------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------

def is_blank(value):
    return value is None or not str(value).strip()


def get_source_system(filename):
    """Infer source system from standardized/preprocessed file name."""
    for system, files in SOURCE_SYSTEM_FILES.items():
        if filename in files:
            return system

    if "med_" in filename:
        return "media"
    if "spt_" in filename:
        return "sports"
    if "aut_" in filename:
        return "automotive"

    return "unknown"


def get_files_to_process(selected_source_systems):
    """Resolve only the config-governed preprocessed inputs for each source.

    Old per-table outputs can remain in the artifact store after a source
    registry changes.  They must not silently expand a later standardized
    union beyond the current governed identity inputs.
    """
    ordered = []
    seen = set()

    for system in selected_source_systems:
        configured = SOURCE_SYSTEM_FILES.get(system, [])
        for filename in configured:
            path = os.path.join(INPUT_DIR, system, filename)   #  FIX HERE

            if os.path.exists(path) and filename not in seen:
                ordered.append((system, filename))   #  store system too
                seen.add(filename)
            else:
                print(f" Missing: {path}")

    return ordered


# ---------------------------------------------------------------------
# EMAIL STANDARDIZATION
# ---------------------------------------------------------------------

def standardize_email(email):
    """Lowercase, fix typos, preserve +tags, exclude generics, then uppercase."""
    if is_blank(email):
        return ""

    email = str(email).strip()

    if "@" in email:
        local_part, domain_part = email.split("@", 1)
        bare_domains = {
            "yahoo", "gmail", "outlook", "hotmail", "aol",
            "icloud", "protonmail", "zoho", "yandex", "mail"
        }
        if domain_part.strip().lower() in bare_domains:
            email = f"{local_part}@{domain_part.strip()}.com"

    if _EMAIL_FIXER_AVAILABLE:
        original = email
        original_plus_tag = ""
        if "@" in original:
            original_local, _ = original.split("@", 1)
            if "+" in original_local:
                original_plus_tag = original_local.split("+", 1)[1]
        email = fix_email_typo(email)
        if original_plus_tag and "@" in email:
            fixed_local, fixed_domain = email.split("@", 1)
            if "+" not in fixed_local:
                email = f"{fixed_local}+{original_plus_tag}@{fixed_domain}"
        if email != original:
            stats["email_fixed_typo"] += 1

    if "@" in email:
        local_part, domain_part = email.split("@", 1)
        cc_match = re.match(r"^(.+)\.(com|co|net|org)\.([a-zA-Z]{2})$", domain_part)
        if cc_match:
            base_domain = cc_match.group(1)
            email = f"{local_part}@{base_domain}.com"

    if "@" in email:
        local_part, domain_part = email.split("@", 1)
        dot_fix = re.match(r"^([a-zA-Z.]+?)(\d+)$", local_part)
        if dot_fix:
            alpha_part = dot_fix.group(1)
            digits = dot_fix.group(2)
            segments = [s for s in alpha_part.split(".") if s]

            if len(segments) >= 3:
                first = "".join(segments)
                last = ""
                candidates_splits = []

                for split_at in range(1, len(segments)):
                    cf = "".join(segments[:split_at])
                    cl = "".join(segments[split_at:])
                    if len(cf) >= 3 and len(cl) >= 3:
                        candidates_splits.append(
                            (split_at, cf, cl, len(segments[0]) >= 3 and split_at == 1)
                        )

                if candidates_splits:
                    intact = [c for c in candidates_splits if c[3] and len(segments[1]) >= 2]
                    if intact:
                        _, first, last, _ = intact[0]
                    elif len(segments[0]) >= 3:
                        first = segments[0]
                        last = "".join(segments[1:])
                    else:
                        _, first, last, _ = candidates_splits[-1]

                if last:
                    fixed_local = f"{first}.{last}{digits}"
                else:
                    fixed_local = f"{first}{digits}"

                if fixed_local != local_part:
                    stats["email_fixed_dots"] += 1
                    local_part = fixed_local

        email = f"{local_part}@{domain_part}"

    email = email.lower()

    # Existing behavior preserved: +tags are NOT stripped
    if "@" in email and "+" in email.split("@", 1)[0]:
        stats["email_plus_tag_preserved"] += 1

    for pattern in GENERIC_EMAIL_PATTERNS:
        if re.search(pattern, email):
            stats["email_excluded_generic"] += 1
            return "[EXCLUDED]"

    return email.upper()


# ---------------------------------------------------------------------
# PHONE STANDARDIZATION
# ---------------------------------------------------------------------

def standardize_phone(phone):
    """Strip country code, remove non-digits, normalize to 10 digits."""
    if is_blank(phone):
        return ""

    raw = str(phone).strip()
    digits = re.sub(r"\D", "", raw)

    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
        stats["phone_stripped_country"] += 1

    if len(digits) == 8 and digits.startswith("1"):
        digits = digits[1:]

    if len(digits) == 7:
        area = digits[:3]
        line = digits[3:]
        exchange = 200 + (int(line or "0") % 700)
        stats["phone_normalized"] += 1
        return f"{area}-{exchange:03d}-{line}"

    if len(digits) == 10:
        stats["phone_normalized"] += 1
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"

    return digits


# ---------------------------------------------------------------------
# NAME STANDARDIZATION
# ---------------------------------------------------------------------

def standardize_name(name):
    if is_blank(name):
        return ""
    name = str(name).strip().upper()
    stats["name_uppercased"] += 1
    return name


# ---------------------------------------------------------------------
# ADDRESS STANDARDIZATION
# ---------------------------------------------------------------------

def expand_address_component(word, component_type):
    word_lower = word.lower().rstrip(".")

    if component_type == "StreetNamePostType":
        expanded = STREET_TYPE_MAP.get(word_lower, STREET_TYPE_MAP.get(word_lower + ".", None))
        if expanded:
            return expanded

    elif component_type in ("StreetNamePreDirectional", "StreetNamePostDirectional"):
        expanded = DIRECTIONAL_MAP.get(word_lower, DIRECTIONAL_MAP.get(word_lower + ".", None))
        if expanded:
            return expanded

    elif component_type == "OccupancyType":
        expanded = UNIT_TYPE_MAP.get(word_lower, UNIT_TYPE_MAP.get(word_lower + ".", None))
        if expanded:
            return expanded

    return word.upper()


def _fallback_address_expand(address):
    words = address.split()
    result = []
    for word in words:
        word_lower = word.lower().rstrip(".")
        expanded = (
            STREET_TYPE_MAP.get(word_lower)
            or STREET_TYPE_MAP.get(word_lower + ".")
            or DIRECTIONAL_MAP.get(word_lower)
            or DIRECTIONAL_MAP.get(word_lower + ".")
            or UNIT_TYPE_MAP.get(word_lower)
            or UNIT_TYPE_MAP.get(word_lower + ".")
        )
        result.append(expanded if expanded else word.upper())

    stats["address_expanded"] += 1
    joined = " ".join(result)
    joined = re.sub(r"[.,;:!?]+(\s|$)", r"\1", joined).strip()
    return joined


def standardize_address(address):
    if is_blank(address):
        return ""

    address = str(address).strip()

    if not _USADDRESS_AVAILABLE:
        return _fallback_address_expand(address)

    try:
        parsed, _addr_type = usaddress.tag(address)
        parts = []
        for label, value in parsed.items():
            expanded = expand_address_component(value, label)
            parts.append(expanded)
        result = " ".join(parts)
        result = re.sub(r"[.,;:!?]+(\s|$)", r"\1", result).strip()
        stats["address_parsed_usaddress"] += 1
        stats["address_expanded"] += 1
        return result
    except usaddress.RepeatedLabelError:
        return _fallback_address_expand(address)


# ---------------------------------------------------------------------
# DATE STANDARDIZATION
# ---------------------------------------------------------------------

DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%m/%d/%Y",
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %I:%M:%S %p",
    "%m/%d/%Y %I:%M %p",
    "%m-%d-%Y",
    "%d-%b-%Y",
    "%d %b %Y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%Y%m%d",
]


def standardize_date(date_str):
    if is_blank(date_str):
        return ""

    date_str = str(date_str).strip()

    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return date_str

    if re.match(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}", date_str):
        stats["date_reformatted"] += 1
        return date_str[:10]

    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(date_str, fmt)
            stats["date_reformatted"] += 1
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    if re.match(r"^\d{8}$", date_str):
        try:
            dt = datetime.strptime(date_str, "%Y%m%d")
            stats["date_reformatted"] += 1
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return date_str


# ---------------------------------------------------------------------
# ZIP STANDARDIZATION
# ---------------------------------------------------------------------

def standardize_zip(zipcode):
    if is_blank(zipcode):
        return ""

    z = str(zipcode).strip()

    if "-" in z:
        z = z.split("-")[0]
        stats["zip_stripped_plus4"] += 1

    z = re.sub(r"\D", "", z)

    if len(z) > 5:
        z = z[:5]

    if 0 < len(z) < 5:
        stats["zip_zero_padded"] += 1
        z = z.zfill(5)

    return z


# ---------------------------------------------------------------------
# FIELD-TO-STANDARDIZER MAPPING
# ---------------------------------------------------------------------

STANDARDIZERS = {
    "email": standardize_email,
    "phone": standardize_phone,

    "full_name": standardize_name,
    "first_name": standardize_name,
    "last_name": standardize_name,

    "address": standardize_address,
    "shipping_address": standardize_address,

    "city": lambda x: x.strip().upper() if x and x.strip() else "",
    "state": lambda x: x.strip().upper() if x and x.strip() else "",
    "shipping_city": lambda x: x.strip().upper() if x and x.strip() else "",
    "shipping_state": lambda x: x.strip().upper() if x and x.strip() else "",

    "zip": standardize_zip,
    "shipping_zip": standardize_zip,

    "dob": standardize_date,
    "date_of_birth": standardize_date,
    "signup_date": standardize_date,
    "created_date": standardize_date,
    "resolved_date": standardize_date,
    "send_date": standardize_date,
    "order_date": standardize_date,
    "billing_date": standardize_date,
    "session_start": standardize_date,
    "event_timestamp": standardize_date,
    "open_date": standardize_date,

    # additional safe date fields
    "updated_date": standardize_date,
    "click_date": standardize_date,
    "unsubscribe_date": standardize_date,
    "session_end": standardize_date,
    "stream_started_at": standardize_date,
    "stream_ended_at": standardize_date,
    "last_login_at": standardize_date,
    "converted_at": standardize_date,
    "enrolled_date": standardize_date,
    "last_activity_date": standardize_date,
    "event_date": standardize_date,
}


# ---------------------------------------------------------------------
# PROCESSING
# ---------------------------------------------------------------------


def standardize_file(system, filename):
    filepath = os.path.join(INPUT_DIR, system, filename)
    if not os.path.exists(filepath):
        print(f"  SKIP: {filepath} not found")
        return []

    with open(filepath, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        return []

    standardized = []
    for row in rows:
        new_row = {}
        for col, value in row.items():
            standardizer = STANDARDIZERS.get(col)
            if standardizer and value and value.strip():
                new_row[col] = standardizer(value)
            else:
                new_row[col] = value
        standardized.append(new_row)

    return standardized


def write_csv(filepath, rows):
    if not rows:
        return

    fieldnames = list(rows[0].keys())
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_union_csv(filepath, rows):
    if not rows:
        return

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


def main():
    args = parse_args()

    try:
        selected_source_systems = get_selected_source_systems(args.source_systems)
    except ValueError as e:
        print(f"ERROR: {e}")
        return

    return build_standardization_service().run(selected_source_systems)

    print("=== Step 2b: Standardization & Cleaning ===\n")
    print(f"Selected source systems: {', '.join(selected_source_systems)}\n")

    print("Rules applied:")
    print("  Email  : lowercase -> fix domain typos -> preserve +tags -> exclude generics -> UPPERCASE")
    print("  Phone  : strip +1 country code -> remove non-digits -> 10 digits")
    print("  Name   : UPPERCASE (nicknames preserved for Jaro-Winkler)")
    print("  Address: parse with usaddress -> expand abbreviations -> UPPERCASE")
    print("  Date   : parse multiple formats -> ISO-8601 (YYYY-MM-DD)")
    print("  Postal : strip ZIP+4 -> zero-pad to 5 digits")
    print()

    files_to_process = get_files_to_process(selected_source_systems)
    print(files_to_process)
    if not files_to_process:
        print(f"No matching preprocessed CSV files found in {INPUT_DIR} for {selected_source_systems}")
        return

    all_rows_by_system = {system: [] for system in selected_source_systems}

    for system,filename in files_to_process:
        rows = standardize_file(system,filename)
        print(f"  {filename}: {len(rows)} rows standardized")

        
        source_system = get_source_system(filename)

        system_dir = os.path.join(OUTPUT_DIR, source_system)
        os.makedirs(system_dir, exist_ok=True)

        out_filename = filename.replace("preprocessed_", "standardized_")
        out_path = os.path.join(system_dir, out_filename)
        write_csv(out_path, rows)

        if source_system in all_rows_by_system:
            all_rows_by_system[source_system].extend(rows)

    # Write separate union file only for selected source systems
    for source_system in selected_source_systems:
        rows = all_rows_by_system.get(source_system, [])
        if not rows:
            continue

        system_dir = os.path.join(OUTPUT_DIR, source_system)
        os.makedirs(system_dir, exist_ok=True)

        union_path = os.path.join(system_dir, "all_standardized.csv")
        write_union_csv(union_path, rows)

        all_columns = set()
        for row in rows:
            all_columns.update(row.keys())

        print(
            f"\n  {source_system}/all_standardized.csv: "
            f"{len(rows)} total rows, {len(all_columns)} columns"
        )

    print("\nStandardization stats:")
    print(
        f"  Emails  - typos fixed: {stats['email_fixed_typo']}, "
        f"+tags preserved: {stats['email_plus_tag_preserved']}, "
        f"generics excluded: {stats['email_excluded_generic']}, "
        f"dot-fixes: {stats['email_fixed_dots']}"
    )
    print(
        f"  Phones  - normalized to 10 digits: {stats['phone_normalized']}, "
        f"country code stripped: {stats['phone_stripped_country']}"
    )
    print(f"  Names   - uppercased: {stats['name_uppercased']}")
    print(
        f"  Address - parsed via usaddress: {stats['address_parsed_usaddress']}, "
        f"expanded: {stats['address_expanded']}"
    )
    print(f"  Dates   - reformatted: {stats['date_reformatted']}")
    print(
        f"  ZIP     - stripped +4: {stats['zip_stripped_plus4']}, "
        f"zero-padded: {stats['zip_zero_padded']}"
    )

    print("\n=== Standardization complete! ===")


if __name__ == "__main__":
    main()
