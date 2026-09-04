"""
patch_real_segments.py
Patches app.py to replace random _classify_record() with
real segment classification from actual source file data.

Run from backend folder:
    python patch_real_segments.py
"""
import os, shutil

app_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py")
backup   = app_path + ".bak4"
shutil.copy2(app_path, backup)
print(f"Backup: {backup}")

content = open(app_path, encoding="utf-8").read()

if "segment_classifier" in content:
    print("Already patched — no changes made.")
    exit(0)

# 1 — Add import after consent imports
old_import = "from consent.consent_segment_filter import filter_segment_by_consent"
new_import = """from consent.consent_segment_filter import filter_segment_by_consent
from consent.segment_classifier import classify_golden_id, get_segment_lookup"""
content = content.replace(old_import, new_import, 1)

# 2 — Replace _classify_record() call sites with classify_golden_id()
# The function is called in 3 places: get_segments, get_segment_members, dynamic_segment
content = content.replace(
    "if segment_id in _classify_record(rid):",
    "if segment_id in classify_golden_id(rid):"
)
content = content.replace(
    "segs = _classify_record(rid)",
    "segs = classify_golden_id(rid)"
)

# 3 — Pre-build lookup at startup (after app = Flask(__name__))
old_startup = "app.register_blueprint(consent_bp)"
new_startup = """app.register_blueprint(consent_bp)

# Pre-build real segment lookup at startup
import threading as _threading
def _prebuild_segments():
    try:
        get_segment_lookup()
        print("[segments] Real segment lookup built successfully")
    except Exception as e:
        print(f"[segments] Warning: could not build segment lookup: {e}")
_threading.Thread(target=_prebuild_segments, daemon=True).start()"""
content = content.replace(old_startup, new_startup, 1)

open(app_path, "w", encoding="utf-8").write(content)
print("app.py patched:")
print("  Added: segment_classifier import")
print("  Replaced: _classify_record() → classify_golden_id()")
print("  Added: pre-build lookup at startup")
print("\nRestart Flask: python app.py")
