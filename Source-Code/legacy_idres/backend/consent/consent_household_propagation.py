"""
consent_household_propagation.py
StreamPass CDP — Fix 5: Household Consent Propagation

Reads household_id from golden_records.csv (assigned by step5_golden_record.py
using device_id OR address+zip — the authoritative household definition).

If any household member is suppressed, propagates to all members
in the same household.

Run after consent_refresh.py:
    python consent_household_propagation.py
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict
from consent_runtime_guard import abort_if_uc_runtime

PROPAGATE_SUPPRESSION = True

ROOT           = str(Path(__file__).resolve().parent.parent.parent)
GOLDEN_CSV     = os.path.join(ROOT, "golden_records.csv")
CONSENT_GOLDEN = os.path.join(ROOT, "generated_data", "enriched", "consent_golden_record.csv")
AUDIT_OUTPUT   = os.path.join(ROOT, "generated_data", "household_consent_flags.csv")


def log(msg):
    ts = datetime.now(timezone.utc).strftime('%H:%M:%S')
    encoding = sys.stdout.encoding or "utf-8"
    safe_msg = str(msg).encode(encoding, errors="replace").decode(encoding)
    print(f"[household_consent {ts}] {safe_msg}")


def main():
    abort_if_uc_runtime("consent_household_propagation.py")

    if not os.path.exists(GOLDEN_CSV):
        log("ERROR: golden_records.csv not found.")
        return
    if not os.path.exists(CONSENT_GOLDEN):
        log("ERROR: consent_golden_record.csv not found.")
        return

    log("Loading files ...")
    gr      = pd.read_csv(GOLDEN_CSV, low_memory=False)
    consent = pd.read_csv(CONSENT_GOLDEN, low_memory=False)
    log(f"  Golden records   : {len(gr):,} rows")
    log(f"  Consent records  : {len(consent):,} MOSCIDs")

    # ── Check household_id exists ─────────────────────────────────────────────
    if "household_id" not in gr.columns:
        log("ERROR: household_id column not found in golden_records.csv")
        log("  Run step5_golden_record.py first to assign household IDs")
        return

    # ── Build household clusters from golden_records.csv ─────────────────────
    # group golden_id by household_id — only multi-member households
    hh_groups = gr[gr["household_id"].notna() & (gr["household_id"] != "")]\
        .groupby("household_id")["golden_id"].apply(list).to_dict()

    multi_hh = {hid: members for hid, members in hh_groups.items() if len(members) > 1}
    log(f"  Multi-member households (device+address) : {len(multi_hh):,}")
    log(f"  Total GR-IDs in multi-member households  : {sum(len(m) for m in multi_hh.values()):,}")

    # ── Index consent by GR-ID ────────────────────────────────────────────────
    consent_map = {str(row["moscid"]).strip(): row.to_dict()
                   for _, row in consent.iterrows()}
    log(f"  Consent index built : {len(consent_map):,} keys")

    # ── Propagate suppression ─────────────────────────────────────────────────
    log("Propagating suppression across households ...")

    audit_rows       = []
    propagated_count = 0
    households_hit   = 0

    for hid, members in multi_hh.items():
        in_consent = [gid for gid in members if str(gid).strip() in consent_map]
        if not in_consent:
            continue

        # Find suppressed members in this household
        suppressed = []
        for gid in in_consent:
            rec = consent_map[str(gid).strip()]
            if rec.get("marketing_suppressed") == True:
                suppressed.append({
                    "gid":    str(gid).strip(),
                    "reason": str(rec.get("suppression_reason") or "marketing_suppressed"),
                })

        if not suppressed:
            continue

        households_hit += 1
        trigger = suppressed[0]

        # Propagate to all non-suppressed members
        for gid in in_consent:
            gid = str(gid).strip()
            if gid in [s["gid"] for s in suppressed]:
                continue

            audit_rows.append({
                "golden_id":            gid,
                "household_id":         hid,
                "household_suppressor": trigger["gid"],
                "suppression_reason":   f"household_propagation:{trigger['reason']}",
                "action":               "suppressed" if PROPAGATE_SUPPRESSION else "flagged",
                "propagated_at":        datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S'),
            })

            if PROPAGATE_SUPPRESSION:
                consent_map[gid]["marketing_suppressed"]    = True
                consent_map[gid]["suppression_reason"]      = f"household_propagation:{trigger['reason']}"
                consent_map[gid]["household_suppressed"]    = True
                consent_map[gid]["household_suppressor_id"] = trigger["gid"]
                consent_map[gid]["household_id"]            = hid
                propagated_count += 1

    log(f"  Households affected : {households_hit:,}")
    log(f"  Members propagated  : {propagated_count:,}")

    # ── Rebuild and save ──────────────────────────────────────────────────────
    updated_df = pd.DataFrame(list(consent_map.values()))
    orig_cols  = consent.columns.tolist()
    new_cols   = [c for c in updated_df.columns if c not in orig_cols]
    for col in orig_cols:
        if col not in updated_df.columns:
            updated_df[col] = None
    updated_df[orig_cols + new_cols].to_csv(CONSENT_GOLDEN, index=False)
    log(f"  consent_golden_record.csv updated : {len(updated_df):,} rows")

    if audit_rows:
        pd.DataFrame(audit_rows).to_csv(AUDIT_OUTPUT, index=False)
        log(f"  Audit log: {AUDIT_OUTPUT}")
    else:
        log("  No household suppression propagation needed")

    total_now = sum(1 for r in consent_map.values()
                    if r.get("marketing_suppressed") == True)

    log(f"\n{'='*55}")
    log("HOUSEHOLD CONSENT PROPAGATION COMPLETE")
    log(f"{'='*55}")
    log(f"Source            : golden_records.csv household_id")
    log(f"Method            : device_id OR address+zip (Step 5)")
    log(f"Mode              : {'HARD SUPPRESS' if PROPAGATE_SUPPRESSION else 'SOFT FLAG'}")
    log(f"Households hit    : {households_hit:,}")
    log(f"Members propagated: {propagated_count:,}")
    log(f"Total suppressed  : {total_now:,}")
    log(f"{'='*55}")


if __name__ == "__main__":
    main()
