from pathlib import Path

path = Path(__file__).resolve().parent / 'app.py'
c = path.read_text(encoding='utf-8')
old = '_EXCLUDED_FILES = {"ground_truth.json"}'
new = '_EXCLUDED_FILES = {"ground_truth.json", "identity_graph.csv"}'
if old in c:
    path.write_text(c.replace(old, new), encoding='utf-8')
    print('Done — identity_graph.csv excluded from sources')
else:
    print('Pattern not found')
