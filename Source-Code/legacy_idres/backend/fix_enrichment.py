"""
Fixes the get_enrichment() rows.append block in Prateek's app.py.
Run from the backend/ folder:
    python fix_enrichment.py
"""
from pathlib import Path
import re

app_path = Path(__file__).parent / "app.py"
with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the rows.append block inside get_enrichment dynamically
# by locating the function and finding the append
pattern = r'(            rows\.append\(\{[^}]+?"identity_strength": identity_strength,\s*\}\))'
match = re.search(pattern, content, re.DOTALL)

if match:
    old_block = match.group(1)
    print("Found block:")
    print(repr(old_block[:100]))
    
    new_block = '''            rows.append({
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
    
    content = content.replace(old_block, new_block)
    with open(app_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[2] ✓ cluster_id + extra fields added to get_enrichment()")
else:
    # Try to find it and show what's there
    idx = content.find("rows.append({")
    if idx > 0:
        print("Found rows.append at char", idx)
        print("Context:")
        print(repr(content[idx:idx+400]))
    else:
        print("[2] ✗ Could not find rows.append at all in file")
