"""
Step 6 — Evaluation
Compares clustering results against ground truth.
Measures precision, recall, F1 at both cluster and pairwise levels.
Breaks down metrics by edge tier (exact/strong/weak).

Supports user-controlled source-system execution:
    --source-systems media
    --source-systems sports
    --source-systems media,sports,automotive

Input:
    clustering_output/<source_system>/clustered_records.csv
    clustering_output/<source_system>/cluster_summary.json   (optional, for context)
    matching_output/<source_system>/candidate_pairs.csv
    golden_records_output/<source_system>/golden_record_summary.json (optional)
    generated_data/ground_truth.json                          (optional — skipped if missing)

Output:
    evaluation_output/<source_system>/evaluation_report.json
"""

import argparse
import csv
import json
import os
from collections import defaultdict
from itertools import combinations
from services.evaluation_service import EvaluationService
from services.pipeline_base import PipelineStepContext
import pipeline_uc_bootstrap  # noqa: F401

from legacy_pipeline_config import (
    default_source_systems,
    pipeline_directory,
    source_systems as configured_source_systems,
)

CLUSTERS_BASE_DIR = pipeline_directory("clustering_output", "clustering_output")
PAIRS_BASE_DIR = pipeline_directory("matching_output", "matching_output")
OUTPUT_BASE_DIR = pipeline_directory("evaluation_output", "evaluation_output")
GROUND_TRUTH = os.path.join(pipeline_directory("generated_data", "generated_data"), "ground_truth.json")
SOURCE_SYSTEMS = configured_source_systems()
DEFAULT_SOURCE_SYSTEMS = default_source_systems()


def build_evaluation_service():
    return EvaluationService(
        context=PipelineStepContext(
            source_systems=SOURCE_SYSTEMS,
            default_source_systems=DEFAULT_SOURCE_SYSTEMS,
        ),
        ground_truth_path=GROUND_TRUTH,
        load_ground_truth=load_ground_truth_optional,
        process_source_system=process_source_system,
    )





# ---------------------------------------------------------------------
# ARGUMENTS
# ---------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description="Step 6 — Evaluation")
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

def get_clustered_file(source_system):
    return os.path.join(CLUSTERS_BASE_DIR, source_system, "clustered_records.csv")


def get_pairs_file(source_system):
    return os.path.join(PAIRS_BASE_DIR, source_system, "candidate_pairs.csv")


def get_output_dir(source_system):
    out_dir = os.path.join(OUTPUT_BASE_DIR, source_system)
    os.makedirs(out_dir, exist_ok=True)
    return out_dir


def load_ground_truth_optional():
    if not os.path.exists(GROUND_TRUTH):
        return None
    with open(GROUND_TRUTH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_clustered(clustered_file):
    with open(clustered_file, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_pairs(pairs_file):
    if not os.path.exists(pairs_file):
        return []
    with open(pairs_file, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------------
# METRIC HELPERS
# ---------------------------------------------------------------------

def build_true_pairs(gt, in_scope):
    """Build set of all true positive pairs, scoped to in_scope record_ids."""
    customer_records = defaultdict(set)
    for rid, cust_id in gt.items():
        if rid in in_scope:
            customer_records[cust_id].add(rid)

    true_pairs = set()
    for cust_id, rids in customer_records.items():
        for r1, r2 in combinations(sorted(rids), 2):
            true_pairs.add((r1, r2))

    return true_pairs, customer_records


def build_predicted_pairs(records):
    """Build set of all predicted pairs. Large clusters (>500) are counted analytically."""
    MAX_ENUM = 500

    clusters = defaultdict(set)
    for r in records:
        cid = r.get("cluster_id", "")
        if cid:
            clusters[cid].add(r["record_id"])

    predicted_pairs = set()
    large_cluster_pair_count = 0
    for cid, rids in clusters.items():
        if len(rids) <= MAX_ENUM:
            for r1, r2 in combinations(sorted(rids), 2):
                predicted_pairs.add((r1, r2))
        else:
            n = len(rids)
            large_cluster_pair_count += n * (n - 1) // 2
            print(f"  [NOTE] Cluster {cid} has {n:,} records — skipping pair enumeration ({n*(n-1)//2:,} pairs)")

    return predicted_pairs, clusters, large_cluster_pair_count


def pairwise_metrics(true_pairs, predicted_pairs, clusters, gt):
    MAX_ENUM = 500

    tp = len(true_pairs & predicted_pairs)
    fp = len(predicted_pairs - true_pairs)
    fn = len(true_pairs - predicted_pairs)

    for cid, rids in clusters.items():
        if len(rids) <= MAX_ENUM:
            continue
        cust_groups = defaultdict(int)
        for rid in rids:
            c = gt.get(rid)
            if c is not None:
                cust_groups[c] += 1
        cluster_tp = sum(n * (n - 1) // 2 for n in cust_groups.values())
        cluster_total = len(rids) * (len(rids) - 1) // 2
        cluster_fp = cluster_total - cluster_tp
        tp += cluster_tp
        fp += cluster_fp
        fn -= cluster_tp

    fn = max(fn, 0)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
    }


def cluster_purity(clusters, gt):
    pure = 0
    impure = 0
    impure_details = []

    for cid, rids in clusters.items():
        cust_ids = set()
        for rid in rids:
            if rid in gt:
                cust_ids.add(gt[rid])

        if len(cust_ids) <= 1:
            pure += 1
        else:
            impure += 1
            if len(impure_details) < 10:
                impure_details.append({
                    "cluster_id": cid,
                    "size": len(rids),
                    "num_customers": len(cust_ids),
                    "customer_ids": sorted(cust_ids)[:5],
                })

    total = pure + impure
    return {
        "pure": pure,
        "impure": impure,
        "total": total,
        "purity": round(pure / total, 4) if total > 0 else 0.0,
        "impure_examples": impure_details,
    }


def cluster_completeness(customer_records, record_to_cluster):
    fully_recalled = 0
    fragmented = 0
    fragmented_details = []

    for cust_id, true_rids in customer_records.items():
        pred_clusters = set()
        for rid in true_rids:
            cid = record_to_cluster.get(rid)
            if cid:
                pred_clusters.add(cid)

        if len(pred_clusters) == 1:
            fully_recalled += 1
        else:
            fragmented += 1
            if len(fragmented_details) < 10:
                fragmented_details.append({
                    "customer_id": cust_id,
                    "true_records": len(true_rids),
                    "split_into": len(pred_clusters),
                })

    total = fully_recalled + fragmented
    return {
        "fully_recalled": fully_recalled,
        "fragmented": fragmented,
        "total": total,
        "completeness": round(fully_recalled / total, 4) if total > 0 else 0.0,
        "fragmented_examples": fragmented_details,
    }


def edge_tier_analysis(pairs, gt):
    tier_stats = defaultdict(lambda: {"tp": 0, "fp": 0, "total": 0})

    for pair in pairs:
        r1 = pair["record_id_1"]
        r2 = pair["record_id_2"]
        tier = pair.get("edge_type", "unknown")
        is_same = gt.get(r1) == gt.get(r2) and r1 in gt and r2 in gt

        tier_stats[tier]["total"] += 1
        if is_same:
            tier_stats[tier]["tp"] += 1
        else:
            tier_stats[tier]["fp"] += 1

    result = {}
    for tier in ["exact", "strong", "medium", "weak"]:
        s = tier_stats.get(tier, {"tp": 0, "fp": 0, "total": 0})
        precision = s["tp"] / s["total"] if s["total"] > 0 else 0.0
        result[tier] = {
            "total_pairs": s["total"],
            "true_positives": s["tp"],
            "false_positives": s["fp"],
            "precision": round(precision, 4),
        }

    return result


def size_bucket_analysis(clusters, gt):
    buckets = {
        "1 (singleton)": {"pure": 0, "impure": 0},
        "2-5": {"pure": 0, "impure": 0},
        "6-10": {"pure": 0, "impure": 0},
        "11-25": {"pure": 0, "impure": 0},
        "26-50": {"pure": 0, "impure": 0},
        "51+": {"pure": 0, "impure": 0},
    }

    for cid, rids in clusters.items():
        size = len(rids)
        if size == 1:
            bucket = "1 (singleton)"
        elif size <= 5:
            bucket = "2-5"
        elif size <= 10:
            bucket = "6-10"
        elif size <= 25:
            bucket = "11-25"
        elif size <= 50:
            bucket = "26-50"
        else:
            bucket = "51+"

        cust_ids = set(gt.get(rid) for rid in rids if rid in gt)
        if len(cust_ids) <= 1:
            buckets[bucket]["pure"] += 1
        else:
            buckets[bucket]["impure"] += 1

    result = {}
    for bucket, counts in buckets.items():
        total = counts["pure"] + counts["impure"]
        result[bucket] = {
            "total": total,
            "pure": counts["pure"],
            "impure": counts["impure"],
            "purity": round(counts["pure"] / total, 4) if total > 0 else 0.0,
        }

    return result


# ---------------------------------------------------------------------
# PROCESSING PER SOURCE SYSTEM
# ---------------------------------------------------------------------

def process_source_system(source_system, gt):
    clustered_file = get_clustered_file(source_system)
    pairs_file = get_pairs_file(source_system)

    if not os.path.exists(clustered_file):
        print(f"SKIP: Clustered records not found for '{source_system}': {clustered_file}")
        return

    out_dir = get_output_dir(source_system)
    out_report = os.path.join(out_dir, "evaluation_report.json")

    print(f"\n=== Processing source system: {source_system} ===\n")
    print(f"Clustered: {clustered_file}")
    print(f"Pairs    : {pairs_file}")
    print(f"Output   : {out_report}\n")

    records = load_clustered(clustered_file)
    pairs = load_pairs(pairs_file)

    print(f"Loaded {len(records)} clustered records, {len(pairs)} candidate pairs")

    record_ids = set(r["record_id"] for r in records if r.get("record_id"))

    # Source-file breakdown — always reported, even without gt
    source_breakdown = defaultdict(int)
    cluster_sizes = defaultdict(set)
    for r in records:
        if r.get("source_file"):
            source_breakdown[r["source_file"]] += 1
        cid = r.get("cluster_id", "")
        if cid:
            cluster_sizes[cid].add(r["record_id"])

    cluster_count = len(cluster_sizes)
    multi_clusters = sum(1 for s in cluster_sizes.values() if len(s) > 1)

    print(f"\n--- Cluster Composition ---")
    print(f"  Total clusters: {cluster_count:,}")
    print(f"  Multi-record clusters: {multi_clusters:,}")
    print(f"  Singletons: {cluster_count - multi_clusters:,}")
    print(f"\n--- Record Source Breakdown ---")
    for src, cnt in sorted(source_breakdown.items(), key=lambda x: -x[1]):
        print(f"  {src}: {cnt:,}")

    report = {
        "source_system": source_system,
        "total_records": len(records),
        "total_pairs": len(pairs),
        "total_clusters": cluster_count,
        "multi_record_clusters": multi_clusters,
        "singletons": cluster_count - multi_clusters,
        "source_breakdown": dict(source_breakdown),
    }

    if gt is None:
        print("\n[INFO] No ground truth — skipping evaluation metrics.")
        with open(out_report, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"\nSaved evaluation report to {out_report}")
        return

    # Pair sets — true pairs scoped to records present in this system
    print("\nBuilding true pair set...")
    true_pairs, customer_records = build_true_pairs(gt, record_ids)
    print(f"  True pairs: {len(true_pairs):,}")

    print("Building predicted pair set...")
    predicted_pairs, clusters, large_extra = build_predicted_pairs(records)
    total_predicted = len(predicted_pairs) + large_extra
    print(f"  Predicted pairs: {total_predicted:,} (enumerated: {len(predicted_pairs):,}, large-cluster: {large_extra:,})")

    record_to_cluster = {}
    for r in records:
        record_to_cluster[r["record_id"]] = r.get("cluster_id", "")

    # Pairwise metrics
    print("\n--- Pairwise Metrics ---")
    pw = pairwise_metrics(true_pairs, predicted_pairs, clusters, gt)
    print(f"  True Positives:  {pw['true_positives']:>12,}")
    print(f"  False Positives: {pw['false_positives']:>12,}")
    print(f"  False Negatives: {pw['false_negatives']:>12,}")
    print(f"  Precision:       {pw['precision']:>12.4f}")
    print(f"  Recall:          {pw['recall']:>12.4f}")
    print(f"  F1 Score:        {pw['f1']:>12.4f}")

    # Cluster purity
    print("\n--- Cluster Purity ---")
    purity = cluster_purity(clusters, gt)
    print(f"  Pure clusters:   {purity['pure']:>6,} / {purity['total']:,}")
    print(f"  Impure clusters: {purity['impure']:>6,}")
    print(f"  Purity:          {purity['purity']:.4f}")
    if purity["impure_examples"]:
        print(f"  Impure examples:")
        for ex in purity["impure_examples"][:5]:
            print(f"    {ex['cluster_id']}: {ex['size']} records, {ex['num_customers']} customers")

    # Cluster completeness
    print("\n--- Cluster Completeness (Recall) ---")
    completeness = cluster_completeness(customer_records, record_to_cluster)
    print(f"  Fully recalled:  {completeness['fully_recalled']:>6,} / {completeness['total']:,} customers")
    print(f"  Fragmented:      {completeness['fragmented']:>6,}")
    print(f"  Completeness:    {completeness['completeness']:.4f}")
    if completeness["fragmented_examples"]:
        print(f"  Fragmented examples:")
        for ex in completeness["fragmented_examples"][:5]:
            print(f"    Customer {ex['customer_id']}: {ex['true_records']} records -> {ex['split_into']} clusters")

    # Edge tier precision
    print("\n--- Edge Tier Precision ---")
    tier_analysis = edge_tier_analysis(pairs, gt)
    print(f"  {'Tier':<10} {'Total':>10} {'TP':>10} {'FP':>10} {'Precision':>10}")
    print(f"  {'-'*50}")
    for tier in ["exact", "strong", "medium", "weak"]:
        t = tier_analysis.get(tier, {})
        print(f"  {tier:<10} {t.get('total_pairs',0):>10,} {t.get('true_positives',0):>10,} "
              f"{t.get('false_positives',0):>10,} {t.get('precision',0):>10.4f}")

    # Purity by size
    print("\n--- Purity by Cluster Size ---")
    size_analysis = size_bucket_analysis(clusters, gt)
    print(f"  {'Size':<15} {'Total':>8} {'Pure':>8} {'Impure':>8} {'Purity':>8}")
    print(f"  {'-'*50}")
    for bucket in ["1 (singleton)", "2-5", "6-10", "11-25", "26-50", "51+"]:
        s = size_analysis.get(bucket, {})
        if s.get("total", 0) > 0:
            print(f"  {bucket:<15} {s['total']:>8,} {s['pure']:>8,} {s['impure']:>8,} {s['purity']:>8.4f}")

    print("\n--- Summary ---")
    print(f"  Pairwise Precision: {pw['precision']:.4f}")
    print(f"  Pairwise Recall:    {pw['recall']:.4f}")
    print(f"  Pairwise F1:        {pw['f1']:.4f}")
    print(f"  Cluster Purity:     {purity['purity']:.4f}")
    print(f"  Cluster Recall:     {completeness['completeness']:.4f}")

    report.update({
        "pairwise": pw,
        "cluster_purity": {
            "pure": purity["pure"],
            "impure": purity["impure"],
            "total": purity["total"],
            "purity": purity["purity"],
        },
        "cluster_completeness": {
            "fully_recalled": completeness["fully_recalled"],
            "fragmented": completeness["fragmented"],
            "total": completeness["total"],
            "completeness": completeness["completeness"],
        },
        "edge_tier_precision": tier_analysis,
        "purity_by_size": size_analysis,
    })

    with open(out_report, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nSaved evaluation report to {out_report}")


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

    return build_evaluation_service().run(selected_source_systems)

    print("=" * 60)
    print("  Step 6: Evaluation Report")
    print("=" * 60)
    print(f"\nSelected source systems: {', '.join(selected_source_systems)}\n")

    gt = load_ground_truth_optional()
    if gt is None:
        print(f"[INFO] {GROUND_TRUTH} not found — evaluation sections will be skipped.")
    else:
        print(f"Loaded {len(gt)} ground truth mappings")

    for source_system in selected_source_systems:
        process_source_system(source_system, gt)

    print(f"\n{'=' * 60}")


if __name__ == "__main__":
    main()
