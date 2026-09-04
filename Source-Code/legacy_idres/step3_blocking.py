"""
Step 3 — Blocking & Matching
Reads standardized data + blocking_config.json.
Builds blocking keys from configurable rule chains,
scores candidate pairs, outputs matched pairs.

Supports user-controlled source-system execution:
    --source-systems media
    --source-systems sports
    --source-systems automotive
    --source-systems media,sports
    --source-systems media,sports,automotive

Input:
    standardized_data/<source_system>/all_standardized.csv

Output:
    matching_output/<source_system>/candidate_pairs.csv

Optional config scoping:
    Any entry in `blocking_rules` or `tags` may carry a `"source_system": [...]`
    list. If present, the rule/tag is only used when the current run targets
    one of those systems. Omit the key to apply to all systems.

Supports nested config structure:
{
  "media": {...},
  "sports": {...},
  "automotive": {...}
}
"""

import argparse
import csv
import json
import os
from collections import defaultdict
from itertools import combinations
from services.matching_service import MatchingService
from services.pipeline_base import PipelineStepContext
import pipeline_uc_bootstrap  # noqa: F401

from legacy_pipeline_config import (
    blocking_rules as configured_blocking_rules,
    blocking_tag_defaults,
    default_source_systems,
    pipeline_directory,
    source_systems as configured_source_systems,
)

INPUT_BASE_DIR = pipeline_directory("standardized_data", "standardized_data")
OUTPUT_BASE_DIR = pipeline_directory("matching_output", "matching_output")
SOURCE_SYSTEMS = configured_source_systems()
DEFAULT_SOURCE_SYSTEMS = default_source_systems()
DATASET_BLOCKING_RULES = {
    source: [(rule["name"], list(rule.get("tags") or [])) for rule in configured_blocking_rules(source)]
    for source in SOURCE_SYSTEMS
}
DATASET_TAG_DEFAULTS = blocking_tag_defaults()


CONFIG_FILE = "blocking_config.json"


def build_matching_service():
    return MatchingService(
        context=PipelineStepContext(
            source_systems=SOURCE_SYSTEMS,
            default_source_systems=DEFAULT_SOURCE_SYSTEMS,
        ),
        config_file=CONFIG_FILE,
        path_exists=os.path.exists,
        load_config=load_config,
        process_source_system=process_source_system,
    )





# ---------------------------------------------------------------------
# ARGUMENTS
# ---------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Step 3 — Blocking & Matching for selected source systems."
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
    invalid = [s for s in selected if s not in SOURCE_SYSTEMS]

    if invalid:
        raise ValueError(
            f"Invalid source system(s): {invalid}. "
            f"Allowed values: {SOURCE_SYSTEMS}"
        )

    return selected if selected else DEFAULT_SOURCE_SYSTEMS


def dataset_blocking_rules(source_system):
    rules = []
    for name, tags in DATASET_BLOCKING_RULES.get(source_system, []):
        rules.append({
            "name": name,
            "enabled": True,
            "source_system": [source_system],
            "chain": [{"tag": tag, "char_count": None} for tag in tags],
        })
    return rules


# ---------------------------------------------------------------------
# IO HELPERS
# ---------------------------------------------------------------------

def get_input_file(source_system):
    return os.path.join(INPUT_BASE_DIR, source_system, "all_standardized.csv")


def get_output_file(source_system):
    out_dir = os.path.join(OUTPUT_BASE_DIR, source_system)
    os.makedirs(out_dir, exist_ok=True)
    return os.path.join(out_dir, "candidate_pairs.csv")


def load_config():
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_records(input_file):
    with open(input_file, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------------
# CORE HELPERS
# ---------------------------------------------------------------------

def get_field_value(record, tag):
    """Extract a field value from a record, handling derived fields like first_name/last_name."""
    aliases = {
        "customer_id": [
            "customer_id", "commerce_customer_id", "subscriber_id",
            "authenticated_user_id", "resolved_profile_id",
        ],
        "fan_id": ["fan_id", "linked_fan_account_id", "player_affinity_id"],
        "account_id": [
            "account_id", "ticket_account_id", "linked_ticketing_account_id",
            "streaming_account_id", "oauth_user_id", "username",
        ],
        "loyalty_id": ["loyalty_id", "loyalty_member_id", "membership_id"],
        "date_of_birth": ["date_of_birth", "dob", "birth_date"],
        "zip": ["zip", "shipping_zip", "billing_zip"],
        "device_id": ["device_id", "advertising_id"],
    }

    if tag in aliases:
        for field in aliases[tag]:
            value = record.get(field, "").strip()
            if value:
                return value
        return ""

    if tag == "email_domain":
        email = get_field_value(record, "email")
        return email.split("@", 1)[1] if "@" in email else ""

    if tag == "first_name":
        full = record.get("full_name", "").strip()
        if record.get("first_name", "").strip():
            return record.get("first_name", "").strip()
        if not full:
            return ""
        parts = full.split()
        return parts[0] if parts else ""

    if tag == "last_name":
        full = record.get("full_name", "").strip()
        if record.get("last_name", "").strip():
            return record.get("last_name", "").strip()
        if not full:
            return ""
        parts = full.split()
        return parts[-1] if len(parts) > 1 else ""

    return record.get(tag, "").strip()


def build_blocking_key(record, chain):
    """
    Build a composite blocking key from a chain of tag+char_count pairs.
    Returns None if any tag in the chain has an empty value.
    """
    parts = []
    for link in chain:
        tag = link["tag"]
        char_count = link.get("char_count")

        value = get_field_value(record, tag)
        if not value:
            return None

        if char_count is not None:
            value = value[:char_count]

        parts.append(value.upper())

    return "||".join(parts)


def jaro_winkler(s1, s2):
    """Jaro-Winkler similarity between two strings."""
    if s1 == s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    s1_upper = s1.upper()
    s2_upper = s2.upper()

    len1 = len(s1_upper)
    len2 = len(s2_upper)

    match_distance = max(len1, len2) // 2 - 1
    if match_distance < 0:
        match_distance = 0

    s1_matches = [False] * len1
    s2_matches = [False] * len2

    matches = 0
    transpositions = 0

    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len2)
        for j in range(start, end):
            if s2_matches[j] or s1_upper[i] != s2_upper[j]:
                continue
            s1_matches[i] = True
            s2_matches[j] = True
            matches += 1
            break

    if matches == 0:
        return 0.0

    k = 0
    for i in range(len1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1_upper[i] != s2_upper[k]:
            transpositions += 1
        k += 1

    jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3

    prefix_len = 0
    for i in range(min(4, len1, len2)):
        if s1_upper[i] == s2_upper[i]:
            prefix_len += 1
        else:
            break

    return jaro + prefix_len * 0.1 * (1 - jaro)


def soundex(name):
    """Compute the Soundex code for a name."""
    if not name:
        return ""

    name = name.upper()
    code = name[0]

    mapping = {
        "B": "1", "F": "1", "P": "1", "V": "1",
        "C": "2", "G": "2", "J": "2", "K": "2", "Q": "2", "S": "2", "X": "2", "Z": "2",
        "D": "3", "T": "3",
        "L": "4",
        "M": "5", "N": "5",
        "R": "6",
    }

    prev = mapping.get(name[0], "0")
    for ch in name[1:]:
        digit = mapping.get(ch, "0")
        if digit != "0" and digit != prev:
            code += digit
        prev = digit
        if len(code) == 4:
            break

    return code.ljust(4, "0")


def compare_field(val1, val2, method, threshold):
    """Compare two values using the specified method. Returns (match_score, is_above_threshold)."""
    if not val1 or not val2:
        return 0.0, False

    if method == "exact":
        score = 1.0 if val1.upper() == val2.upper() else 0.0
        return score, score >= threshold

    if method == "jaro_winkler":
        score = jaro_winkler(val1, val2)
        return score, score >= threshold

    if method == "phonetic":
        if soundex(val1) == soundex(val2):
            return 1.0, True
        score = jaro_winkler(val1, val2)
        return score, score >= threshold

    return 0.0, False


def score_pair(rec1, rec2, tags_config):
    """Score a candidate pair across all configured tags. Returns (total_score, field_details, max_possible)."""
    total_score = 0.0
    max_possible = 0.0
    details = []

    for tag, cfg in tags_config.items():
        weight = cfg["weight"]
        method = cfg["comparison_method"]
        threshold = cfg["match_threshold"]

        val1 = get_field_value(rec1, tag)
        val2 = get_field_value(rec2, tag)

        if not val1 or not val2:
            continue

        max_possible += weight
        score, matched = compare_field(val1, val2, method, threshold)

        if matched:
            total_score += weight * score
            details.append(f"{tag}({score:.2f})")

    return total_score, details, max_possible



IDENTITY_FIELDS = {
    "email", "phone", "first_name", "last_name", "full_name", "address", "zip",
    "fan_account_id", "ticketing_account_id", "ticket_account_id",
    "loyalty_member_id", "commerce_customer_id", "streaming_account_id",
    "fantasy_account_id", "oauth_user_id", "authenticated_user_id",
    "resolved_profile_id", "username",
}
SUPPORTING_FIELDS = {"device_id", "ip_address", "advertising_id"}


def classify_edge(score, edge_tiers, matched_tags=None, primary_tag=None, **kwargs):
    """Classify edge into a tier based on score thresholds from config."""
    sorted_tiers = sorted(edge_tiers.items(), key=lambda x: -x[1]["min_score"])
    for tier_name, tier_cfg in sorted_tiers:
        if score >= tier_cfg["min_score"]:
            return tier_name
    return "unclassified"


def write_csv(filepath, rows):
    if not rows:
        return

    fieldnames = list(rows[0].keys())
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


# ---------------------------------------------------------------------
# PROCESSING PER SOURCE SYSTEM
# ---------------------------------------------------------------------

def process_source_system(source_system, config):
    input_file = get_input_file(source_system)
    output_file = get_output_file(source_system)

    if not os.path.exists(input_file):
        print(f"SKIP: Input not found for source system '{source_system}': {input_file}")
        return

    print(f"\n=== Processing source system: {source_system} ===\n")
    print(f"Input : {input_file}")
    print(f"Output: {output_file}\n")

    # -----------------------------------------------------------------
    # CHANGED: load config for this specific source system
    # -----------------------------------------------------------------
    system_config = config.get(source_system)
    if not system_config:
        print(f"SKIP: No config found for source system '{source_system}'")
        return

    # Scope rules and tags by source_system if the config entry opts in
    scoped_rules = [
        r for r in system_config.get("blocking_rules", [])
        if r.get("enabled", True)
        and (not r.get("source_system") or source_system in r["source_system"])
    ]

    has_dataset_scoped_rules = any(r.get("source_system") for r in scoped_rules)

    # CHANGED:
    # Prefer rules present under this source system config.
    # Only fall back to hardcoded dataset rules if config has none.
    blocking_rules = (
        scoped_rules
        if scoped_rules
        else dataset_blocking_rules(source_system)
    )

    tags_config = {
        tag: cfg for tag, cfg in system_config.get("tags", {}).items()
        if not cfg.get("source_system") or source_system in cfg["source_system"]
    }

    for rule in blocking_rules:
        for link in rule.get("chain", []):
            tag = link.get("tag")
            if tag and tag not in tags_config and tag in DATASET_TAG_DEFAULTS:
                tags_config[tag] = dict(DATASET_TAG_DEFAULTS[tag])

    # CHANGED: use source-specific edge tiers
    match_threshold = system_config.get("edge_tiers", {}).get("weak", {}).get("min_score", 40)

    # CHANGED: use source-specific skip settings
    global_skip_sources = set(system_config.get("skip_within_source_global", []))

    # CHANGED: use source-specific edge tiers
    edge_tiers = system_config.get("edge_tiers", {
        "exact": {"min_score": 80},
        "strong": {"min_score": 50},
        "weak": {"min_score": 25},
    })

    print(f"Loaded config: {len(tags_config)} tags, {len(blocking_rules)} enabled rules (for {source_system})")
    print(f"Match threshold: {match_threshold}")
    tier_desc = ", ".join(
        f"{k} (>= {v['min_score']})"
        for k, v in sorted(edge_tiers.items(), key=lambda x: -x[1]["min_score"])
    )
    print(f"Edge tiers: {tier_desc}\n")

    records = load_records(input_file)
    print(f"Loaded {len(records)} standardized records\n")

    if not records:
        print(f"No records found for source system '{source_system}'.")
        return

    record_map = {r["record_id"]: r for r in records if r.get("record_id")}

    all_candidate_pairs = set()
    pair_strategies = defaultdict(set)
    rule_stats = {}

    for rule in blocking_rules:
        rule_name = rule["name"]
        chain = rule["chain"]

        print(f"Building blocks for rule: '{rule_name}' (chain: {[c['tag'] for c in chain]})...")

        blocks = defaultdict(list)
        skipped = 0

        for record in records:
            record_id = record.get("record_id", "").strip()
            if not record_id:
                skipped += 1
                continue

            key = build_blocking_key(record, chain)
            if key is None:
                skipped += 1
                continue

            blocks[key].append(record_id)

        skip_within = set(rule.get("skip_within_source", []))
        skip_within.update(global_skip_sources)

        pairs_from_rule = 0
        for key, rid_list in blocks.items():
            if len(rid_list) < 2:
                continue

            chain_tags = set(c["tag"] for c in chain)
            max_block = 50 if chain_tags <= SUPPORTING_FIELDS else 500
            if len(rid_list) > max_block:
                continue

            for id1, id2 in combinations(rid_list, 2):
                if skip_within:
                    src1 = record_map.get(id1, {}).get("source_file", "")
                    src2 = record_map.get(id2, {}).get("source_file", "")
                    src1_base = src1.replace(".csv", "")
                    src2_base = src2.replace(".csv", "")
                    if src1_base == src2_base and src1_base in skip_within:
                        continue

                pair = (min(id1, id2), max(id1, id2))
                pair_strategies[pair].add(rule_name)
                if pair not in all_candidate_pairs:
                    all_candidate_pairs.add(pair)
                    pairs_from_rule += 1

        rule_stats[rule_name] = {
            "blocks": len(blocks),
            "non_singleton": sum(1 for v in blocks.values() if len(v) >= 2),
            "skipped_records": skipped,
            "pairs_generated": pairs_from_rule,
        }

        stats = rule_stats[rule_name]
        print(
            f"  Blocks: {stats['blocks']}, "
            f"Non-singleton: {stats['non_singleton']}, "
            f"Pairs: {stats['pairs_generated']}, "
            f"Skipped: {stats['skipped_records']}"
        )

    print(f"\nTotal unique candidate pairs: {len(all_candidate_pairs)}")
    print(f"\nScoring {len(all_candidate_pairs)} candidate pairs...")

    matched_pairs = []
    score_distribution = defaultdict(int)
    tier_counts = defaultdict(int)

    # CHANGED: use source-specific primary tag
    primary_tag = system_config.get("primary_tag", "")

    for i, (id1, id2) in enumerate(all_candidate_pairs):
        rec1 = record_map[id1]
        rec2 = record_map[id2]

        total_score, details, max_possible = score_pair(rec1, rec2, tags_config)

        bucket = int(total_score // 10) * 10
        score_distribution[bucket] += 1

        if total_score >= match_threshold:
            matched_tags = set(d.split("(")[0] for d in details)
            edge_type = classify_edge(
                total_score,
                edge_tiers,
                matched_tags=matched_tags,
                primary_tag=primary_tag
            )
            tier_counts[edge_type] += 1

            matched_pairs.append({
                "record_id_1": id1,
                "record_id_2": id2,
                "score": round(total_score, 2),
                "max_possible": round(max_possible, 2),
                "edge_type": edge_type,
                "matched_fields": "|".join(details),
                "blocking_strategy": "|".join(sorted(pair_strategies.get((id1, id2), []))),
                "source_1": rec1.get("source_file", ""),
                "source_2": rec2.get("source_file", ""),
                "source_system": source_system,
            })

        if (i + 1) % 100000 == 0:
            print(f"  Scored {i + 1}/{len(all_candidate_pairs)}...")

    matched_pairs.sort(key=lambda x: x["score"], reverse=True)

    # CHANGED: use source-specific capping settings
    MAX_PAIRS_PER_RECORD = system_config.get("max_pairs_per_record", 10)
    MAX_PER_SOURCE = system_config.get("max_pairs_per_record_per_source", 2)

    pair_count = defaultdict(int)
    src_pair_count = defaultdict(lambda: defaultdict(int))
    seen_pairs = set()
    capped_pairs = []

    for p in matched_pairs:
        r1, r2 = p["record_id_1"], p["record_id_2"]
        s1 = p.get("source_1", "").replace(".csv", "")
        s2 = p.get("source_2", "").replace(".csv", "")
        key = (r1, r2)

        if key in seen_pairs:
            continue

        if (
            pair_count[r1] < MAX_PAIRS_PER_RECORD and
            pair_count[r2] < MAX_PAIRS_PER_RECORD and
            src_pair_count[r1][s2] < MAX_PER_SOURCE and
            src_pair_count[r2][s1] < MAX_PER_SOURCE
        ):
            capped_pairs.append(p)
            seen_pairs.add(key)
            pair_count[r1] += 1
            pair_count[r2] += 1
            src_pair_count[r1][s2] += 1
            src_pair_count[r2][s1] += 1

    print(
        f"\nAfter per-source cap ({MAX_PER_SOURCE}/source, "
        f"{MAX_PAIRS_PER_RECORD} total max per record): {len(capped_pairs)} pairs"
    )
    matched_pairs = capped_pairs

    tier_counts = defaultdict(int)
    for p in matched_pairs:
        tier_counts[p["edge_type"]] += 1

    write_csv(output_file, matched_pairs)

    print(f"\nMatched pairs (score >= {match_threshold}): {len(matched_pairs)}")

    print("\nEdge tier breakdown:")
    sorted_tier_names = [t[0] for t in sorted(edge_tiers.items(), key=lambda x: -x[1]["min_score"])]
    for tier in sorted_tier_names:
        count = tier_counts.get(tier, 0)
        pct = count / len(matched_pairs) * 100 if matched_pairs else 0
        tier_cfg = edge_tiers.get(tier, {})
        print(f"  {tier:8s} (>= {tier_cfg.get('min_score', '?'):>3}): {count:>10,} ({pct:5.1f}%)")

    print("\nScore distribution (all candidates):")
    for bucket in sorted(score_distribution.keys()):
        count = score_distribution[bucket]
        label = f"  {bucket:3d}-{bucket+9:3d}"
        bar = "#" * min(count // 100, 50)
        print(f"{label}: {count:>8,}  {bar}")

    print("\nPer-rule stats:")
    for rule_name, stats in rule_stats.items():
        print(f"  {rule_name}: {stats['pairs_generated']} pairs from {stats['non_singleton']} blocks")

    if matched_pairs:
        for tier in sorted_tier_names:
            tier_pairs = [p for p in matched_pairs if p["edge_type"] == tier]
            if tier_pairs:
                print(f"\nSample {tier} matches:")
                for p in tier_pairs[:3]:
                    print(
                        f"  {p['record_id_1']} <-> {p['record_id_2']}  "
                        f"score={p['score']}  fields={p['matched_fields']}"
                    )

    print(f"\n=== Blocking & matching complete! Output: {output_file} ===")


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main():
    args = parse_args()

    try:
        selected_source_systems = get_selected_source_systems(args.source_systems)
    except ValueError as e:
        print(f"ERROR: {e}")
        return

    return build_matching_service().run(selected_source_systems)

    print("=== Step 3: Blocking & Matching ===\n")
    print(f"Selected source systems: {', '.join(selected_source_systems)}\n")

    if not os.path.exists(CONFIG_FILE):
        print(f"ERROR: {CONFIG_FILE} not found.")
        return

    config = load_config()

    for source_system in selected_source_systems:
        process_source_system(source_system, config)


if __name__ == "__main__":
    main()
