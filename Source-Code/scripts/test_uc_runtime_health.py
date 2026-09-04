"""Regression check for configured Unity Catalog source and feature inventory."""

from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND_ROOT = ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def main() -> int:
    os.environ["CODEX_DATA_SOURCE"] = "uc"
    os.environ["DATABRICKS_WAREHOUSE_ID"] = "test-warehouse"
    os.environ["CODEX_WARM_WAREHOUSE_ON_START"] = "0"

    app_module = importlib.import_module("backend.app")
    original_metadata = app_module.tables_fast_metadata
    sources_globals = app_module.app.view_functions["list_sources"].__globals__
    original_sources_metadata = sources_globals["tables_fast_metadata"]
    original_classify_source = sources_globals["_classify_source"]
    original_snapshot_reader = sources_globals["_data_overview_snapshot_entry"]
    original_snapshot_writer = sources_globals["_persist_data_overview_snapshot"]

    media_rows = {
        "med_app_events": 7_078,
        "med_customer_support": 2_493,
        "med_email_engagement": 1_702,
        "med_streaming_activity": 69_706,
        "med_subscription_billing": 3_295,
    }

    def fake_metadata(requests):
        result = {}
        for index, item in enumerate(requests):
            key = str(item["key"])
            name = str(item["name"])
            is_source_request = key.startswith("media/")
            exists = name in media_rows if is_source_request else True
            result[key] = {
                "exists": exists,
                "row_count": (
                    media_rows[name]
                    if is_source_request and exists
                    else index + 1
                    if exists
                    else None
                ),
                "columns": (
                    ["record_id", "source_system"]
                    if exists
                    else []
                ),
            }
        return result

    def cold_metadata(requests):
        result = fake_metadata(requests)
        for item in result.values():
            if item["exists"]:
                item["row_count"] = None
                item["count_error"] = "warehouse starting"
        return result

    app_module.tables_fast_metadata = fake_metadata
    sources_globals["tables_fast_metadata"] = fake_metadata
    sources_globals["_classify_source"] = lambda _name: {}
    sources_globals["_persist_data_overview_snapshot"] = lambda *_args, **_kwargs: None
    try:
        with app_module.app.test_client() as client:
            health_response = client.get("/api/runtime/uc-health?source=media")
            health_payload = health_response.get_json()
            sources_response = client.get("/api/sources?source=media")
            sources_payload = sources_response.get_json()

            sources_globals["tables_fast_metadata"] = cold_metadata
            sources_globals["_data_overview_snapshot_entry"] = (
                lambda *_args, **_kwargs: None
            )
            cold_response = client.get("/api/sources?source=media")
            cold_payload = cold_response.get_json()

            sources_globals["_data_overview_snapshot_entry"] = (
                lambda _source, _catalog, _schema, metadata: {
                    "rows": {
                        key: media_rows[Path(key).name]
                        for key, item in metadata.items()
                        if item["exists"] and Path(key).name in media_rows
                    },
                    "metadata_as_of": "2026-07-30T00:00:00+00:00",
                }
            )
            cached_response = client.get("/api/sources?source=media")
            cached_payload = cached_response.get_json()
    finally:
        app_module.tables_fast_metadata = original_metadata
        sources_globals["tables_fast_metadata"] = original_sources_metadata
        sources_globals["_classify_source"] = original_classify_source
        sources_globals["_data_overview_snapshot_entry"] = original_snapshot_reader
        sources_globals["_persist_data_overview_snapshot"] = original_snapshot_writer

    assert health_response.status_code == 200, health_payload
    assert health_payload["status"] == "ok", health_payload
    assert health_payload["summary"]["configured_tables"] > 0, health_payload
    assert (
        health_payload["summary"]["readable_tables"]
        == health_payload["summary"]["configured_tables"]
    ), health_payload

    tables = {item["logical_name"]: item for item in health_payload["tables"]}
    assert (
        tables["golden_records"]["table"]
        == "cmegtmdev.marketing_cdp.slv_med_golden_records"
    ), tables["golden_records"]
    assert any(
        item["table"] == "cmegtmdev.marketing_sources.med_subscription_billing"
        for item in health_payload["tables"]
    ), health_payload["tables"]

    assert sources_response.status_code == 200, sources_payload
    assert len(sources_payload) == 5, sources_payload
    assert all(item["source_system"] == "media" for item in sources_payload), sources_payload
    assert all(item["rows"] > 0 for item in sources_payload), sources_payload
    assert sum(item["rows"] for item in sources_payload) == 84_274, sources_payload
    assert any(item["name"] == "media/med_subscription_billing" for item in sources_payload)

    assert cold_response.status_code == 503, cold_payload
    assert cold_payload["retryable"] is True, cold_payload

    assert cached_response.status_code == 200, cached_payload
    assert len(cached_payload) == 5, cached_payload
    assert sum(item["rows"] for item in cached_payload) == 84_274, cached_payload
    assert all(item["metadata_deferred"] is True for item in cached_payload), cached_payload
    assert all(item["metadata_source"] == "last_successful" for item in cached_payload), cached_payload
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
