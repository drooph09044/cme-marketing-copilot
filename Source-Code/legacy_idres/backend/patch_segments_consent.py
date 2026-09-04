"""
patch_segments_consent.py
Patches app.py to:
1. Wrap /api/segments/<id>/members with consent gate
2. Add /api/segments/<id>/consent-summary endpoint for pre-built segment consent stats

Run from backend folder:
    python patch_segments_consent.py
"""
import os, shutil

app_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py")
backup   = app_path + ".bak3"
shutil.copy2(app_path, backup)
print(f"Backup: {backup}")

content = open(app_path, encoding="utf-8").read()

if "consent_members" in content:
    print("Already patched — no changes made.")
    exit(0)

# ── Patch 1: wrap get_segment_members with consent gate ──────────────────────
old_members = '''@app.route("/api/segments/<segment_id>/members", methods=["GET"])
def get_segment_members(segment_id):
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    if not GOLDEN_CSV.exists():
        return jsonify({"rows": [], "total": 0})
    rows = []
    with open(GOLDEN_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row.get("golden_id", row.get("record_id", ""))
            if segment_id in _classify_record(rid):
                rows.append({"golden_id": rid, "email": row.get("email", ""), "full_name": row.get("full_name", "")})
    total = len(rows)
    start = (page - 1) * limit
    return jsonify({"rows": rows[start:start+limit], "total": total, "page": page})'''

new_members = '''@app.route("/api/segments/<segment_id>/members", methods=["GET"])
def get_segment_members(segment_id):
    page    = request.args.get("page", 1, type=int)
    limit   = request.args.get("limit", 50, type=int)
    channel = request.args.get("channel", "email")
    if not GOLDEN_CSV.exists():
        return jsonify({"rows": [], "total": 0})
    rows = []
    with open(GOLDEN_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row.get("golden_id", row.get("record_id", ""))
            if segment_id in _classify_record(rid):
                rows.append({"golden_id": rid, "email": row.get("email", ""), "full_name": row.get("full_name", "")})
    # ── Consent gate — hard exclude non-consented users ──────────────────────
    filtered         = filter_segment_by_consent(rows, channel=channel)
    eligible         = filtered["eligible"]
    total_unfiltered = filtered["total"]
    suppressed_count = filtered["block"]
    total            = len(eligible)
    start            = (page - 1) * limit
    return jsonify({
        "rows":             eligible[start:start+limit],
        "total":            total,
        "total_unfiltered": total_unfiltered,
        "suppressed":       suppressed_count,
        "consent_gate":     channel,
        "page":             page,
    })


@app.route("/api/segments/<segment_id>/consent-summary", methods=["GET"])
def get_segment_consent_summary(segment_id):
    """
    Returns consent gate stats for a pre-built segment without loading all members.
    Used by segment cards to show eligible vs suppressed count.
    """
    channel = request.args.get("channel", "email")
    if not GOLDEN_CSV.exists():
        return jsonify({"total": 0, "send": 0, "block": 0})
    rows = []
    with open(GOLDEN_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row.get("golden_id", row.get("record_id", ""))
            if segment_id in _classify_record(rid):
                rows.append({"golden_id": rid})
    filtered = filter_segment_by_consent(rows, channel=channel)
    return jsonify({
        "segment_id":       segment_id,
        "total":            filtered["total"],
        "send":             filtered["send"],
        "block":            filtered["block"],
        "channel":          channel,
        "consent_last_refreshed": filtered["consent_last_refreshed"],
    })'''

if old_members not in content:
    print("ERROR: Could not find get_segment_members in app.py")
    print("Manual patch needed — see patch notes below")
    exit(1)

content = content.replace(old_members, new_members, 1)
open(app_path, "w", encoding="utf-8").write(content)

print("app.py patched:")
print("  Wrapped get_segment_members with filter_segment_by_consent")
print("  Added /api/segments/<id>/consent-summary endpoint")
print("\nRestart Flask: python app.py")
