"""
consent_idr_join.py
StreamPass CDP — Step 2: Identity Resolution Join

Reads all 5 enriched source files, extracts consent-relevant rows,
resolves each record to a MOSCID via the identity graph, and outputs
a single unified consent_events_linked.csv.

Unresolved records are written separately to consent_events_unlinked.csv
for a reconciliation pass — never silently dropped.

Usage:
    python consent_idr_join.py --enriched_dir ./generated_data/enriched
                               --output_dir   ./generated_data/enriched
                               --identity_graph_path ./identity_graph.csv

Pipeline position:
    consent_enrich.py  →  [THIS FILE]  →  consent_ledger.py
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import numpy as np
import argparse
import os
import sys
from pathlib import Path
from consent_runtime_guard import abort_if_uc_runtime

# ── Constants ─────────────────────────────────────────────────────────────────

CONSENT_FIELDS = [
    "data_processing_consent",
    "global_consent",
    "marketing_comms_optout",
    "marketing_email_consent",
    "tracking_cookie_consent",
]

# Which identifier column(s) each source file carries
# Each source is resolved via (identifier_value, identifier_type) → MOSCID
SOURCE_CONFIG = {
    "subscription_billing.csv": {
        "identifiers":        [("billing_email", "user_email"), ("contact_phone", "phone"), ("email", "user_email")],
        "consent_source_val": "billing",
        "consent_cols":       ["data_processing_consent", "global_consent",
                               "consent_timestamp", "consent_version", "consent_source"],
    },
    "email_engagement.csv": {
        "identifiers":        [("recipient_email", "user_email"), ("recipient_phone", "phone"), ("email", "user_email")],
        "consent_source_val": "email_engagement",
        "consent_cols":       ["marketing_email_consent", "consent_timestamp", "consent_source"],
    },
    "streaming_activity.csv": {
        "identifiers":        [("user_email", "user_email"), ("email", "user_email")],
        "consent_source_val": "website_banner",
        "consent_cols":       ["tracking_cookie_consent", "consent_timestamp", "consent_source"],
        "filter_nulls":       True,   # drop passive rows with no consent event
    },
    "customer_support.csv": {
        "identifiers":        [("customer_email", "user_email"), ("customer_phone", "phone"), ("email", "user_email")],
        "consent_source_val": "call_center",
        "consent_cols":       ["marketing_email_consent", "global_consent",
                               "consent_timestamp", "consent_source", "agent_id"],
    },
    "app_events.csv": {
        "identifiers":        [("app_user_email", "user_email"), ("email", "user_email"), ("device_id", "device_id")],
        "consent_source_val": "mobile_app",
        "consent_cols":       ["tracking_cookie_consent", "consent_timestamp", "consent_source"],
        "filter_nulls":       True,   # drop passive rows with no consent event
    },
}

# Canonical output schema for consent_events_linked.csv
LINKED_COLS = [
    "moscid",
    "raw_identifier",
    "identifier_type",
    "data_processing_consent",
    "global_consent",
    "marketing_comms_optout",
    "marketing_email_consent",
    "tracking_cookie_consent",
    "communication_type",
    "consent_timestamp",
    "consent_version",
    "consent_source",
    "agent_id",
    "link_status",          # "linked" | "unlinked"
    "source_file",
]

# communication_type per source (pipeline-assigned, not user-captured)
COMM_TYPE_MAP = {
    "billing":          "transactional",
    "email_engagement": "marketing",
    "website_banner":   None,
    "call_center":      "both",
    "mobile_app":       None,
}


def log(msg):
    encoding = sys.stdout.encoding or "utf-8"
    safe_msg = str(msg).encode(encoding, errors="replace").decode(encoding)
    print(f"[consent_idr_join] {safe_msg}")


# ── Identity Graph ─────────────────────────────────────────────────────────────

class IdentityGraph:
    """
    Lightweight wrapper around the identity graph lookup table.

    Expected identity_graph.csv schema:
        identifier_value | identifier_type | moscid

    If your existing pipeline exposes a different interface (e.g. a DB query,
    an API call, or a GraphX lookup), replace the resolve() method body with
    your actual lookup — the rest of this script does not change.
    """

    def __init__(self, graph_path=None):
        if graph_path and os.path.exists(graph_path):
            self.graph = pd.read_csv(graph_path, low_memory=False)
            self.graph["identifier_value"] = self.graph["identifier_value"].astype(str).str.lower().str.strip()
            self.graph["identifier_type"]  = self.graph["identifier_type"].astype(str).str.lower().str.strip()
            log(f"  Identity graph loaded: {len(self.graph):,} records from {graph_path}")
        else:
            # ── Fallback: generate a synthetic identity graph ──────────────────
            # REPLACE THIS with your actual graph when running on real data.
            log("  ⚠  No identity graph file found — using synthetic MOSCID generation.")
            log("     Pass --identity_graph_path to use your real identity graph.")
            self.graph = None

    def resolve(self, identifier_value: str, identifier_type: str) -> str | None:
        """
        Returns MOSCID string for a given identifier, or None if unresolvable.

        PLUG YOUR REAL LOOKUP HERE if not using a flat CSV graph.
        """
        if self.graph is None:
            # Synthetic fallback: deterministic MOSCID from identifier
            # Produces consistent MOSCIDs within a run for the same identifier
            if not identifier_value or pd.isna(identifier_value):
                return None
            hash_val = abs(hash(str(identifier_value).lower().strip())) % 1_000_000
            return f"MOSC-{str(hash_val).zfill(6)}"

        key = str(identifier_value).lower().strip()
        itype = str(identifier_type).lower().strip()
        match = self.graph[
            (self.graph["identifier_value"] == key) &
            (self.graph["identifier_type"]  == itype)
        ]
        return match["moscid"].iloc[0] if len(match) > 0 else None

    def resolve_batch(self, values: pd.Series, identifier_type: str) -> pd.Series:
        """Vectorised batch resolution for a full column."""
        return values.apply(lambda v: self.resolve(v, identifier_type))


# ── Per-file extraction ────────────────────────────────────────────────────────

def extract_consent_rows(df, config, filename):
    """
    From an enriched source dataframe, keep only rows that have at least
    one non-null consent field. Passive activity rows are dropped here.
    Returns a standardised dataframe ready for MOSCID resolution.
    """
    filter_nulls = config.get("filter_nulls", False)

    if filter_nulls:
        # Keep only rows where at least one consent field is populated
        consent_cols_present = [c for c in CONSENT_FIELDS if c in df.columns]
        has_consent = df[consent_cols_present].notna().any(axis=1)
        dropped = (~has_consent).sum()
        df = df[has_consent].reset_index(drop=True).copy()
        log(f"  Filter applied: {len(df):,} consent rows kept "
            f"({dropped:,} passive rows dropped)")

    n = len(df)
    # Standardise to canonical schema
    out = pd.DataFrame(index=range(n))
    out["source_file"] = filename

    # Best available identifier (try each in priority order)
    out["raw_identifier"]  = None
    out["identifier_type"] = None
    for id_col, id_type in config["identifiers"]:
        if id_col in df.columns:
            out["raw_identifier"]  = df[id_col].values
            out["identifier_type"] = id_type
            break

    # Consent fields — copy where present, else null
    for field in CONSENT_FIELDS:
        out[field] = df[field].values if field in df.columns else None

    # Metadata
    out["consent_timestamp"] = df["consent_timestamp"].values if "consent_timestamp" in df.columns else None
    out["consent_version"]   = df["consent_version"].values   if "consent_version"   in df.columns else None
    out["consent_source"]    = df["consent_source"].values    if "consent_source"    in df.columns else None
    out["agent_id"]          = df["agent_id"].values          if "agent_id"          in df.columns else None

    # Pipeline-assigned — not from the file
    src_val = config["consent_source_val"]
    out["communication_type"] = COMM_TYPE_MAP.get(src_val)

    return out


# ── MOSCID resolution ──────────────────────────────────────────────────────────

def resolve_moscids(df, identity_graph):
    """
    Resolves each row to a MOSCID.
    Rows that cannot be resolved are flagged as 'unlinked' — not dropped.
    """
    log("  Resolving MOSCIDs ...")

    df["moscid"] = [
        identity_graph.resolve(identifier_value, identifier_type)
        for identifier_value, identifier_type in zip(df["raw_identifier"], df["identifier_type"])
    ]
    df["link_status"] = np.where(df["moscid"].notna(), "linked", "unlinked")

    linked   = (df["link_status"] == "linked").sum()
    unlinked = (df["link_status"] == "unlinked").sum()
    log(f"  Linked: {linked:,} | Unlinked: {unlinked:,} "
        f"({unlinked/max(len(df),1)*100:.1f}% unresolved)")

    return df


# ── Main ──────────────────────────────────────────────────────────────────────

def main(enriched_dir, output_dir, identity_graph_path):
    abort_if_uc_runtime("consent_idr_join.py")

    os.makedirs(output_dir, exist_ok=True)

    identity_graph = IdentityGraph(identity_graph_path)

    all_frames = []
    total_raw  = 0

    for filename, config in SOURCE_CONFIG.items():
        path = os.path.join(enriched_dir, filename)
        if not os.path.exists(path):
            log(f"\nSKIP: {filename} not found in {enriched_dir}")
            continue

        log(f"\n{'─'*60}")
        log(f"Processing: {filename}")

        df = pd.read_csv(path, low_memory=False)
        log(f"  Loaded {len(df):,} rows")
        total_raw += len(df)

        extracted = extract_consent_rows(df, config, filename)
        log(f"  Consent rows extracted: {len(extracted):,}")

        resolved = resolve_moscids(extracted, identity_graph)
        all_frames.append(resolved)

    # ── Combine all sources ────────────────────────────────────────────────
    log(f"\n{'═'*60}")
    log("Combining all sources ...")

    combined = pd.concat(all_frames, ignore_index=True)

    # Enforce column order — add missing columns as null
    for col in LINKED_COLS:
        if col not in combined.columns:
            combined[col] = None
    combined = combined[LINKED_COLS]

    # ── Split linked vs unlinked ───────────────────────────────────────────
    linked_df   = combined[combined["link_status"] == "linked"]
    unlinked_df = combined[combined["link_status"] == "unlinked"]

    linked_path   = os.path.join(output_dir, "consent_events_linked.csv")
    unlinked_path = os.path.join(output_dir, "consent_events_unlinked.csv")

    linked_df.to_csv(linked_path,   index=False)
    unlinked_df.to_csv(unlinked_path, index=False)

    # ── Summary ───────────────────────────────────────────────────────────
    log(f"\n{'═'*60}")
    log("IDR JOIN COMPLETE")
    log(f"{'═'*60}")
    log(f"Total raw rows across all files : {total_raw:,}")
    log(f"Total consent events extracted  : {len(combined):,}")
    log(f"  → Linked   (consent_events_linked.csv)   : {len(linked_df):,}")
    log(f"  → Unlinked (consent_events_unlinked.csv) : {len(unlinked_df):,}")
    log(f"\nBreakdown by source:")
    for src, grp in combined.groupby("source_file"):
        l = (grp["link_status"] == "linked").sum()
        u = (grp["link_status"] == "unlinked").sum()
        log(f"  {src:<40} linked: {l:>6,}  unlinked: {u:>5,}")
    log(f"\nOutput directory: {os.path.abspath(output_dir)}")
    log(f"{'═'*60}")
    log("Next step → consent_ledger.py")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Consent IDR Join — link consent events to MOSCIDs")
    parser.add_argument(
        "--enriched_dir",
        default=str(Path(__file__).resolve().parent.parent.parent / "generated_data" / "enriched"),
        help="Directory containing enriched source CSVs (output of consent_enrich.py)"
    )
    parser.add_argument(
        "--output_dir",
        default=str(Path(__file__).resolve().parent.parent.parent / "generated_data" / "enriched"),
        help="Directory to write consent_events_linked.csv and consent_events_unlinked.csv"
    )
    parser.add_argument(
        "--identity_graph_path",
        default=str(Path(__file__).resolve().parent.parent.parent / "generated_data" / "identity_graph.csv"),
        help="Path to identity graph CSV (identifier_value | identifier_type | moscid). "
             "If not found, synthetic MOSCIDs are generated for testing."
    )
    args = parser.parse_args()
    main(args.enriched_dir, args.output_dir, args.identity_graph_path)
