"""
Validate Golden Records
Checks that mismatches between golden records and their superseded source records
are ONLY due to noise variants, not cross-customer contamination.
"""

import csv
import json
import os
import re
from collections import defaultdict

GOLDEN_FILE = "golden_records.csv"
SUPERSEDED_FILE = "superseded_ids.csv"
CLUSTERED_FILE = "clustered_records.csv"
GROUND_TRUTH = os.path.join("generated_data", "ground_truth.json")

passed = 0
failed = 0
warnings = 0


def log_pass(msg):
    global passed
    passed += 1
    print(f"  [PASS] {msg}")


def log_fail(msg):
    global failed
    failed += 1
    print(f"  [FAIL] {msg}")


def log_warn(msg):
    global warnings
    warnings += 1
    print(f"  [WARN] {msg}")


def strip_email_noise(email):
    if not email or not email.strip():
        return ""
    email = email.strip().lower()
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if "+" in local:
        local = local.split("+")[0]
    local = local.replace(".", "")
    return f"{local}@{domain}"


def strip_phone_noise(phone):
    if not phone or not str(phone).strip():
        return ""
    digits = re.sub(r"\D", "", str(phone))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def main():
    global passed, failed, warnings

    print("=" * 60)
    print("  Golden Record Validation Report")
    print("=" * 60)

    # Load everything
    with open(GROUND_TRUTH, "r") as f:
        gt = json.load(f)

    with open(GOLDEN_FILE, "r", encoding="utf-8") as f:
        golden_records = {r["golden_id"]: r for r in csv.DictReader(f)}

    with open(SUPERSEDED_FILE, "r", encoding="utf-8") as f:
        superseded = list(csv.DictReader(f))

    with open(CLUSTERED_FILE, "r", encoding="utf-8") as f:
        clustered = {r["record_id"]: r for r in csv.DictReader(f)}

    print(f"\nLoaded: {len(golden_records)} golden records, "
          f"{len(superseded)} superseded IDs, {len(clustered)} clustered records\n")

    # --- Check 1: Every golden record maps to exactly one true customer ---
    print("--- Check 1: Golden Record Purity (one customer per golden) ---")
    impure_count = 0
    for gid, golden in golden_records.items():
        cluster_id = golden["cluster_id"]
        # Find all member records
        member_rids = [s["record_id"] for s in superseded if s["golden_id"] == gid]
        cust_ids = set()
        for rid in member_rids:
            if rid in gt:
                cust_ids.add(gt[rid])
        if len(cust_ids) > 1:
            impure_count += 1
            if impure_count <= 3:
                log_fail(f"Golden {gid} maps to multiple customers: {cust_ids}")

    if impure_count == 0:
        log_pass(f"All {len(golden_records)} golden records map to exactly one customer")
    else:
        log_fail(f"{impure_count} golden records map to multiple customers")

    # --- Check 2: Golden record email is a noise variant of the true customer email ---
    print("\n--- Check 2: Golden Email Matches Base Customer Email ---")
    # Build customer_id -> base email map from superseded records
    customer_base_emails = defaultdict(set)
    for s in superseded:
        rid = s["record_id"]
        cust_id = gt.get(rid)
        if cust_id is None:
            continue
        rec = clustered.get(rid, {})
        email = rec.get("email", "")
        if email:
            customer_base_emails[cust_id].add(strip_email_noise(email))

    email_mismatch = 0
    email_checked = 0
    email_mismatch_examples = []
    for gid, golden in golden_records.items():
        golden_email = golden.get("email", "")
        if not golden_email:
            continue
        email_checked += 1

        member_rids = [s["record_id"] for s in superseded if s["golden_id"] == gid]
        cust_ids = set(gt.get(rid) for rid in member_rids if rid in gt)

        golden_base = strip_email_noise(golden_email)

        # Check if golden email matches any base email from the cluster's customer
        member_base_emails = set()
        for rid in member_rids:
            rec = clustered.get(rid, {})
            e = rec.get("email", "")
            if e:
                member_base_emails.add(strip_email_noise(e))

        if golden_base not in member_base_emails and member_base_emails:
            email_mismatch += 1
            if len(email_mismatch_examples) < 3:
                email_mismatch_examples.append({
                    "golden_id": gid,
                    "golden_email": golden_email,
                    "golden_base": golden_base,
                    "member_bases": member_base_emails,
                })

    if email_mismatch == 0:
        log_pass(f"All {email_checked} golden emails match their cluster's base email")
    else:
        log_fail(f"{email_mismatch}/{email_checked} golden emails don't match cluster base emails")
        for ex in email_mismatch_examples:
            print(f"         {ex['golden_id']}: golden={ex['golden_base']}, members={ex['member_bases']}")

    # --- Check 3: Golden phone is a noise variant of the true customer phone ---
    print("\n--- Check 3: Golden Phone Matches Base Customer Phone ---")
    phone_mismatch = 0
    phone_checked = 0
    phone_mismatch_examples = []
    for gid, golden in golden_records.items():
        golden_phone = golden.get("phone", "")
        if not golden_phone:
            continue
        phone_checked += 1

        member_rids = [s["record_id"] for s in superseded if s["golden_id"] == gid]
        golden_base_phone = strip_phone_noise(golden_phone)

        member_base_phones = set()
        for rid in member_rids:
            rec = clustered.get(rid, {})
            p = rec.get("phone", "")
            if p:
                member_base_phones.add(strip_phone_noise(p))

        if golden_base_phone not in member_base_phones and member_base_phones:
            phone_mismatch += 1
            if len(phone_mismatch_examples) < 3:
                phone_mismatch_examples.append({
                    "golden_id": gid,
                    "golden_phone": golden_phone,
                    "golden_base": golden_base_phone,
                    "member_bases": member_base_phones,
                })

    if phone_mismatch == 0:
        log_pass(f"All {phone_checked} golden phones match their cluster's base phone")
    else:
        log_fail(f"{phone_mismatch}/{phone_checked} golden phones don't match cluster base phones")
        for ex in phone_mismatch_examples:
            print(f"         {ex['golden_id']}: golden={ex['golden_base']}, members={ex['member_bases']}")

    # --- Check 4: Name mismatches are only noise (nickname/typo) ---
    print("\n--- Check 4: Golden Name vs Member Names (Noise Audit) ---")
    name_exact_match = 0
    name_noise_variant = 0
    name_different = 0
    name_examples = []

    for gid, golden in golden_records.items():
        golden_name = golden.get("full_name", "").strip().upper()
        if not golden_name:
            continue

        member_rids = [s["record_id"] for s in superseded if s["golden_id"] == gid]
        member_names = set()
        for rid in member_rids:
            rec = clustered.get(rid, {})
            n = rec.get("full_name", "").strip().upper()
            if n:
                member_names.add(n)

        if not member_names:
            continue

        if golden_name in member_names:
            name_exact_match += 1
        else:
            # Golden name should be one of the member names (picked from most trusted source)
            name_different += 1
            if len(name_examples) < 5:
                name_examples.append({
                    "golden_id": gid,
                    "golden_name": golden_name,
                    "member_names": member_names,
                })

    # Count how many golden records have members with DIFFERENT names (noise variants)
    golden_with_name_variants = 0
    variant_examples = []
    for gid, golden in golden_records.items():
        member_rids = [s["record_id"] for s in superseded if s["golden_id"] == gid]
        member_names = set()
        for rid in member_rids:
            rec = clustered.get(rid, {})
            n = rec.get("full_name", "").strip().upper()
            if n:
                member_names.add(n)

        if len(member_names) > 1:
            golden_with_name_variants += 1
            if len(variant_examples) < 5:
                variant_examples.append({"golden_id": gid, "names": member_names})

    log_pass(f"Golden name is one of its member names: {name_exact_match} exact matches")
    if name_different > 0:
        log_warn(f"Golden name not found in members: {name_different} (investigate)")
        for ex in name_examples[:3]:
            print(f"         {ex['golden_id']}: golden='{ex['golden_name']}', members={ex['member_names']}")

    print(f"\n  Golden records with name variants across members: {golden_with_name_variants}")
    if variant_examples:
        print("  Sample name variants (expected noise):")
        for ex in variant_examples:
            print(f"    {ex['golden_id']}: {ex['names']}")

    # --- Check 5: Superseded ID completeness ---
    print("\n--- Check 5: Superseded ID Completeness ---")
    superseded_rids = set(s["record_id"] for s in superseded)
    clustered_rids = set(clustered.keys())

    missing = clustered_rids - superseded_rids
    extra = superseded_rids - clustered_rids

    if not missing:
        log_pass(f"All {len(clustered_rids)} clustered records have superseded entries")
    else:
        log_fail(f"{len(missing)} clustered records missing from superseded_ids.csv")

    if not extra:
        log_pass("No stale entries in superseded_ids.csv")
    else:
        log_fail(f"{len(extra)} stale entries in superseded_ids.csv")

    # --- Check 6: Every superseded ID points to a valid golden record ---
    print("\n--- Check 6: Superseded -> Golden Reference Integrity ---")
    bad_refs = 0
    for s in superseded:
        if s["golden_id"] not in golden_records:
            bad_refs += 1

    if bad_refs == 0:
        log_pass(f"All {len(superseded)} superseded IDs point to valid golden records")
    else:
        log_fail(f"{bad_refs} superseded IDs point to non-existent golden records")

    # --- Check 7: Survivorship rule — tier is highest from members ---
    print("\n--- Check 7: Tier Survivorship (Highest Wins) ---")
    TIER_RANK = {"VIP": 4, "Premium": 3, "Basic": 2, "Free": 1, "": 0}
    tier_wrong = 0
    tier_checked = 0

    for gid, golden in golden_records.items():
        golden_tier = golden.get("subscription_tier", "").strip()
        if not golden_tier:
            continue
        tier_checked += 1

        member_rids = [s["record_id"] for s in superseded if s["golden_id"] == gid]
        member_tiers = []
        for rid in member_rids:
            rec = clustered.get(rid, {})
            t = rec.get("subscription_tier", "").strip()
            if t:
                member_tiers.append(t)

        if not member_tiers:
            continue

        highest = max(member_tiers, key=lambda x: TIER_RANK.get(x, 0))
        if TIER_RANK.get(golden_tier, 0) != TIER_RANK.get(highest, 0):
            tier_wrong += 1

    if tier_wrong == 0:
        log_pass(f"All {tier_checked} golden records have correct highest tier")
    else:
        log_fail(f"{tier_wrong}/{tier_checked} golden records have wrong tier")

    # --- Summary ---
    print("\n" + "=" * 60)
    print(f"  Results: {passed} passed, {failed} failed, {warnings} warnings")
    print("=" * 60)

    if failed > 0:
        print("\n  STATUS: VALIDATION FAILED")
        return 1
    elif warnings > 0:
        print("\n  STATUS: PASSED WITH WARNINGS")
        return 0
    else:
        print("\n  STATUS: ALL CHECKS PASSED")
        return 0


if __name__ == "__main__":
    exit(main())
