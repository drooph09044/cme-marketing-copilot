"""
Step 4 — Connected Components / Clustering
Takes matched pairs from step3, builds a graph, finds connected components,
assigns each record a cluster_id (= resolved identity).

Supports user-controlled source-system execution:
    --source-systems media
    --source-systems sports
    --source-systems media,sports,automotive

Input:
    matching_output/<source_system>/candidate_pairs.csv
    standardized_data/<source_system>/all_standardized.csv
    generated_data/ground_truth.json   (optional — evaluation skipped if missing)

Output:
    clustering_output/<source_system>/clustered_records.csv
    clustering_output/<source_system>/cluster_summary.json
"""

import argparse
import csv
import json
import os
import sqlite3
from collections import defaultdict
from services.clustering_service import ClusteringService
from services.pipeline_base import PipelineStepContext
import pipeline_uc_bootstrap  # noqa: F401

from legacy_pipeline_config import (
    default_source_systems,
    pipeline_directory,
    source_systems as configured_source_systems,
)

PAIRS_BASE_DIR = pipeline_directory("matching_output", "matching_output")
RECORDS_BASE_DIR = pipeline_directory("standardized_data", "standardized_data")
OUTPUT_BASE_DIR = pipeline_directory("clustering_output", "clustering_output")
GROUND_TRUTH = os.path.join(pipeline_directory("generated_data", "generated_data"), "ground_truth.json")
SOURCE_SYSTEMS = configured_source_systems()
DEFAULT_SOURCE_SYSTEMS = default_source_systems()


def build_clustering_service():
    return ClusteringService(
        context=PipelineStepContext(
            source_systems=SOURCE_SYSTEMS,
            default_source_systems=DEFAULT_SOURCE_SYSTEMS,
        ),
        ground_truth_path=GROUND_TRUTH,
        abort_if_uc_runtime=pipeline_uc_bootstrap.abort_if_uc_runtime,
        load_ground_truth=load_ground_truth_optional,
        process_source_system=process_source_system,
    )




# Max cluster size cap — prevents runaway mega-clusters from transitive
# chaining of weak/supporting-field-only edges.
MAX_CLUSTER_SIZE = 500


def cluster_index_db_enabled():
    """Return whether the optional local SQLite cluster index can be written.

    Unity Catalog pipeline directories are virtual: CSV artifacts are backed by
    governed tables and JSON artifacts are backed by a UC Volume.  SQLite opens
    files directly and therefore cannot write to those virtual source-code
    paths.  The UC API already reads clustered records from the governed table
    (with the JSON index as metadata), so the SQLite index is only a local-mode
    acceleration artifact.
    """
    return os.getenv("CODEX_DATA_SOURCE", "local").strip().lower() != "uc"


def reset_cluster_index_db(output_index_db):
    if not cluster_index_db_enabled():
        return None
    conn = sqlite3.connect(output_index_db, timeout=30)
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("DROP TABLE IF EXISTS cluster_nodes")
    conn.execute("DROP TABLE IF EXISTS clusters")
    conn.execute(
        "CREATE TABLE clusters (cluster_id TEXT PRIMARY KEY, unique_node_count INTEGER, source_count INTEGER, sample_email TEXT, sample_name TEXT)"
    )
    conn.execute(
        "CREATE TABLE cluster_nodes (cluster_id TEXT, record_id TEXT, payload TEXT, PRIMARY KEY (cluster_id, record_id))"
    )
    conn.execute("CREATE INDEX idx_cluster_nodes_cluster ON cluster_nodes(cluster_id)")
    return conn


# ---------------------------------------------------------------------
# ARGUMENTS
# ---------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Step 4 — Clustering for selected source systems."
    )
    parser.add_argument(
        "--source-systems",
        default=",".join(DEFAULT_SOURCE_SYSTEMS),
        help="Comma-separated list of source systems to process. "
             "Allowed values: media, sports, automotive. Default: media,sports,automotive",
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


# ---------------------------------------------------------------------
# IO HELPERS
# ---------------------------------------------------------------------

def get_pairs_file(source_system):
    return os.path.join(PAIRS_BASE_DIR, source_system, "candidate_pairs.csv")


def get_records_file(source_system):
    return os.path.join(RECORDS_BASE_DIR, source_system, "all_standardized.csv")


def get_output_dir(source_system):
    out_dir = os.path.join(OUTPUT_BASE_DIR, source_system)
    os.makedirs(out_dir, exist_ok=True)
    return out_dir


def load_pairs(pairs_file):
    with open(pairs_file, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_records(records_file):
    with open(records_file, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_ground_truth_optional():
    if not os.path.exists(GROUND_TRUTH):
        return None
    with open(GROUND_TRUTH, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------
# UNION-FIND
# ---------------------------------------------------------------------

class UnionFind:
    """Union-Find with path compression, union by rank, and cluster size cap."""

    def __init__(self, max_cluster_size=None):
        self.parent = {}
        self.rank = {}
        self.size = {}
        self.max_cluster_size = max_cluster_size

    def find(self, x):
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
            self.size[x] = 1
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return True
        if self.max_cluster_size and self.size[rx] + self.size[ry] > self.max_cluster_size:
            return False
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        self.size[rx] += self.size[ry]
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1
        return True

    def get_clusters(self):
        clusters = defaultdict(list)
        for node in self.parent:
            clusters[self.find(node)].append(node)
        return dict(clusters)


# ---------------------------------------------------------------------
# PROCESSING PER SOURCE SYSTEM
# ---------------------------------------------------------------------

def process_source_system(source_system, gt):
    pairs_file = get_pairs_file(source_system)
    records_file = get_records_file(source_system)

    if not os.path.exists(records_file):
        print(f"SKIP: Standardized records not found for '{source_system}': {records_file}")
        return

    if not os.path.exists(pairs_file):
        print(f"WARN: Candidate pairs not found for '{source_system}': {pairs_file}")
        print("      All records will be singletons.")
        pairs = []
    else:
        pairs = load_pairs(pairs_file)

    out_dir = get_output_dir(source_system)
    output_clusters = os.path.join(out_dir, "clustered_records.csv")
    output_summary = os.path.join(out_dir, "cluster_summary.json")
    output_index = os.path.join(out_dir, "cluster_index.json")
    output_index_db = os.path.join(out_dir, "cluster_index.sqlite")

    print(f"\n=== Processing source system: {source_system} ===\n")
    print(f"Pairs   : {pairs_file}")
    print(f"Records : {records_file}")
    print(f"Output  : {out_dir}\n")
    print(f"Loaded {len(pairs)} matched pairs")

    records = load_records(records_file)
    record_map = {r["record_id"]: r for r in records if r.get("record_id")}
    all_record_ids = set(record_map.keys())
    print(f"Loaded {len(records)} total records\n")

    # Process stronger edges first so weak edges don't chain unrelated clusters
    TIER_ORDER = {"exact": 0, "strong": 1, "medium": 2, "weak": 3}
    pairs_sorted = sorted(
        pairs,
        key=lambda p: (TIER_ORDER.get(p.get("edge_type", "weak"), 9), -float(p.get("score", 0) or 0)),
    )

    uf = UnionFind(max_cluster_size=MAX_CLUSTER_SIZE)

    for rid in all_record_ids:
        uf.find(rid)

    rejected = 0
    rejected_by_tier = defaultdict(int)
    for pair in pairs_sorted:
        ok = uf.union(pair["record_id_1"], pair["record_id_2"])
        if not ok:
            rejected += 1
            rejected_by_tier[pair.get("edge_type", "unknown")] += 1

    if rejected:
        print(f"  Rejected {rejected:,} edges that would exceed max cluster size ({MAX_CLUSTER_SIZE}):")
        for tier, cnt in sorted(rejected_by_tier.items(), key=lambda x: -x[1]):
            print(f"    {tier}: {cnt:,}")

    clusters = uf.get_clusters()

    # Cluster IDs prefixed by source system so cross-system IDs don't collide
    prefix = source_system[:3].upper()
    sorted_clusters = sorted(clusters.values(), key=len, reverse=True)
    cluster_id_map = {}
    for idx, members in enumerate(sorted_clusters, 1):
        cid = f"{prefix}-CL-{idx:06d}"
        for rid in members:
            cluster_id_map[rid] = cid

    sizes = [len(c) for c in sorted_clusters]
    singletons = sum(1 for s in sizes if s == 1)
    multi = len(sizes) - singletons

    print(f"Clusters formed: {len(sorted_clusters)}")
    print(f"  Multi-record clusters: {multi}")
    print(f"  Singletons: {singletons}")
    print(f"  Largest cluster: {sizes[0] if sizes else 0} records")
    if multi:
        avg_non_single = sum(s for s in sizes if s > 1) / multi
        print(f"  Avg cluster size (non-singleton): {avg_non_single:.1f}")

    size_dist = defaultdict(int)
    for s in sizes:
        if s == 1:
            size_dist["1"] += 1
        elif s <= 5:
            size_dist["2-5"] += 1
        elif s <= 10:
            size_dist["6-10"] += 1
        elif s <= 25:
            size_dist["11-25"] += 1
        elif s <= 50:
            size_dist["26-50"] += 1
        elif s <= 100:
            size_dist["51-100"] += 1
        else:
            size_dist["100+"] += 1

    print("\n  Cluster size distribution:")
    for bucket in ["1", "2-5", "6-10", "11-25", "26-50", "51-100", "100+"]:
        count = size_dist.get(bucket, 0)
        bar = "#" * min(count // 5, 50)
        print(f"    {bucket:>7s}: {count:>6,}  {bar}")

    # Evaluation vs ground truth (optional)
    precision = None
    recall = None
    impure_clusters = 0
    partially_recalled = 0
    if gt is not None:
        print("\n--- Evaluation vs Ground Truth ---")
        pure_clusters = 0
        impure_details = []

        for idx, members in enumerate(sorted_clusters, 1):
            cid = f"{prefix}-CL-{idx:06d}"
            gt_ids = set()
            for rid in members:
                if rid in gt:
                    gt_ids.add(gt[rid])

            if len(gt_ids) <= 1:
                pure_clusters += 1
            else:
                impure_clusters += 1
                if len(impure_details) < 10:
                    impure_details.append({
                        "cluster_id": cid,
                        "size": len(members),
                        "customer_ids": list(gt_ids),
                        "num_customers": len(gt_ids),
                    })

        precision = pure_clusters / len(sorted_clusters) * 100 if sorted_clusters else 0

        # Scope true clusters to records present in this system
        true_clusters = defaultdict(set)
        for rid, cust_id in gt.items():
            if rid in all_record_ids:
                true_clusters[cust_id].add(rid)

        fully_recalled = 0
        fragmented = []
        for cust_id, true_members in true_clusters.items():
            predicted_clusters = set()
            for rid in true_members:
                if rid in cluster_id_map:
                    predicted_clusters.add(cluster_id_map[rid])

            if len(predicted_clusters) == 1:
                fully_recalled += 1
            else:
                partially_recalled += 1
                if len(fragmented) < 10:
                    fragmented.append({
                        "customer_id": cust_id,
                        "true_size": len(true_members),
                        "split_into": len(predicted_clusters),
                    })

        recall = fully_recalled / len(true_clusters) * 100 if true_clusters else 0

        print(f"  Cluster purity (precision): {pure_clusters}/{len(sorted_clusters)} ({precision:.1f}%)")
        print(f"  Customer recall: {fully_recalled}/{len(true_clusters)} ({recall:.1f}%)")

        if impure_details:
            print("\n  Sample impure clusters (mixed customers):")
            for d in impure_details[:5]:
                print(f"    {d['cluster_id']}: {d['size']} records, {d['num_customers']} customers ({d['customer_ids'][:5]})")

        if fragmented:
            print("\n  Sample fragmented customers (split across clusters):")
            for d in fragmented[:5]:
                print(f"    Customer {d['customer_id']}: {d['true_size']} records split into {d['split_into']} clusters")
    else:
        print("\n[INFO] Skipping eval — no ground truth provided.")

    # Write clustered records
    output_rows = []
    for record in records:
        rid = record["record_id"]
        row = dict(record)
        row["cluster_id"] = cluster_id_map.get(rid, "")
        output_rows.append(row)

    if output_rows:
        fieldnames = list(output_rows[0].keys())
        with open(output_clusters, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(output_rows)

    print(f"\nWrote {len(output_rows)} records to {output_clusters}")

    summary = {
        "source_system": source_system,
        "total_records": len(records),
        "total_clusters": len(sorted_clusters),
        "multi_record_clusters": multi,
        "singletons": singletons,
        "largest_cluster": sizes[0] if sizes else 0,
        "size_distribution": dict(size_dist),
    }
    if precision is not None:
        summary["precision_purity"] = round(precision, 2)
        summary["recall"] = round(recall, 2)
        summary["impure_clusters"] = impure_clusters
        summary["fragmented_customers"] = partially_recalled

    with open(output_summary, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"Wrote cluster summary to {output_summary}")

    cluster_index = {}
    conn = reset_cluster_index_db(output_index_db)
    for idx, members in enumerate(sorted_clusters, 1):
        cid = f"{prefix}-CL-{idx:06d}"
        unique_members = sorted(set(members))
        node_rows = [record_map.get(rid, {}) for rid in unique_members if record_map.get(rid)]
        sample = next((row for row in node_rows if row), {})
        source_files = sorted({record_map.get(rid, {}).get("source_file", "") for rid in members if record_map.get(rid, {}).get("source_file", "")})
        sample_name = sample.get("full_name", "") or " ".join(
            part for part in [sample.get("first_name", ""), sample.get("last_name", "")] if part
        )
        cluster_index[cid] = {
            "cluster_id": cid,
            "unique_node_count": len(unique_members),
            "source_count": len(source_files),
            "source_files": source_files,
            "sample_email": sample.get("email", ""),
            "sample_name": sample_name,
        }
        if conn is not None:
            conn.execute(
                "INSERT INTO clusters(cluster_id, unique_node_count, source_count, sample_email, sample_name) VALUES (?, ?, ?, ?, ?)",
                (cid, len(unique_members), len(source_files), sample.get("email", ""), sample_name),
            )
            conn.executemany(
                "INSERT INTO cluster_nodes(cluster_id, record_id, payload) VALUES (?, ?, ?)",
                ((cid, row.get("record_id", ""), json.dumps(row, separators=(",", ":"))) for row in node_rows if row.get("record_id")),
            )
    if conn is not None:
        conn.commit()
        conn.close()
    with open(output_index, "w", encoding="utf-8") as f:
        json.dump(cluster_index, f, indent=2)

    print(f"Wrote cluster index to {output_index}")
    if conn is None:
        print("Skipped local cluster SQLite index in Unity Catalog mode")
    else:
        print(f"Wrote cluster SQLite index to {output_index_db}")


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

    return build_clustering_service().run(selected_source_systems)

    print("=== Step 4: Clustering (Connected Components) ===\n")
    print(f"Selected source systems: {', '.join(selected_source_systems)}\n")

    gt = load_ground_truth_optional()
    if gt is None:
        print(f"[INFO] {GROUND_TRUTH} not found — evaluation sections will be skipped.\n")

    for source_system in selected_source_systems:
        process_source_system(source_system, gt)

    print("\n=== Clustering complete! ===")


if __name__ == "__main__":
    main()
