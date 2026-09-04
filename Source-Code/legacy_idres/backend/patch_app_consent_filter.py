"""
patch_app_consent_filter.py
Patches app.py to hard-exclude non-consented users from
the /api/segments/dynamic endpoint.

Run once from the backend folder:
    python patch_app_consent_filter.py
"""
import os, shutil

app_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py")
backup   = app_path + ".bak2"
shutil.copy2(app_path, backup)
print(f"Backup: {backup}")

content = open(app_path, encoding="utf-8").read()

if "consent_segment_filter" in content:
    print("app.py already patched — no changes made.")
    exit(0)

# 1 — Add import after consent_bp import
old_import = "from consent.consent_api import consent_bp"
new_import = """from consent.consent_api import consent_bp
from consent.consent_segment_filter import filter_segment_by_consent"""
content = content.replace(old_import, new_import, 1)

# 2 — Wrap the dynamic_segment return to hard-exclude blocked users
old_return = '''    return jsonify({"rows": matched[:200], "total": len(matched)})'''
new_return = '''    # ── Consent gate — hard-exclude non-consented users ──────────────────
    filtered = filter_segment_by_consent(matched, channel="email")
    eligible  = filtered["eligible"]
    suppressed_count = filtered["block"]
    return jsonify({
        "rows":             eligible[:200],
        "total":            len(eligible),
        "total_unfiltered": len(matched),
        "suppressed":       suppressed_count,
        "consent_gate":     "email",
        "consent_last_refreshed": filtered["consent_last_refreshed"],
    })'''

content = content.replace(old_return, new_return, 1)

open(app_path, "w", encoding="utf-8").write(content)
print("app.py patched:")
print("  Added: consent_segment_filter import")
print("  Added: filter_segment_by_consent wrapping dynamic_segment response")
print("\nRestart Flask to apply:")
print("  python app.py")
