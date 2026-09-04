"""
build_identity_graph.py
Builds identity_graph.csv from golden_records.csv.
Maps email → golden_id (GR-XXXXXX) so consent pipeline
resolves real GR- IDs instead of synthetic MOSC- IDs.

Run once before re-running the consent pipeline:
    python build_identity_graph.py
"""
import pandas as pd
import os

GOLDEN_CSV   = r"C:\Users\ambika257346\Downloads\IDRes-2026-04-07 1\golden_records.csv"
GRAPH_OUTPUT = r"C:\Users\ambika257346\Downloads\IDRes-2026-04-07 1\generated_data\identity_graph.csv"

print("[build_identity_graph] Reading golden_records.csv ...")
gr = pd.read_csv(GOLDEN_CSV, low_memory=False)
print(f"  Loaded {len(gr):,} golden records")

rows = []

# Email → GR ID
if "email" in gr.columns:
    email_rows = gr[["golden_id","email"]].dropna(subset=["email"])
    for _, r in email_rows.iterrows():
        rows.append({
            "identifier_value": str(r["email"]).lower().strip(),
            "identifier_type":  "user_email",
            "moscid":           r["golden_id"],
        })
    print(f"  Email mappings     : {len(email_rows):,}")

# Phone → GR ID (if exists)
if "phone" in gr.columns:
    phone_rows = gr[["golden_id","phone"]].dropna(subset=["phone"])
    for _, r in phone_rows.iterrows():
        rows.append({
            "identifier_value": str(r["phone"]).strip(),
            "identifier_type":  "phone",
            "moscid":           r["golden_id"],
        })
    print(f"  Phone mappings     : {len(phone_rows):,}")

graph_df = pd.DataFrame(rows).drop_duplicates(subset=["identifier_value","identifier_type"])
os.makedirs(os.path.dirname(GRAPH_OUTPUT), exist_ok=True)
graph_df.to_csv(GRAPH_OUTPUT, index=False)

print(f"\n  Identity graph written: {GRAPH_OUTPUT}")
print(f"  Total mappings        : {len(graph_df):,}")
print(f"  Unique GR- IDs        : {graph_df['moscid'].nunique():,}")
print("\nNow re-run the consent pipeline:")
print("  python consent_enrich.py")
print("  python consent_idr_join.py")
print("  python consent_ledger.py")
print("  python consent_survivorship.py")
print("  python consent_golden_record.py")
