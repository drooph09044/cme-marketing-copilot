"""Verify that the built frontend contains every asset referenced by index.html."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
INDEX = DIST / "index.html"
ASSET_PATTERN = re.compile(r"""(?:src|href)=["'](/?assets/[^"'?#]+)""")


def main() -> int:
    if not INDEX.is_file():
        print(f"FAIL: frontend index is missing: {INDEX}")
        return 1

    index_html = INDEX.read_text(encoding="utf-8")
    referenced_assets = sorted(
        {asset_path.lstrip("/") for asset_path in ASSET_PATTERN.findall(index_html)}
    )
    if not referenced_assets:
        print(f"FAIL: no built assets are referenced by {INDEX}")
        return 1

    missing = [
        relative_path
        for relative_path in referenced_assets
        if not (DIST / relative_path).is_file()
    ]
    if missing:
        print(f"FAIL: frontend bundle is incomplete under {DIST}")
        for relative_path in missing:
            print(f"  missing: {relative_path}")
        return 1

    print(f"PASS: {INDEX}")
    for relative_path in referenced_assets:
        asset = DIST / relative_path
        print(f"  {relative_path} ({asset.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
