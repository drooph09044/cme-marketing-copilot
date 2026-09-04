"""
patch_std_cache.py
Caches the standardization summary on startup instead of reading
the full 16MB CSV on every request.

Run from legacy_idres/backend/:
    python patch_std_cache.py
"""
import shutil
from pathlib import Path

path = Path(__file__).resolve().parent / 'app.py'
shutil.copy2(path, str(path) + '.bak_std_cache')
c = path.read_text(encoding='utf-8')

# Add cache variable after STD_DIR definition
old = 'STD_DIR = ROOT / "standardized_data"\n'
new = 'STD_DIR = ROOT / "standardized_data"\n_STD_CACHE = None  # cached on first request\n'

if old not in c:
    print("ERROR: STD_DIR line not found")
    exit(1)

c = c.replace(old, new, 1)

# Patch the standardization_summary endpoint to use cache
old_fn = '''def standardization_summary():
    """Compare raw vs preprocessed vs standardized for a few sample records."""
    if not (STD_DIR / "all_standardized.csv").exists():
        return jsonify({"samples": [], "rules": []})

    # ── Build standardized lookup ──
    std_lookup = {}
    with open(STD_DIR / "all_standardized.csv", "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row.get("record_id", "")
            if rid:
                std_lookup[rid] = row'''

new_fn = '''def standardization_summary():
    """Compare raw vs preprocessed vs standardized for a few sample records."""
    global _STD_CACHE
    if _STD_CACHE is not None:
        return jsonify(_STD_CACHE)

    if not (STD_DIR / "all_standardized.csv").exists():
        return jsonify({"samples": [], "rules": []})

    # ── Build standardized lookup ──
    std_lookup = {}
    with open(STD_DIR / "all_standardized.csv", "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row.get("record_id", "")
            if rid:
                std_lookup[rid] = row'''

if old_fn in c:
    c = c.replace(old_fn, new_fn, 1)
    print("Patched standardization_summary function")
else:
    print("ERROR: standardization_summary function pattern not found")
    exit(1)

# Find return jsonify at end of standardization_summary and cache before returning
old_return = '    return jsonify({\n        "comparisons": comparisons,\n        "field_examples": field_examples,\n        "rules": STD_RULES,\n    })'
new_return = '''    result = {
        "comparisons": comparisons,
        "field_examples": field_examples,
        "rules": STD_RULES,
    }
    _STD_CACHE = result
    return jsonify(result)'''

if old_return in c:
    c = c.replace(old_return, new_return, 1)
    print("Patched return statement with cache")
else:
    # Try alternative return pattern
    old_return2 = "    return jsonify({\n        'comparisons': comparisons,\n        'field_examples': field_examples,\n        'rules': STD_RULES,\n    })"
    if old_return2 in c:
        c = c.replace(old_return2, new_return, 1)
        print("Patched return statement with cache (alt pattern)")
    else:
        print("WARNING: return pattern not found — cache will work on first request but not save")

path.write_text(c, encoding='utf-8')
print("Done — standardization summary now cached after first load")
print("First load will still take a few seconds, subsequent loads will be instant")
