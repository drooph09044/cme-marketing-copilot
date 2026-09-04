import shutil

path = r'C:\Users\ambika257346\Downloads\Codex\Codex\legacy_idres\backend\app.py'
shutil.copy2(path, path+'.bak7')
c = open(path, encoding='utf-8').read()

old = 'def get_segment_members(segment_id):\n    page = request.args.get("page", 1, type=int)\n    limit = request.args.get("limit", 50, type=int)\n    if not GOLDEN_CSV.exists():\n        return jsonify({"rows": [], "total": 0})\n    rows = []\n    with open(GOLDEN_CSV, "r", encoding="utf-8") as f:\n        reader = csv.DictReader(f)\n        for row in reader:\n            rid = row.get("golden_id", row.get("record_id", ""))\n            if segment_id in classify_golden_id(rid):\n                rows.append({"golden_id": rid, "email": row.get("email", ""), "full_name": row.get("full_name", "")})\n    total = len(rows)\n    start = (page - 1) * limit\n    return jsonify({"rows": rows[start:start+limit], "total": total, "page": page})'

new = '''def get_segment_members(segment_id):
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
            if segment_id in classify_golden_id(rid):
                rows.append({"golden_id": rid, "email": row.get("email", ""), "full_name": row.get("full_name", "")})
    filtered = filter_segment_by_consent(rows, channel=channel)
    eligible = filtered["eligible"]
    start = (page - 1) * limit
    return jsonify({"rows": eligible[start:start+limit], "total": len(eligible), "total_unfiltered": filtered["total"], "suppressed": filtered["block"], "consent_gate": channel, "page": page})


@app.route("/api/segments/<segment_id>/consent-summary", methods=["GET"])
def get_segment_consent_summary(segment_id):
    channel = request.args.get("channel", "email")
    if not GOLDEN_CSV.exists():
        return jsonify({"total": 0, "send": 0, "block": 0})
    rows = []
    with open(GOLDEN_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rid = row.get("golden_id", row.get("record_id", ""))
            if segment_id in classify_golden_id(rid):
                rows.append({"golden_id": rid})
    filtered = filter_segment_by_consent(rows, channel=channel)
    return jsonify({"segment_id": segment_id, "total": filtered["total"], "send": filtered["send"], "block": filtered["block"], "channel": channel, "consent_last_refreshed": filtered.get("consent_last_refreshed")})'''

if old in c:
    c = c.replace(old, new, 1)
    open(path, 'w', encoding='utf-8').write(c)
    print('Patched successfully')
else:
    print('Pattern not found — checking exact text...')
    idx = c.find('def get_segment_members')
    print(repr(c[idx:idx+400]))
