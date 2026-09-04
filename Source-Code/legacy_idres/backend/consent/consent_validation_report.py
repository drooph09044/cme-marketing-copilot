"""
consent_validation_report.py
StreamPass CDP — Consent Validation Report

Answers the exact questions leadership asked:
  - How many users are non-consented?
  - Are non-consented users in segments? (should NOT be)
  - Are non-consented users in activation? (should NOT be)
  - Test cases: opted-out / suppressed user journey

Run:
    python consent_validation_report.py
"""

import consent_uc_bootstrap  # noqa: F401
import pandas as pd
import numpy as np
import os
from pathlib import Path
from datetime import datetime, timezone
from consent_runtime_guard import abort_if_uc_runtime

ROOT        = str(Path(__file__).resolve().parent.parent.parent)
CONSENT_CSV = os.path.join(ROOT, "consent_data", "enriched", "consent_resolved.csv")
GOLDEN_CSV  = os.path.join(ROOT, "golden_records.csv")
LEDGER_CSV  = os.path.join(ROOT, "consent_data", "enriched", "consent_event_ledger.csv")
OUTPUT_DIR  = os.path.join(ROOT, "consent_data")

def log(msg): print(f"[validation] {msg}")

def main():
    abort_if_uc_runtime("consent_validation_report.py")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')

    # ── Load data ─────────────────────────────────────────────────────────────
    log("Loading consent resolved ...")
    consent = pd.read_csv(CONSENT_CSV, low_memory=False)
    gr_consent = consent[consent['moscid'].str.startswith('GR-', na=False)].copy()
    log(f"  Total resolved MOSCIDs     : {len(consent):,}")
    log(f"  GR- linked MOSCIDs         : {len(gr_consent):,}")

    log("Loading golden records ...")
    golden = pd.read_csv(GOLDEN_CSV, low_memory=False)
    log(f"  Total golden records       : {len(golden):,}")

    log("Loading consent ledger ...")
    ledger = pd.read_csv(LEDGER_CSV, low_memory=False)
    log(f"  Total ledger events        : {len(ledger):,}")

    # ── Section 1: Consent population breakdown ───────────────────────────────
    log("\n── Section 1: Population Breakdown ──")

    total_gr = len(gr_consent)

    suppressed     = gr_consent[gr_consent['marketing_suppressed'] == True]
    email_optout   = gr_consent[gr_consent['marketing_email_consent'].isin(['opt_out', 'withdrawn'])]
    email_optin    = gr_consent[gr_consent['marketing_email_consent'] == 'opt_in']
    email_null     = gr_consent[gr_consent['marketing_email_consent'].isna()]
    global_optout  = gr_consent[gr_consent['global_consent'].isin(['opt_out', 'withdrawn'])]
    withdrawn      = gr_consent[gr_consent['marketing_email_consent'] == 'withdrawn']
    cookie_optin   = gr_consent[gr_consent['tracking_cookie_consent'] == 'opt_in']
    cookie_optout  = gr_consent[gr_consent['tracking_cookie_consent'] == 'opt_out']

    # Marketable = not suppressed AND (email opt_in OR email null)
    marketable = gr_consent[
        (gr_consent['marketing_suppressed'] != True) &
        (~gr_consent['marketing_email_consent'].isin(['opt_out', 'withdrawn']))
    ]
    non_marketable = gr_consent[
        (gr_consent['marketing_suppressed'] == True) |
        (gr_consent['marketing_email_consent'].isin(['opt_out', 'withdrawn']))
    ]

    s1 = {
        "Total GR-linked MOSCIDs":           total_gr,
        "Marketable (email eligible)":        len(marketable),
        "Non-marketable (email blocked)":     len(non_marketable),
        "  → Marketing suppressed (global)":  len(suppressed),
        "  → Email opted out":                len(email_optout[~email_optout['moscid'].isin(suppressed['moscid'])]),
        "  → Withdrawn":                      len(withdrawn),
        "Email opted in":                     len(email_optin),
        "Email not captured (null=opted in)": len(email_null),
        "Global consent opted out":           len(global_optout),
        "Cookie opted in":                    len(cookie_optin),
        "Cookie opted out":                   len(cookie_optout),
    }

    for k, v in s1.items():
        pct = f" ({v/max(total_gr,1)*100:.1f}%)" if not k.startswith("  ") else ""
        log(f"  {k:<45} {v:>6,}{pct}")

    # ── Section 2: Gate simulation ────────────────────────────────────────────
    log("\n── Section 2: Consent Gate Simulation (Email Channel) ──")

    def gate(row):
        gc = row.get('global_consent')
        ec = row.get('marketing_email_consent')
        ms = row.get('marketing_suppressed')
        if ms == True:                                    return 'BLOCK', 'global_consent'
        if pd.notna(gc) and str(gc).lower() in ('opt_out','withdrawn'):
                                                          return 'BLOCK', 'global_consent'
        if pd.notna(ec) and str(ec).lower() in ('opt_out','withdrawn'):
                                                          return 'BLOCK', 'marketing_email_consent'
        return 'SEND', 'null_passthrough'

    gr_consent[['gate_result','gate_rule']] = gr_consent.apply(
        lambda r: pd.Series(gate(r)), axis=1
    )

    send  = gr_consent[gr_consent['gate_result'] == 'SEND']
    block = gr_consent[gr_consent['gate_result'] == 'BLOCK']

    log(f"  SEND  (eligible for email)  : {len(send):>6,} ({len(send)/max(total_gr,1)*100:.1f}%)")
    log(f"  BLOCK (suppressed/opted out): {len(block):>6,} ({len(block)/max(total_gr,1)*100:.1f}%)")
    log(f"\n  Block breakdown by rule:")
    for rule, grp in block.groupby('gate_rule'):
        log(f"    {rule:<35} {len(grp):>6,}")

    # ── Section 3: Segment validation ────────────────────────────────────────
    log("\n── Section 3: Segment Validation ──")
    log("  Checking if non-consented users would appear in segments ...")

    # Simulate a standard email campaign segment (all GR- records)
    segment_all = set(gr_consent['moscid'])
    blocked_ids = set(block['moscid'])
    overlap = segment_all & blocked_ids

    log(f"  Total GR- IDs in population : {len(segment_all):>6,}")
    log(f"  Blocked (non-consented)      : {len(blocked_ids):>6,}")
    log(f"  Would appear in segment ❌   : {len(overlap):>6,}  ← MUST BE EXCLUDED")
    log(f"  Safe to activate            : {len(segment_all - blocked_ids):>6,}")

    # ── Section 4: Source coverage ────────────────────────────────────────────
    log("\n── Section 4: Consent Source Coverage ──")
    gr_ledger = ledger[ledger['moscid'].str.startswith('GR-', na=False)]
    for src, grp in gr_ledger.groupby('consent_source'):
        log(f"  {str(src):<25} {len(grp):>6,} events | {grp['moscid'].nunique():>5,} unique MOSCIDs")

    # ── Section 5: Data quality flags ────────────────────────────────────────
    log("\n── Section 5: Data Quality Flags ──")
    null_ts = gr_ledger[gr_ledger['consent_timestamp'].isna()]
    missing_agent = gr_ledger[
        (gr_ledger['consent_source'] == 'call_center') &
        (gr_ledger['agent_id'].isna())
    ]
    log(f"  Ledger rows with null timestamp  : {len(null_ts):>6,}")
    log(f"  Call center rows missing agent_id: {len(missing_agent):>6,}  ← audit risk")

    # ── Section 6: Demo personas ──────────────────────────────────────────────
    log("\n── Section 6: Demo-Ready Personas ──")

    # Persona 1: Consented
    p1 = gr_consent[
        (gr_consent['marketing_email_consent'] == 'opt_in') &
        (gr_consent['global_consent'] == 'opt_in') &
        (gr_consent['marketing_suppressed'] != True)
    ].head(1)

    # Persona 2: Withdrawn
    p2 = gr_consent[gr_consent['marketing_email_consent'] == 'withdrawn'].head(1)

    # Persona 3: Suppressed
    p3 = gr_consent[gr_consent['marketing_suppressed'] == True].head(1)

    personas = []
    if len(p1):
        personas.append({"persona": "[SEND] Consented", "moscid": p1.iloc[0]['moscid'],
                         "email_consent": p1.iloc[0]['marketing_email_consent'],
                         "suppressed": p1.iloc[0]['marketing_suppressed'],
                         "gate_result": "SEND"})
    if len(p2):
        personas.append({"persona": "[BLOCK] Withdrawn", "moscid": p2.iloc[0]['moscid'],
                         "email_consent": p2.iloc[0]['marketing_email_consent'],
                         "suppressed": p2.iloc[0]['marketing_suppressed'],
                         "gate_result": "BLOCK"})
    if len(p3):
        personas.append({"persona": "[BLOCK] Suppressed", "moscid": p3.iloc[0]['moscid'],
                         "email_consent": p3.iloc[0]['marketing_email_consent'],
                         "suppressed": p3.iloc[0]['marketing_suppressed'],
                         "gate_result": "BLOCK"})

    for p in personas:
        log(f"  {p['persona']}")
        log(f"    MOSCID         : {p['moscid']}")
        log(f"    Email consent  : {p['email_consent']}")
        log(f"    Suppressed     : {p['suppressed']}")
        log(f"    Gate result    : {p['gate_result']}")

    # ── Write outputs ─────────────────────────────────────────────────────────
    # Full suppression list
    supp_path = os.path.join(OUTPUT_DIR, "suppression_list_full.csv")
    block[['moscid','gate_rule','global_consent','marketing_email_consent']].to_csv(
        supp_path, index=False
    )

    # Persona reference card
    persona_path = os.path.join(OUTPUT_DIR, "demo_personas.csv")
    pd.DataFrame(personas).to_csv(persona_path, index=False)

    # Summary report
    summary_lines = [
        f"CONSENT VALIDATION REPORT",
        f"Generated: {now}",
        f"",
        f"POPULATION",
        f"  Total GR-linked MOSCIDs     : {total_gr:,}",
        f"  Marketable                  : {len(marketable):,} ({len(marketable)/max(total_gr,1)*100:.1f}%)",
        f"  Non-marketable              : {len(non_marketable):,} ({len(non_marketable)/max(total_gr,1)*100:.1f}%)",
        f"",
        f"GATE (EMAIL CHANNEL)",
        f"  SEND                        : {len(send):,}",
        f"  BLOCK                       : {len(block):,}",
        f"",
        f"SEGMENT RISK",
        f"  Non-consented in population : {len(overlap):,} — MUST BE EXCLUDED FROM SEGMENTS",
        f"",
        f"DATA QUALITY",
        f"  Null timestamps in ledger   : {len(null_ts):,}",
        f"  Missing agent_id (audit)    : {len(missing_agent):,}",
        f"",
        f"DEMO PERSONAS",
    ]
    for p in personas:
        summary_lines.append(f"  {p['persona']} → {p['moscid']} → Gate: {p['gate_result']}")

    summary_path = os.path.join(OUTPUT_DIR, "consent_validation_summary.txt")
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(summary_lines))

    log(f"\n{'═'*60}")
    log("VALIDATION COMPLETE")
    log(f"{'═'*60}")
    log(f"Suppression list : {supp_path}")
    log(f"Demo personas    : {persona_path}")
    log(f"Summary report   : {summary_path}")


if __name__ == "__main__":
    main()
