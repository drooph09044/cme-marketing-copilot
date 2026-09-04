"""
Applies our 3 changes to Prateek's app.py.
Run this from the folder containing Prateek's app.py:
    python prateeek_app_patch.py
"""
from pathlib import Path

app_path = Path(__file__).parent / "app.py"
with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# ── CHANGE 1: Add HOUSEHOLD_CSV path ─────────────────────────────────────────
old1 = 'CLUSTERED_CSV = ROOT / "clustered_records.csv"'
new1 = ('CLUSTERED_CSV = ROOT / "clustered_records.csv"\n'
        'HOUSEHOLD_CSV = ROOT / "household_links.csv"')

if old1 in content:
    content = content.replace(old1, new1)
    print("[1] ✓ HOUSEHOLD_CSV path added")
    changes += 1
else:
    print("[1] ✗ CLUSTERED_CSV line not found — add manually")

# ── CHANGE 2: Add cluster_id + extra fields to get_enrichment() ──────────────
old2 = '''            rows.append({
                "golden_id": rid, "email": row.get("email", ""),
                "full_name": row.get("full_name", ""), "phone": row.get("phone", ""),
                "ltv_score": ltv, "ltv_tier": ltv_tier,
                "recency_days": recency, "recency_tier": recency_tier,
                "engagement_rate": engagement, "engagement_tier": eng_tier,
                "primary_affinity": affinity, "identity_strength": identity_strength,
            })'''

new2 = '''            rows.append({
                "golden_id":         rid,
                "cluster_id":        row.get("cluster_id", ""),
                "email":             row.get("email", ""),
                "full_name":         row.get("full_name", ""),
                "phone":             row.get("phone", ""),
                "address":           row.get("address", ""),
                "city":              row.get("city", ""),
                "state":             row.get("state", ""),
                "zip":               row.get("zip", ""),
                "subscription_tier": row.get("subscription_tier", ""),
                "source_files":      row.get("source_files", ""),
                "ltv_score":         ltv,
                "ltv_tier":          ltv_tier,
                "recency_days":      recency,
                "recency_tier":      recency_tier,
                "engagement_rate":   engagement,
                "engagement_tier":   eng_tier,
                "primary_affinity":  affinity,
                "identity_strength": identity_strength,
            })'''

if old2 in content:
    content = content.replace(old2, new2)
    print("[2] ✓ cluster_id + extra fields added to get_enrichment()")
    changes += 1
else:
    print("[2] ✗ rows.append block not found — add manually")

# ── CHANGE 3: Add get_profile_cluster_data() endpoint ────────────────────────
new_endpoint = '''

@app.route("/api/profile/<golden_id>/cluster-data", methods=["GET"])
def get_profile_cluster_data(golden_id):
    """Return events, attributes, linked identities and household for Customer 360."""
    golden_id = golden_id.upper()

    cluster_id = None
    if GOLDEN_CSV.exists():
        with open(GOLDEN_CSV, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("golden_id", "").upper() == golden_id:
                    cluster_id = row.get("cluster_id", "")
                    break

    if not cluster_id:
        return jsonify({"events": [], "linked_identities": [],
                        "attributes": {"computed": {}, "behavioral": {}},
                        "household_members": [], "total_records": 0})

    cluster_rows = []
    if CLUSTERED_CSV.exists():
        with open(CLUSTERED_CSV, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("cluster_id", "") == cluster_id:
                    cluster_rows.append(row)

    def get_ts(r):
        for col in ["event_timestamp", "session_start", "open_date",
                    "billing_date", "send_date", "created_date"]:
            if r.get(col, "").strip():
                return r[col].strip()
        return ""

    seen_keys, events = set(), []
    for r in sorted(cluster_rows, key=lambda r: get_ts(r), reverse=True):
        key = f"{r.get('event_type','')}|{get_ts(r)}"
        if key in seen_keys: continue
        seen_keys.add(key)
        events.append({
            "event_type":      r.get("event_type", ""),
            "event_timestamp": get_ts(r),
            "source_file":     r.get("source_file", ""),
            "campaign_name":   r.get("campaign_name", ""),
            "content_type":    r.get("content_type", ""),
        })
        if len(events) >= 12: break

    def most_frequent(vals):
        vals = [v.strip() for v in vals if v and v.strip()]
        return max(set(vals), key=vals.count) if vals else ""

    computed = {k: v for k, v in {
        "subscription_tier": most_frequent([r.get("subscription_tier", "") for r in cluster_rows]),
        "account_status":    most_frequent([r.get("account_status", "")    for r in cluster_rows]),
        "payment_method":    most_frequent([r.get("payment_method", "")    for r in cluster_rows]),
    }.items() if v}

    behavioral = {k: v for k, v in {
        "device_platform":  most_frequent([r.get("device_platform", "")  for r in cluster_rows]),
        "device_type":      most_frequent([r.get("device_type", "")      for r in cluster_rows]),
        "content_affinity": most_frequent([r.get("content_type", "")     for r in cluster_rows]),
        "category":         most_frequent([r.get("category", "")         for r in cluster_rows]),
    }.items() if v}

    seen_ids, linked_identities = set(), []
    for r in cluster_rows:
        name  = r.get("full_name", "").strip()
        email = r.get("email", "").strip()
        key   = f"{name}|{email}"
        if (not name and not email) or key in seen_ids: continue
        seen_ids.add(key)
        linked_identities.append({
            "full_name":       name,
            "email":           email,
            "phone":           r.get("phone", ""),
            "source_file":     r.get("source_file", ""),
            "device_platform": r.get("device_platform", ""),
        })

    household_members = []
    if HOUSEHOLD_CSV.exists():
        with open(HOUSEHOLD_CSV, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("golden_id", "").upper() == golden_id:
                    household_members.append({
                        "golden_id":    row.get("household_golden_id", ""),
                        "full_name":    row.get("full_name", ""),
                        "email":        row.get("email", ""),
                        "address":      row.get("address", ""),
                        "zip":          row.get("zip", ""),
                        "relationship": row.get("relationship", "Household Member"),
                    })

    return jsonify({
        "cluster_id":        cluster_id,
        "total_records":     len(cluster_rows),
        "events":            events,
        "attributes":        {"computed": computed, "behavioral": behavioral},
        "linked_identities": linked_identities,
        "household_members": household_members,
    })
'''

marker = 'if __name__ == "__main__":'
if "get_profile_cluster_data" in content:
    print("[3] ✓ SKIP — endpoint already present")
elif marker in content:
    content = content.replace(marker, new_endpoint + "\n\n" + marker)
    print("[3] ✓ get_profile_cluster_data() endpoint added")
    changes += 1
else:
    print("[3] ✗ Could not find insertion point")

if changes > 0:
    with open(app_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\n  Done — {changes} change(s) applied to app.py")
else:
    print("\n⚠ No changes made — check errors above")
