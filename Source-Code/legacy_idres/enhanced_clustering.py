import argparse
import csv
import itertools
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


class UnionFind:
    def __init__(self, max_cluster_size, record_identifiers=None, guardrails=None):
        self.parent = {}
        self.size = {}
        self.max_cluster_size = max_cluster_size
        self.identifiers = {}
        self.record_identifiers = record_identifiers or {}
        self.guardrails = guardrails or {}

    def find(self, item):
        if item not in self.parent:
            self.parent[item] = item
            self.size[item] = 1
            self.identifiers[item] = {
                key: set(values)
                for key, values in self.record_identifiers.get(item, {}).items()
            }
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]

    def union(self, left, right):
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root == right_root:
            return True
        if self.size[left_root] + self.size[right_root] > self.max_cluster_size:
            return False
        if not self.within_identifier_guardrails(left_root, right_root):
            return False
        if self.size[left_root] < self.size[right_root]:
            left_root, right_root = right_root, left_root
        self.parent[right_root] = left_root
        self.size[left_root] += self.size[right_root]
        for key, values in self.identifiers.get(right_root, {}).items():
            self.identifiers.setdefault(left_root, {}).setdefault(key, set()).update(values)
        return True

    def within_identifier_guardrails(self, left_root, right_root):
        checks = [
            ("emails", "max_distinct_emails"),
            ("phones", "max_distinct_phones"),
            ("names", "max_distinct_names"),
        ]
        for identifier_key, guardrail_key in checks:
            limit = int(self.guardrails.get(guardrail_key, 0) or 0)
            if not limit:
                continue
            left_values = self.identifiers.get(left_root, {}).get(identifier_key, set())
            right_values = self.identifiers.get(right_root, {}).get(identifier_key, set())
            if len(left_values | right_values) > limit:
                return False
        return True


def non_empty_set(*values):
    return {str(value).strip() for value in values if str(value or "").strip()}


def derived_field(config, logical_name):
    field_names = config.get("matching_field_preparation", {}).get("derived_field_names", {})
    try:
        return field_names[logical_name]
    except KeyError as exc:
        raise KeyError(
            f"Missing config value: matching_field_preparation.derived_field_names.{logical_name}"
        ) from exc


def record_id_value(record, config):
    return record.get(config["input"]["record_id_field"], "")


def output_column(config, logical_name):
    try:
        return config["output"]["column_names"][logical_name]
    except KeyError as exc:
        raise KeyError(f"Missing config value: output.column_names.{logical_name}") from exc


def record_identifiers(record, config):
    prepared_name = " ".join(
        value
        for value in [
            str(record.get(derived_field(config, "first_name"), "")).strip(),
            str(record.get(derived_field(config, "last_name"), "")).strip(),
        ]
        if value
    )
    return {
        "emails": non_empty_set(record.get(derived_field(config, "email_standardized"))),
        "phones": non_empty_set(record.get(derived_field(config, "phone_standardized"))),
        "names": non_empty_set(prepared_name),
    }


def pair_priority(pair, identifier_priority, config):
    default_rank = len(identifier_priority)
    ranks = []
    for feature in identifier_priority:
        confidence = float(pair.get(f"{feature}_confidence", 0) or 0)
        if confidence > 0:
            ranks.append(identifier_priority.index(feature))
    best_rank = min(ranks) if ranks else default_rank
    final_confidence = float(pair.get(output_column(config, "final_confidence"), 0) or 0)
    person_features = config.get("confidence_scoring", {}).get("person_features", [])
    matching_count = sum(
        1
        for feature in person_features
        if float(pair.get(f"{feature}_confidence", 0) or 0) > 0
    )
    return (best_rank, -final_confidence, -matching_count)


def configured_identifier_priority(config):
    clustering_config = config.get("clustering", {})
    configured_priority = clustering_config["identifier_priority"]
    primary_tag = str(config.get("identity_matching", {}).get("primary_tag", "") or "").strip()
    key_identifiers = set(config.get("identity_matching", {}).get("available_key_identifiers", []))

    priority = []
    if primary_tag:
        priority.append("key_identifier" if primary_tag in key_identifiers else primary_tag)
    for feature in configured_priority:
        if feature not in priority:
            priority.append(feature)
    return priority


def clustering_edge_allowed(pair, config):
    clustering_config = config.get("clustering", {})
    edge_type = (
        pair.get(output_column(config, "edge_type"))
        or pair.get(output_column(config, "match_tier"))
        or pair.get(output_column(config, "relationship_classification"), "")
    )
    if edge_type not in set(clustering_config["accepted_match_tiers"]):
        return False, edge_type or "unclassified"
    if edge_type != "weak":
        return True, edge_type

    matched_fields = set(str(pair.get(output_column(config, "matched_fields"), "")).split("|"))
    matched_fields.discard("")
    allowed_weak_patterns = [
        set(str(pattern).split("|"))
        for pattern in clustering_config.get("weak_edge_allowed_matched_fields", [])
    ]
    if any(matched_fields == pattern for pattern in allowed_weak_patterns):
        return True, edge_type
    return False, "weak_not_clustered"


def household_key(record, config):
    address = str(record.get(derived_field(config, "address_standardized"), "")).strip()
    zip_code = str(record.get(derived_field(config, "zip"), "")).strip()
    return f"{address}|{zip_code}" if address and zip_code else ""


def exact_person_identifiers(record, config):
    identifiers = set()
    email = str(record.get(derived_field(config, "email_standardized"), "")).strip()
    phone = str(record.get(derived_field(config, "phone_standardized"), "")).strip()
    if email:
        identifiers.add(f"email:{email}")
    if phone:
        identifiers.add(f"phone:{phone}")
    for item in config.get("matching_field_preparation", {}).get("exact_identifier_fields", []):
        prepared_field = item.get("prepared_field")
        if not prepared_field or prepared_field == "dob_standardized":
            continue
        value = str(record.get(prepared_field, "")).strip()
        if value:
            identifiers.add(f"{prepared_field}:{value}")
    return identifiers


def build_household_links(records, cluster_id_by_record_id, config):
    if not config.get("household_linking", {}).get("enabled", False):
        return []

    household_prefix = config["clustering"]["household_id_prefix"]
    source_field_name = config["input"]["source_field"]
    household_groups = defaultdict(list)
    for record in records:
        key = household_key(record, config)
        if key:
            household_groups[key].append(record)

    links = []
    household_index = 0
    for key in sorted(household_groups):
        members = household_groups[key]
        records_by_cluster = {}
        identifiers_by_cluster = {}
        for record in members:
            record_id = record_id_value(record, config)
            cluster_id = cluster_id_by_record_id.get(record_id, "")
            records_by_cluster.setdefault(cluster_id, record)
            identifiers_by_cluster.setdefault(cluster_id, set()).update(exact_person_identifiers(record, config))

        if len(records_by_cluster) < 2:
            continue

        household_index += 1
        household_id = f"{household_prefix}-{household_index:06d}"
        address, zip_code = key.split("|", 1)
        for left_cluster, right_cluster in itertools.combinations(sorted(records_by_cluster), 2):
            if identifiers_by_cluster.get(left_cluster, set()) & identifiers_by_cluster.get(right_cluster, set()):
                continue
            left = records_by_cluster[left_cluster]
            right = records_by_cluster[right_cluster]
            links.append({
                "household_id": household_id,
                "cluster_id_1": left_cluster,
                "cluster_id_2": right_cluster,
                output_column(config, "candidate_record_id_1"): record_id_value(left, config),
                output_column(config, "candidate_record_id_2"): record_id_value(right, config),
                "source_1": left.get(source_field_name, ""),
                "source_2": right.get(source_field_name, ""),
                "matched_fields": "address",
                "matching_techniques": "address: Same Address + ZIP",
                "address_standardized": address,
                "zip": zip_code,
                "address_confidence": "1.0000",
                output_column(config, "final_confidence"): "100.00",
                output_column(config, "edge_type"): "household",
                output_column(config, "match_tier"): "household",
                output_column(config, "relationship_classification"): "household",
                "edge_type": "household",
                "match_tier": "household",
                "relationship_classification": "household",
                "decision_reason": "Same standardized address and ZIP linked as secondary household",
            })
    return links


def main():
    parser = argparse.ArgumentParser(description="Enhanced person clustering and household linking.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--source-systems", default="")
    args = parser.parse_args()

    config = load_yaml(Path(args.config))
    prepared_path = resolve_path(config["output"]["prepared_records"])
    pairs_path = resolve_path(config["output"]["candidate_pairs"])
    clustered_path = resolve_path(config["output"]["clustered_records"])
    household_path = resolve_path(config["output"]["household_links"])
    summary_path = resolve_path(config["output"]["cluster_summary"])
    clustered_path.parent.mkdir(parents=True, exist_ok=True)
    household_path.parent.mkdir(parents=True, exist_ok=True)

    records = read_csv(prepared_path)
    if not records:
        raise RuntimeError(
            "Clustering received zero prepared records; existing clustered "
            "identity outputs were not replaced."
        )
    pairs = read_csv(pairs_path)
    max_cluster_size = int(config["clustering"]["max_cluster_size"])
    cluster_prefix = config["clustering"]["cluster_id_prefix"]
    clustering_config = config.get("clustering", {})
    guardrails = clustering_config.get("cluster_guardrails", {})
    identifier_priority = configured_identifier_priority(config)
    identifiers_by_record_id = {
        record_id_value(record, config): record_identifiers(record, config)
        for record in records
    }
    uf = UnionFind(max_cluster_size, identifiers_by_record_id, guardrails)

    for record in records:
        uf.find(record_id_value(record, config))

    rejected_edges = 0
    skipped_counts = defaultdict(int)
    sorted_pairs = sorted(
        pairs,
        key=lambda pair: pair_priority(pair, identifier_priority, config),
    )
    for pair in sorted_pairs:
        allowed, edge_type = clustering_edge_allowed(pair, config)
        if allowed:
            if not uf.union(pair[output_column(config, "candidate_record_id_1")], pair[output_column(config, "candidate_record_id_2")]):
                rejected_edges += 1
        else:
            skipped_counts[edge_type or "unclassified"] += 1

    clusters = defaultdict(list)
    for record in records:
        clusters[uf.find(record_id_value(record, config))].append(record_id_value(record, config))

    cluster_ids = {}
    for index, root in enumerate(sorted(clusters), start=1):
        cluster_ids[root] = f"{cluster_prefix}-{index:06d}"

    cluster_id_by_record_id = {}
    output_rows = []
    for record in records:
        root = uf.find(record_id_value(record, config))
        cluster_id_by_record_id[record_id_value(record, config)] = cluster_ids[root]
        row = dict(record)
        row[output_column(config, "cluster_id")] = cluster_ids[root]
        row[output_column(config, "cluster_size")] = len(clusters[root])
        output_rows.append(row)

    with open(clustered_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output_rows[0].keys()), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(output_rows)

    for stale_index_name in ("cluster_index.json", "cluster_index.sqlite"):
        stale_index_path = clustered_path.parent / stale_index_name
        if stale_index_path.exists():
            stale_index_path.unlink()

    household_links = build_household_links(records, cluster_id_by_record_id, config)
    household_fields = [
        "household_id",
        "cluster_id_1",
        "cluster_id_2",
        output_column(config, "candidate_record_id_1"),
        output_column(config, "candidate_record_id_2"),
        "source_1",
        "source_2",
        "matched_fields",
        "matching_techniques",
        "address_standardized",
        "zip",
        "address_confidence",
        output_column(config, "final_confidence"),
        "edge_type",
        "match_tier",
        "relationship_classification",
        "decision_reason",
    ]
    with open(household_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=household_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(household_links)

    multi_record_clusters = sum(1 for ids in clusters.values() if len(ids) > 1)
    tier_counts = {
        tier: sum(
            1
            for pair in pairs
            if pair.get(output_column(config, "edge_type")) == tier
            or pair.get(output_column(config, "match_tier")) == tier
        )
        for tier in clustering_config["accepted_match_tiers"]
    }
    summary = {
        "total_records": len(records),
        "total_clusters": len(clusters),
        "multi_record_clusters": multi_record_clusters,
        "single_record_clusters": len(clusters) - multi_record_clusters,
        "largest_cluster_size": max((len(ids) for ids in clusters.values()), default=0),
        "accepted_edge_count": sum(tier_counts.values()),
        "rejected_edge_count": rejected_edges,
        "rejected_guardrail_edge_count": rejected_edges,
        "skipped_edge_counts": dict(sorted(skipped_counts.items())),
        "household_link_count": len(household_links),
        "tier_counts": tier_counts,
        "accepted_edge_types": clustering_config["accepted_match_tiers"],
        "identifier_priority": identifier_priority,
        "cluster_guardrails": guardrails,
        "incremental_update": config.get("incremental_update", {"enabled": False, "mode": "full_refresh"}),
    }
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)

    print(f"Wrote enhanced clustered records to {clustered_path}")
    print(f"Wrote enhanced household links to {household_path}")


if __name__ == "__main__":
    main()
