path = 'app.py'
c = open(path, encoding='utf-8').read()

if 'consent-summary' in c:
    print('Already exists')
else:
    endpoint = '''

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
    return jsonify({
        "segment_id": segment_id,
        "total": filtered["total"],
        "send": filtered["send"],
        "block": filtered["block"],
        "channel": channel,
        "consent_last_refreshed": filtered.get("consent_last_refreshed"),
    })
'''
    c = c + endpoint
    open(path, 'w', encoding='utf-8').write(c)
    print('Done:', 'consent-summary' in open(path, encoding='utf-8').read())
