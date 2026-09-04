"""Non-mutating API contract smoke checks for the Databricks/UC target."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_app():
    from app import app  # noqa: WPS433

    return app


def _json_keys(payload) -> list[str]:
    if isinstance(payload, dict):
        return sorted(str(key) for key in payload.keys())
    if isinstance(payload, list):
        return ["<list>"]
    return [type(payload).__name__]


def _check(client, method: str, path: str, expected: Iterable[int]) -> dict[str, object]:
    request_kwargs = {"json": {}} if method.upper() in {"POST", "PUT", "PATCH"} else {}
    response = getattr(client, method.lower())(path, **request_kwargs)
    payload = response.get_json(silent=True)
    return {
        "method": method.upper(),
        "path": path,
        "status": response.status_code,
        "ok": response.status_code in set(expected),
        "json_keys": _json_keys(payload),
    }


def main() -> int:
    app = _load_app()
    checks = [
        ("GET", "/", {200}),
        ("GET", "/api/runtime/uc-health?source=media", {200, 503}),
        ("GET", "/api/pipeline/steps", {200, 503}),
        ("GET", "/api/sources?source=media", {200, 503}),
        ("GET", "/api/sources?source=sports", {200, 503}),
        ("GET", "/api/sources?source=automotive", {200, 503}),
        ("GET", "/api/data-classification", {200, 503}),
        ("GET", "/api/tag-mappings", {200, 404, 503}),
        ("GET", "/api/golden-records?source=media&limit=1", {200, 503}),
        ("GET", "/api/golden-records/__missing__/activity/source%2Frecord", {404, 503}),
        ("GET", "/api/segments?source=media", {200, 503}),
        ("GET", "/api/journeys", {200, 503}),
        ("GET", "/api/profile-mode", {200, 503}),
        ("GET", "/api/copilot/bootstrap", {200, 503}),
        ("GET", "/api/copilot/campaigns-journeys/report?source_system=sports", {200, 503}),
        ("GET", "/api/audiences-segments/report?source=media", {200, 503}),
        ("GET", "/api/copilot/journey/measurement/generalsummary", {200, 503}),
        ("GET", "/api/copilot/journey/measurement/listing", {200, 503}),
        ("GET", "/api/copilot/journey/measurement/detail/__missing__", {404, 503}),
        ("GET", "/api/qa-automation/runtime", {200, 404, 503}),
        ("GET", "/api/qa-automation/journeys", {200, 503}),
        ("GET", "/api/qa-automation/segments", {200, 503}),
        ("POST", "/api/login", {400, 503}),
    ]

    results = []
    with app.test_client() as client:
        for method, path, expected in checks:
            results.append(_check(client, method, path, expected))
        index_response = client.get("/")
        index_html = index_response.get_data(as_text=True)
        asset_paths = sorted(
            set(re.findall(r"""(?:src|href)=["'](/assets/[^"'?#]+)""", index_html))
        )
        if not asset_paths:
            results.append(
                {
                    "method": "GET",
                    "path": "<frontend-assets>",
                    "status": 0,
                    "ok": False,
                    "json_keys": ["No built assets referenced by index.html"],
                }
            )
        else:
            for asset_path in asset_paths:
                results.append(_check(client, "GET", asset_path, {200}))

    print(
        json.dumps(
            {"data_source": os.getenv("CODEX_DATA_SOURCE", ""), "results": results},
            indent=2,
        )
    )

    failed = [item for item in results if not item["ok"]]
    if failed:
        print("Contract smoke failed for:")
        for item in failed:
            print(f"  {item['method']} {item['path']} -> {item['status']}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
