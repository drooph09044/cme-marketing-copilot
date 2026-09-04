"""
patch_household_members.py
Patches the /api/profile/<golden_id>/cluster-data endpoint to read
household members from golden_records.csv using household_id.

Run from legacy_idres/backend/:
    python patch_household_members.py
"""
import shutil
from pathlib import Path

path = Path('app.py')
shutil.copy2(path, str(path) + '.bak_household')
c = path.read_text(encoding='utf-8')

# Find the return jsonify in get_profile_cluster_data and add household members before it
# We look for the pattern where household_members is returned as empty list
# and replace with logic that reads from golden_records.csv

old = '''    return jsonify({
        "events":           events,
        "attributes":       {"computed": computed, "behavioral": behavioral},
        "linked_identities": linked,
        "household_members": [],
        "total_records":    len(cluster_rows),
    })'''

new = '''    # ── Household members from golden_records.csv ────────────────────────
    household_members = []
    try:
        if GOLDEN_CSV.exists():
            # Find household_id for this golden_id
            hh_id = None
            target_row = None
            with open(GOLDEN_CSV, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    if row.get("golden_id", "").upper() == golden_id:
                        hh_id = row.get("household_id", "").strip()
                        target_row = row
                        break

            # Find all other members in same household
            if hh_id:
                with open(GOLDEN_CSV, "r", encoding="utf-8") as f:
                    for row in csv.DictReader(f):
                        if (row.get("household_id", "").strip() == hh_id and
                                row.get("golden_id", "").upper() != golden_id and
                                row.get("full_name", "").strip()):
                            household_members.append({
                                "golden_id":  row.get("golden_id", ""),
                                "full_name":  row.get("full_name", ""),
                                "email":      row.get("email", ""),
                                "household_id": hh_id,
                            })
    except Exception as e:
        print(f"[household] Error loading members: {e}")

    return jsonify({
        "events":           events,
        "attributes":       {"computed": computed, "behavioral": behavioral},
        "linked_identities": linked,
        "household_members": household_members,
        "total_records":    len(cluster_rows),
    })'''

if old in c:
    c = c.replace(old, new, 1)
    path.write_text(c, encoding='utf-8')
    print("Patched successfully — household members now read from golden_records.csv")
else:
    # Try alternative pattern
    old2 = '''    return jsonify({
        "events":            events,
        "attributes":        {"computed": computed, "behavioral": behavioral},
        "linked_identities": linked,
        "household_members": [],
        "total_records":     len(cluster_rows),
    })'''
    if old2 in c:
        c = c.replace(old2, new, 1)
        path.write_text(c, encoding='utf-8')
        print("Patched successfully (alt pattern)")
    else:
        print("Pattern not found — printing return statement:")
        idx = c.find('"household_members"')
        print(repr(c[max(0,idx-200):idx+200]))
