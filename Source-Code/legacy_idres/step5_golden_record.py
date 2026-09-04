"""
Step 5 — Golden Record / Superseded ID Merge
Takes clustered records, merges each cluster into a single golden record
by picking the best value for each field using survivorship rules.

Supports user-controlled source-system execution:
    --source-systems media
    --source-systems sports
    --source-systems media,sports,automotive

Input:
    clustering_output/<source_system>/clustered_records.csv
    source_preferences.json            (optional)
    generated_data/ground_truth.json   (optional — eval skipped if missing)

Output:
    golden_records_output/<source_system>/golden_records.csv
    golden_records_output/<source_system>/superseded_ids.csv
    golden_records_output/<source_system>/golden_record_summary.json
    golden_records_output/<source_system>/golden_record_provenance.json
    golden_records_output/<source_system>/household_summary.json
"""

import argparse
import csv
import json
import os
from collections import defaultdict, Counter
from services.golden_record_service import GoldenRecordService
from services.pipeline_base import PipelineStepContext
import pipeline_uc_bootstrap  # noqa: F401

from legacy_pipeline_config import (
    account_id_fields,
    default_source_systems,
    pipeline_directory,
    source_systems as configured_source_systems,
)

CLUSTERS_BASE_DIR = pipeline_directory("clustering_output", "clustering_output")
OUTPUT_BASE_DIR = pipeline_directory("golden_records_output", "golden_records_output")
GROUND_TRUTH = os.path.join(pipeline_directory("generated_data", "generated_data"), "ground_truth.json")
SOURCE_SYSTEMS = configured_source_systems()
DEFAULT_SOURCE_SYSTEMS = default_source_systems()
SPORTS_ACCOUNT_IDS = account_id_fields("sports")
AUTOMOTIVE_ACCOUNT_IDS = account_id_fields("automotive")


def build_golden_record_service():
    return GoldenRecordService(
        context=PipelineStepContext(
            source_systems=SOURCE_SYSTEMS,
            default_source_systems=DEFAULT_SOURCE_SYSTEMS,
        ),
        ground_truth_path=GROUND_TRUTH,
        abort_if_uc_runtime=pipeline_uc_bootstrap.abort_if_uc_runtime,
        load_source_prefs=load_source_prefs,
        load_ground_truth=load_ground_truth_optional,
        process_source_system=process_source_system,
    )


from step4_clustering import UnionFind



# Sports-specific account-style identifiers. A record carrying any of these
# is retained even if it has no traditional PII (name/email/phone).


# Unified golden record schema — covers both media and sports. Records missing
# a field (because that field doesn't exist in their source system) will have
# the column left blank.
GOLDEN_FIELDS = [
    "cluster_id",
    "golden_id",
    "household_id",
    "source_system",
    # Core PII / identity
    "full_name",
    "first_name",
    "last_name",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "zip",
    "dob",
    # Media-tier
    "subscription_tier",
    "device_id",
    "ip_address",
    # Sports identifiers
    "customer_id",
    "account_id",
    "loyalty_id",
    "fan_account_id",
    "ticketing_account_id",
    "loyalty_member_id",
    "commerce_customer_id",
    "streaming_account_id",
    "fantasy_account_id",
    "oauth_user_id",
    "authenticated_user_id",
    "resolved_profile_id",
    "username",
    # Sports attributes
    "primary_team_id",
    "primary_team_code",
    "favorite_team_code",
    "membership_tier",
    "fan_since_year",
    # Metadata
    "record_count",
    "diversity_score",
    "source_files",
    "all_emails",
    "all_phones",
    "all_names",
    "all_devices",
]

# Tier ranking for survivorship (highest wins) — applies to media subscription_tier
TIER_RANK = {"VIP": 4, "Premium": 3, "Basic": 2, "Free": 1, "": 0}

# Identity fields used to compute record completeness. Both PII fields and
# sports account IDs count, so a sports record with only a fan_account_id
# isn't penalized as "incomplete" relative to a media record with full PII.
COMPLETENESS_FIELDS = [
    "full_name", "email", "phone", "address", "zip",
] + SPORTS_ACCOUNT_IDS + AUTOMOTIVE_ACCOUNT_IDS


# ---------------------------------------------------------------------
# ARGUMENTS
# ---------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Step 5 — Golden Record / Superseded ID Merge."
    )
    parser.add_argument(
        "--source-systems",
        default=",".join(DEFAULT_SOURCE_SYSTEMS),
        help="Comma-separated list of source systems to process. Default: media,sports,automotive",
    )
    return parser.parse_args()


def get_selected_source_systems(raw_value):
    selected = [s.strip().lower() for s in raw_value.split(",") if s.strip()]
    invalid = [s for s in selected if s not in SOURCE_SYSTEMS]

    if invalid:
        raise ValueError(
            f"Invalid source system(s): {invalid}. Allowed: {SOURCE_SYSTEMS}"
        )
    return selected if selected else DEFAULT_SOURCE_SYSTEMS


# ---------------------------------------------------------------------
# IO HELPERS
# ---------------------------------------------------------------------

def get_clusters_file(source_system):
    return os.path.join(CLUSTERS_BASE_DIR, source_system, "clustered_records.csv")


def get_output_dir(source_system):
    out_dir = os.path.join(OUTPUT_BASE_DIR, source_system)
    os.makedirs(out_dir, exist_ok=True)
    return out_dir


def load_records(clusters_file):
    with open(clusters_file, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_source_prefs():
    prefs_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source_preferences.json")
    if not os.path.exists(prefs_file):
        return {}
    with open(prefs_file, "r", encoding="utf-8") as f:
        return json.load(f)


def load_ground_truth_optional():
    if not os.path.exists(GROUND_TRUTH):
        return None
    with open(GROUND_TRUTH, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------
# SURVIVORSHIP HELPERS
# ---------------------------------------------------------------------

def most_frequent_with_source(values_with_source):
    """Return (chosen_value, chosen_source, reason) — most frequent value wins."""
    candidates = [(v.strip(), s) for v, s in values_with_source if v and v.strip()]
    if not candidates:
        return "", "", "No data available"
    counter = Counter(v for v, _ in candidates)
    chosen_val, count = counter.most_common(1)[0]
    source_counts = Counter(s for v, s in candidates if v == chosen_val)
    chosen_src = source_counts.most_common(1)[0][0]
    src_name = chosen_src.replace(".csv", "").replace("_", " ").title()
    if len(counter) == 1 and count == 1:
        reason = f"Only available from {src_name}"
    elif count > 1:
        src_contrib = source_counts[chosen_src]
        reason = f"Most frequent value ({count} occurrences, {src_contrib} from {src_name})"
    else:
        reason = f"Selected from {src_name}"
    return chosen_val, chosen_src, reason


def _record_completeness(record):
    filled = sum(1 for f in COMPLETENESS_FIELDS if record.get(f, "").strip())
    return filled / len(COMPLETENESS_FIELDS)


def most_complete_source(field, members, preferred_source=None):
    """Pick the value from the most complete record. Tiebreaker: most frequent value."""
    candidates = []
    for r in members:
        val = r.get(field, "").strip()
        if val:
            candidates.append((val, r.get("source_file", ""), r, _record_completeness(r)))

    if not candidates:
        return "", "", "No data available"

    freq = Counter(v for v, _, _, _ in candidates)

    if preferred_source:
        pref_candidates = [c for c in candidates if c[1] == preferred_source]
        if pref_candidates:
            pref_candidates.sort(key=lambda x: (x[3], freq[x[0]]), reverse=True)
            chosen_val, chosen_src, _, chosen_comp = pref_candidates[0]
            src_name = chosen_src.replace(".csv", "").replace("_", " ").title()
            pct = int(chosen_comp * 100)
            return chosen_val, chosen_src, f"User preferred data source ({src_name}, {pct}% identity fields filled)"

    candidates.sort(key=lambda x: (x[3], freq[x[0]]), reverse=True)
    chosen_val, chosen_src, _, chosen_comp = candidates[0]
    src_name = chosen_src.replace(".csv", "").replace("_", " ").title()
    pct = int(chosen_comp * 100)

    if len(candidates) == 1:
        reason = f"Only available from {src_name}"
    elif candidates[0][3] > candidates[1][3]:
        reason = f"Most complete source ({src_name}, {pct}% identity fields filled)"
    else:
        reason = f"Most complete source ({src_name}, {pct}% filled, {freq[chosen_val]} unique occurrences)"

    return chosen_val, chosen_src, reason


def most_frequent_source(field, members, preferred_source=None):
    candidates = []
    for r in members:
        val = r.get(field, "").strip()
        if val:
            candidates.append((val, r.get("source_file", "")))

    if not candidates:
        return "", "", "No data available"

    if preferred_source:
        pref = [c for c in candidates if c[1] == preferred_source]
        if pref:
            candidates = pref

    counter = Counter(v for v, _ in candidates)
    chosen_val, count = counter.most_common(1)[0]
    source_counts = Counter(s for v, s in candidates if v == chosen_val)
    chosen_src = source_counts.most_common(1)[0][0]
    src_name = chosen_src.replace(".csv", "").replace("_", " ").title()
    pref_label = " (user preferred source)" if preferred_source else ""
    if count == 1:
        reason = f"Most frequent value — only 1 occurrence from {src_name}{pref_label}"
    else:
        reason = f"Most frequent value ({count} occurrences, from {src_name}){pref_label}"
    return chosen_val, chosen_src, reason


_DATE_FIELDS = [
    "event_timestamp", "send_date", "created_date", "signup_date",
    "billing_date", "resolved_date", "open_date", "session_start_time",
    "last_login_at", "stream_started_at", "updated_date", "enrolled_date",
    "last_activity_date",
]


def most_recent_source(field, members, preferred_source=None):
    candidates = []
    for r in members:
        val = r.get(field, "").strip()
        if not val:
            continue
        best_date = ""
        for df in _DATE_FIELDS:
            d = r.get(df, "").strip()
            if d and d > best_date:
                best_date = d
        candidates.append((val, r.get("source_file", ""), best_date))

    if not candidates:
        return "", "", "No data available"

    if preferred_source:
        pref = [c for c in candidates if c[1] == preferred_source]
        if pref:
            candidates = pref

    candidates.sort(key=lambda x: x[2] if x[2] else "", reverse=True)
    chosen_val, chosen_src, chosen_date = candidates[0]
    src_name = chosen_src.replace(".csv", "").replace("_", " ").title()
    pref_label = " (user preferred source)" if preferred_source else ""
    date_info = f", date: {chosen_date}" if chosen_date else ""
    reason = f"Most recent record (from {src_name}{date_info}){pref_label}"
    return chosen_val, chosen_src, reason


def _select_by_strategy(field, members, strategy, preferred_source=None):
    if strategy == "most_frequent":
        val, src, reason = most_frequent_source(field, members, preferred_source)
        rule = "Most Frequent Value"
    elif strategy == "most_recent":
        val, src, reason = most_recent_source(field, members, preferred_source)
        rule = "Most Recent Value"
    else:
        val, src, reason = most_complete_source(field, members, preferred_source)
        rule = "Most Complete Source"
        if preferred_source and reason.startswith("User preferred"):
            rule = "User Preferred Data Source"
    return val, src, reason, rule


def best_tier(values_with_source):
    candidates = [(v.strip(), s) for v, s in values_with_source if v and v.strip()]
    if not candidates:
        return "", "", "No data available"
    candidates.sort(key=lambda x: TIER_RANK.get(x[0], 0), reverse=True)
    chosen_val, chosen_src = candidates[0]
    src_name = chosen_src.replace(".csv", "").replace("_", " ").title()
    if len(candidates) == 1:
        reason = f"Only available from {src_name}"
    else:
        reason = f"Highest tier value ({chosen_val}, rank {TIER_RANK.get(chosen_val, 0)})"
    return chosen_val, chosen_src, reason


def collect_unique(values):
    seen = set()
    result = []
    for v in values:
        v = v.strip()
        if v and v not in seen:
            seen.add(v)
            result.append(v)
    return "|".join(result) if result else ""


def _build_candidates(members, field):
    result = []
    for r in members:
        val = r.get(field, "").strip()
        if val:
            result.append({
                "value": val,
                "source": r.get("source_file", ""),
                "record_id": r.get("record_id", ""),
            })
    return result


# ---------------------------------------------------------------------
# GOLDEN RECORD BUILDER
# ---------------------------------------------------------------------

# Fields that get the "most complete source" strategy (driven by source_preferences if set)
COMPLETENESS_BASED = [
    "full_name", "first_name", "last_name",
    "email", "phone",
    "address", "city", "state", "zip", "dob",
    # Sports identifiers / attributes — completeness-based by default
    "customer_id", "account_id", "loyalty_id",
    "fan_account_id", "ticketing_account_id", "loyalty_member_id",
    "commerce_customer_id", "streaming_account_id", "fantasy_account_id",
    "oauth_user_id", "authenticated_user_id", "resolved_profile_id", "username",
    "primary_team_id", "primary_team_code", "favorite_team_code",
    "membership_tier", "fan_since_year",
]

# Frequency-based fields (most common value wins)
FREQUENCY_BASED = ["device_id", "ip_address"]


def build_golden_record(cluster_id, members, source_prefs, golden_prefix):
    """Build a single golden record from cluster members. Returns (golden, provenance)."""
    sources = set(r.get("source_file", "") for r in members if r.get("source_file", ""))
    source_systems_in_cluster = set(
        r.get("source_system", "") for r in members if r.get("source_system", "")
    )
    primary_source_system = (
        next(iter(source_systems_in_cluster)) if len(source_systems_in_cluster) == 1
        else "|".join(sorted(source_systems_in_cluster))
    )

    provenance = {}
    golden_values = {}

    # Completeness-based fields
    for field_name in COMPLETENESS_BASED:
        pref_entry = (source_prefs or {}).get(field_name)
        if isinstance(pref_entry, dict):
            preferred = pref_entry.get("source") or None
            strategy = pref_entry.get("strategy", "most_complete")
        elif isinstance(pref_entry, str) and pref_entry:
            preferred = pref_entry
            strategy = "most_complete"
        else:
            preferred = None
            strategy = "most_complete"

        val, src, reason, rule = _select_by_strategy(field_name, members, strategy, preferred)
        golden_values[field_name] = val
        candidates = _build_candidates(members, field_name)
        chosen_rid = ""
        if val and src:
            for c in candidates:
                if c["value"] == val and c["source"] == src:
                    chosen_rid = c["record_id"]
                    break
        provenance[field_name] = {
            "candidates": candidates,
            "chosen_value": val,
            "chosen_source": src,
            "chosen_record": chosen_rid,
            "rule": rule,
            "reason": reason,
        }

    # Subscription tier: highest wins
    tiers = [(r.get("subscription_tier", ""), r.get("source_file", "")) for r in members]
    tier_val, tier_src, tier_reason = best_tier(tiers)
    golden_values["subscription_tier"] = tier_val
    tier_candidates = _build_candidates(members, "subscription_tier")
    tier_rid = ""
    if tier_val and tier_src:
        for c in tier_candidates:
            if c["value"] == tier_val and c["source"] == tier_src:
                tier_rid = c["record_id"]
                break
    provenance["subscription_tier"] = {
        "candidates": tier_candidates,
        "chosen_value": tier_val,
        "chosen_source": tier_src,
        "chosen_record": tier_rid,
        "rule": "Highest Tier Value",
        "reason": tier_reason,
    }

    # Frequency-based fields
    for field_name in FREQUENCY_BASED:
        field_data = [(r.get(field_name, ""), r.get("source_file", "")) for r in members]
        val, src, reason = most_frequent_with_source(field_data)
        golden_values[field_name] = val
        candidates = _build_candidates(members, field_name)
        chosen_rid = ""
        if val and src:
            for c in candidates:
                if c["value"] == val and c["source"] == src:
                    chosen_rid = c["record_id"]
                    break
        provenance[field_name] = {
            "candidates": candidates,
            "chosen_value": val,
            "chosen_source": src,
            "chosen_record": chosen_rid,
            "rule": "Most Frequent Value",
            "reason": reason,
        }

    if not golden_values.get("full_name"):
        full_name = " ".join(
            part for part in [golden_values.get("first_name", ""), golden_values.get("last_name", "")]
            if part
        )
        if full_name:
            golden_values["full_name"] = full_name

    diversity_score = 0
    for field_prov in provenance.values():
        unique_vals = set(c["value"] for c in field_prov["candidates"] if c["value"])
        if len(unique_vals) > 1:
            diversity_score += 1

    golden = {
        "cluster_id": cluster_id,
        "golden_id": cluster_id.replace("-CL-", "-GR-") if "-CL-" in cluster_id else cluster_id.replace("CL-", f"{golden_prefix}-GR-"),
        "source_system": primary_source_system,
        **golden_values,
        "record_count": len(members),
        "diversity_score": diversity_score,
        "source_files": "|".join(sorted(sources)),
        "all_emails": collect_unique([r.get("email", "") for r in members]),
        "all_phones": collect_unique([r.get("phone", "") for r in members]),
        "all_names": collect_unique([
            r.get("full_name", "") or " ".join(part for part in [r.get("first_name", ""), r.get("last_name", "")] if part)
            for r in members
        ]),
        "all_devices": collect_unique([r.get("device_id", "") for r in members]),
    }

    return golden, provenance


def has_any_identifier(g):
    """A golden record is retained if it has PII or an account/customer identifier."""
    if g.get("full_name") or g.get("email") or g.get("phone"):
        return True
    for field in SPORTS_ACCOUNT_IDS + AUTOMOTIVE_ACCOUNT_IDS:
        if g.get(field):
            return True
    return False


# ---------------------------------------------------------------------
# HOUSEHOLD ASSIGNMENT
# ---------------------------------------------------------------------

def assign_household_ids(golden_records, household_prefix, out_summary_path):
    """Group golden records into households via shared device_id or address+zip."""
    MAX_DEVICE_FREQUENCY = 3
    MAX_HOUSEHOLD_SIZE = 8

    uf = UnionFind(max_cluster_size=MAX_HOUSEHOLD_SIZE)
    gids = [g["golden_id"] for g in golden_records]
    for gid in gids:
        uf.find(gid)

    device_index = defaultdict(set)
    address_index = defaultdict(set)

    for g in golden_records:
        gid = g["golden_id"]
        for dev in (g.get("all_devices", "") or "").split("|"):
            dev = dev.strip()
            if dev:
                device_index[dev].add(gid)
        addr = (g.get("address", "") or "").strip()
        zipcode = (g.get("zip", "") or "").strip()
        if addr and zipcode:
            address_index[(addr, zipcode)].add(gid)

    device_unions = 0
    for dev, gid_set in device_index.items():
        if len(gid_set) < 2 or len(gid_set) > MAX_DEVICE_FREQUENCY:
            continue
        gid_list = list(gid_set)
        for i in range(1, len(gid_list)):
            uf.union(gid_list[0], gid_list[i])
            device_unions += 1

    address_unions = 0
    for key, gid_set in address_index.items():
        if len(gid_set) < 2:
            continue
        gid_list = list(gid_set)
        for i in range(1, len(gid_list)):
            uf.union(gid_list[0], gid_list[i])
            address_unions += 1

    components = defaultdict(list)
    for gid in gids:
        components[uf.find(gid)].append(gid)

    sorted_households = sorted(components.values(), key=lambda grp: min(grp))
    household_map = {}
    for idx, members in enumerate(sorted_households, 1):
        hid = f"{household_prefix}-HH-{idx:06d}"
        for gid in members:
            household_map[gid] = hid

    sizes = [len(m) for m in sorted_households]
    multi = sum(1 for s in sizes if s > 1)
    print(f"\n--- Household Assignment ---")
    print(f"  Total households: {len(sorted_households):,}")
    print(f"  Multi-member households: {multi:,}")
    print(f"  Largest household: {max(sizes) if sizes else 0} members")
    print(f"  Device unions: {device_unions:,}, Address unions: {address_unions:,}")

    size_dist = Counter(sizes)
    summary = {
        "total_households": len(sorted_households),
        "multi_member": multi,
        "singletons": sum(1 for s in sizes if s == 1),
        "largest_household": max(sizes) if sizes else 0,
        "size_distribution": {str(k): v for k, v in sorted(size_dist.items())},
    }
    with open(out_summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"  Wrote household summary to {out_summary_path}")

    return household_map


# ---------------------------------------------------------------------
# PROCESSING PER SOURCE SYSTEM
# ---------------------------------------------------------------------

def process_source_system(source_system, source_prefs, gt):
    clusters_file = get_clusters_file(source_system)

    if not os.path.exists(clusters_file):
        print(f"SKIP: Clustered records not found for '{source_system}': {clusters_file}")
        return

    out_dir = get_output_dir(source_system)
    out_golden = os.path.join(out_dir, "golden_records.csv")
    out_superseded = os.path.join(out_dir, "superseded_ids.csv")
    out_summary = os.path.join(out_dir, "golden_record_summary.json")
    out_provenance = os.path.join(out_dir, "golden_record_provenance.json")
    out_household = os.path.join(out_dir, "household_summary.json")

    print(f"\n=== Processing source system: {source_system} ===\n")
    print(f"Input : {clusters_file}")
    print(f"Output: {out_dir}\n")

    records = load_records(clusters_file)
    print(f"Loaded {len(records)} clustered records")

    # Ensure every record has source_system populated (fallback in case step 4
    # didn't carry it forward)
    for r in records:
        if not r.get("source_system"):
            r["source_system"] = source_system

    clusters = defaultdict(list)
    for r in records:
        cid = r.get("cluster_id", "")
        if cid:
            clusters[cid].append(r)

    print(f"Clusters: {len(clusters)}\n")

    prefix = source_system[:3].upper()

    golden_records = []
    superseded_rows = []
    all_provenance = {}

    for cluster_id in sorted(clusters.keys()):
        members = clusters[cluster_id]
        golden, provenance = build_golden_record(cluster_id, members, source_prefs, prefix)
        golden_records.append(golden)
        all_provenance[golden["golden_id"]] = provenance

        for member in members:
            superseded_rows.append({
                "record_id": member["record_id"],
                "source_file": member.get("source_file", ""),
                "source_system": member.get("source_system", source_system),
                "cluster_id": cluster_id,
                "golden_id": golden["golden_id"],
            })

    # Retain only golden records with at least one identifier (PII or sports account ID)
    before_count = len(golden_records)
    golden_records = [g for g in golden_records if has_any_identifier(g)]
    filtered_count = before_count - len(golden_records)
    if filtered_count:
        print(f"Filtered out {filtered_count} golden records with no identifier (no PII and no account ID)")

    retained_golden_ids = {g["golden_id"] for g in golden_records}
    superseded_rows = [s for s in superseded_rows if s["golden_id"] in retained_golden_ids]

    household_map = assign_household_ids(golden_records, prefix, out_household)
    for g in golden_records:
        g["household_id"] = household_map.get(g["golden_id"], "")

    # Write golden records (unified schema; missing fields stay blank)
    with open(out_golden, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=GOLDEN_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for g in golden_records:
            row = {k: g.get(k, "") for k in GOLDEN_FIELDS}
            writer.writerow(row)

    with open(out_superseded, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["record_id", "source_file", "source_system", "cluster_id", "golden_id"])
        writer.writeheader()
        writer.writerows(superseded_rows)

    prov_output = {gid: prov for gid, prov in all_provenance.items()
                   if gid in retained_golden_ids and any(p["candidates"] for p in prov.values())}
    with open(out_provenance, "w", encoding="utf-8") as f:
        json.dump(prov_output, f)
    print(f"Wrote provenance for {len(prov_output)} golden records to {out_provenance}")

    # Stats
    multi_record = [g for g in golden_records if g["record_count"] > 1]
    singletons = [g for g in golden_records if g["record_count"] == 1]

    has_email = sum(1 for g in golden_records if g.get("email"))
    has_phone = sum(1 for g in golden_records if g.get("phone"))
    has_name = sum(1 for g in golden_records if g.get("full_name"))
    has_address = sum(1 for g in golden_records if g.get("address"))
    has_account = sum(1 for g in golden_records if any(g.get(f) for f in SPORTS_ACCOUNT_IDS))

    multi_email = sum(1 for g in golden_records if "|" in g.get("all_emails", ""))
    multi_phone = sum(1 for g in golden_records if "|" in g.get("all_phones", ""))
    multi_name = sum(1 for g in golden_records if "|" in g.get("all_names", ""))

    print(f"Golden records created: {len(golden_records)}")
    print(f"  Multi-record merges: {len(multi_record)}")
    print(f"  Singletons: {len(singletons)}")
    if golden_records:
        n = len(golden_records)
        print(f"\nField coverage:")
        print(f"  Has email: {has_email} ({has_email/n*100:.1f}%)")
        print(f"  Has phone: {has_phone} ({has_phone/n*100:.1f}%)")
        print(f"  Has name: {has_name} ({has_name/n*100:.1f}%)")
        print(f"  Has address: {has_address} ({has_address/n*100:.1f}%)")
        print(f"  Has sports account id: {has_account} ({has_account/n*100:.1f}%)")
        print(f"\nRecords with multiple collected values:")
        print(f"  Multiple emails: {multi_email}")
        print(f"  Multiple phones: {multi_phone}")
        print(f"  Multiple names: {multi_name}")

    source_counts = Counter()
    for g in golden_records:
        for src in g["source_files"].split("|"):
            if src:
                source_counts[src] += 1

    if golden_records:
        print(f"\nSource representation in golden records:")
        for src, count in source_counts.most_common():
            print(f"  {src}: {count} ({count/len(golden_records)*100:.1f}%)")

    # Evaluation vs ground truth (optional)
    golden_purity = None
    golden_impure = None
    if gt is not None and golden_records:
        print("\n--- Evaluation vs Ground Truth ---")
        golden_purity = 0
        golden_impure = 0
        for golden in golden_records:
            cid = golden["cluster_id"]
            members = clusters[cid]
            cust_ids = set()
            for m in members:
                rid = m["record_id"]
                if rid in gt:
                    cust_ids.add(gt[rid])
            if len(cust_ids) <= 1:
                golden_purity += 1
            else:
                golden_impure += 1

        print(f"  Pure golden records (1 customer): {golden_purity}/{len(golden_records)} ({golden_purity/len(golden_records)*100:.1f}%)")
        print(f"  Impure golden records (mixed): {golden_impure}")
    elif gt is None:
        print("\n[INFO] Skipping eval — no ground truth provided.")

    if multi_record:
        print(f"\nSample golden records (multi-record):")
        for g in multi_record[:5]:
            print(f"  {g['golden_id']}: {g['record_count']} records, "
                  f"name={g.get('full_name','')}, email={g.get('email','')}, "
                  f"tier={g.get('subscription_tier','')}, sources={g['source_files']}")

    summary = {
        "source_system": source_system,
        "total_golden_records": len(golden_records),
        "multi_record_merges": len(multi_record),
        "singletons": len(singletons),
        "total_superseded": len(superseded_rows),
        "field_coverage": {
            "email": has_email,
            "phone": has_phone,
            "name": has_name,
            "address": has_address,
            "sports_account_id": has_account,
        },
    }
    if golden_purity is not None:
        summary["purity"] = golden_purity
        summary["impure"] = golden_impure

    with open(out_summary, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"\nWrote {len(golden_records)} golden records to {out_golden}")
    print(f"Wrote {len(superseded_rows)} superseded IDs to {out_superseded}")
    print(f"Wrote summary to {out_summary}")


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

    return build_golden_record_service().run(selected_source_systems)

    print("=== Step 5: Golden Record / Superseded ID Merge ===\n")
    print(f"Selected source systems: {', '.join(selected_source_systems)}\n")

    source_prefs = load_source_prefs()
    if source_prefs:
        print(f"Source preferences loaded: {len(source_prefs)} tags configured")
    else:
        print("No source preferences configured (using completeness-based selection)")

    gt = load_ground_truth_optional()
    if gt is None:
        print(f"[INFO] {GROUND_TRUTH} not found — evaluation sections will be skipped.")

    for source_system in selected_source_systems:
        process_source_system(source_system, source_prefs, gt)

    print("\n=== Golden record merge complete! ===")


if __name__ == "__main__":
    main()
