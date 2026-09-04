import shutil
from pathlib import Path

path = r'C:\Users\ambika257346\Desktop\CDP\Codex 2\Codex\backend\app.py'
shutil.copy2(path, path+'.bak')
c = open(path, encoding='utf-8').read()

if 'legacy_backend' in c:
    print('Already patched')
else:
    old = 'def load_legacy_app():'
    new = '''def load_legacy_app():
    import sys
    legacy_backend = str(Path(__file__).resolve().parent.parent / "legacy_idres" / "backend")
    if legacy_backend not in sys.path:
        sys.path.insert(0, legacy_backend)'''
    c = c.replace(old, new, 1)
    open(path, 'w', encoding='utf-8').write(c)
    print('Done:', 'legacy_backend' in open(path, encoding='utf-8').read())
