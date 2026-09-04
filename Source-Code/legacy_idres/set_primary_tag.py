"""
set_primary_tag.py
Sets primary_tag to 'email' in blocking_config.json.
Run from the legacy_idres folder:
    python set_primary_tag.py
"""
import json
from pathlib import Path

config_path = Path(__file__).resolve().parent / 'blocking_config.json'

if not config_path.exists():
    print(f"ERROR: blocking_config.json not found at {config_path}")
    exit(1)

d = json.loads(config_path.read_text(encoding='utf-8'))
old = d.get('primary_tag')
d['primary_tag'] = 'email'
config_path.write_text(json.dumps(d, indent=2), encoding='utf-8')
print(f"Done — primary_tag changed from '{old}' to 'email'")
