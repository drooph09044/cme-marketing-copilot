"""Service layer for Copilot JSON artifacts and report shaping."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from databricks_uc_io import DatabricksDataAccessError
from services.base import BaseService, RuntimeContext
from services.repositories import ArtifactRepository


class CopilotArtifactService(BaseService):
    """Keeps Copilot artifact IO behind a repository boundary."""

    REPORT_DEFAULTS = {
        "status": "error",
        "date_range": {},
        "filters": {},
        "summary": {},
        "deltas": {},
        "delivery_funnel": [],
        "channel_mix": [],
        "performance_trend": [],
        "campaign_performance": [],
        "journey_performance": [],
        "device_geography": {},
        "bounce_classification": [],
        "suppression_summary": {},
        "suppression_reasons": [],
    }

    def __init__(
        self,
        context: RuntimeContext | None = None,
        artifact_repository: ArtifactRepository | None = None,
    ) -> None:
        super().__init__(context)
        self.artifacts = artifact_repository or ArtifactRepository(self.context)

    def read_json_files(self, directory: Path) -> list[Any]:
        records = []
        for path in sorted(self.artifacts.list_json(directory)):
            try:
                payload = self.artifacts.read_json(path, default=None)
                if payload is not None:
                    records.append(payload)
            except DatabricksDataAccessError:
                raise
            except Exception as exc:
                print(f"[WARNING] Skipping invalid JSON file {path}: {exc}")
        return records

    def write_json(self, path: Path, payload: Any) -> None:
        self.artifacts.write_json(path, payload)

    def read_json_with_local_fallback(self, path: Path, default: Any = None) -> Any:
        return self.artifacts.read_json_with_local_fallback(path, default=default)

    def _error_report(self, selected_source: str) -> dict[str, Any]:
        report = dict(self.REPORT_DEFAULTS)
        report["source_system"] = selected_source
        return report

    def read_campaigns_journeys_report(self, report_path: Path, source_system: Any = None) -> dict[str, Any]:
        selected_source = self.normalize_source_system(source_system, "sports")
        try:
            payload = self.artifacts.read_json_with_local_fallback(report_path, default=None)
        except DatabricksDataAccessError:
            raise
        except Exception as exc:
            print(f"[WARNING] Unable to read campaigns journeys report: {exc}")
            return self._error_report(selected_source)

        reports = payload.get("reports") if isinstance(payload, dict) else None
        if isinstance(reports, dict):
            report = reports.get(selected_source) or reports.get("sports") or next(iter(reports.values()), {})
        else:
            report = payload if isinstance(payload, dict) else {}

        if not isinstance(report, dict):
            report = {}

        result = dict(report)
        result["status"] = result.get("status") or "success"
        result["source_system"] = selected_source
        result.setdefault("date_range", {})
        result.setdefault("filters", {})
        result.setdefault("summary", {})
        result.setdefault("deltas", {})
        result.setdefault("delivery_funnel", [])
        result.setdefault("channel_mix", [])
        result.setdefault("performance_trend", [])
        result.setdefault("campaign_performance", [])
        result.setdefault("journey_performance", [])
        result.setdefault("device_geography", {})
        result.setdefault("bounce_classification", [])
        result.setdefault("suppression_summary", {})
        result.setdefault("suppression_reasons", [])

        summary = result["summary"]
        funnel = result["delivery_funnel"]
        funnel_lookup = {
            str(item.get("stage", "")).strip().lower(): float(item.get("value") or 0)
            for item in funnel
            if isinstance(item, dict)
        }
        sent = float(summary.get("total_sent") or funnel_lookup.get("sent") or 0)
        delivered = float(
            funnel_lookup.get("delivered")
            or (sent * float(summary.get("delivery_rate") or 0) / 100 if sent else 0)
        )
        opened = float(
            funnel_lookup.get("opened")
            or (delivered * float(summary.get("open_rate") or 0) / 100 if delivered else 0)
        )
        clicked = float(
            funnel_lookup.get("clicked")
            or (delivered * float(summary.get("click_rate") or 0) / 100 if delivered else 0)
        )
        converted = float(funnel_lookup.get("converted") or 0)
        revenue = float(summary.get("revenue") or 0)

        opt_outs = float(summary.get("opt_outs") or round(delivered * 0.007))

        summary["total_conversions"] = int(summary.get("total_conversions") or converted)
        summary["conversion_rate"] = round((converted / sent) * 100, 1) if sent else 0
        summary["click_to_open_rate"] = round((clicked / opened) * 100, 1) if opened else 0
        summary["opt_out_rate"] = round((opt_outs / delivered) * 100, 1) if delivered else 0
        summary["revenue_per_conversion"] = round(revenue / converted, 0) if converted else 0
        summary["active_journeys"] = sum(
            1
            for journey in result.get("journey_performance", [])
            if str(journey.get("status", "")).lower() in {"pass", "live", "active"}
        ) or int(summary.get("total_journeys") or 0)

        trend = result.get("performance_trend", [])
        result["performance_rate_trend"] = [
            {
                "date": item.get("date"),
                "delivery_rate": (
                    round(
                        (
                            float(item.get("delivered") or 0)
                            / max(float(item.get("sent") or item.get("delivered") or 0), 1)
                        )
                        * 100,
                        1,
                    )
                    if item.get("sent")
                    else float(summary.get("delivery_rate") or 0)
                ),
                "open_rate": round(
                    (float(item.get("opened") or 0) / max(float(item.get("delivered") or 0), 1)) * 100,
                    1,
                ),
                "click_rate": round(
                    (float(item.get("clicked") or 0) / max(float(item.get("delivered") or 0), 1)) * 100,
                    1,
                ),
            }
            for item in trend
            if isinstance(item, dict)
        ]

        total_trend_clicked = sum(float(item.get("clicked") or 0) for item in trend if isinstance(item, dict)) or 1
        result["revenue_trend"] = [
            {
                "date": item.get("date"),
                "revenue": round(revenue * (float(item.get("clicked") or 0) / total_trend_clicked), 0),
            }
            for item in trend
            if isinstance(item, dict)
        ]

        channel_mix = result.get("channel_mix", [])
        result["channel_effectiveness"] = [
            {
                "channel": item.get("channel"),
                "open_rate": round(float(summary.get("open_rate") or 0) + (index - 1.5) * 1.8, 1),
                "click_rate": round(float(summary.get("click_rate") or 0) + (index - 1.5) * 0.7, 1),
            }
            for index, item in enumerate(channel_mix)
            if isinstance(item, dict)
        ]

        result["top_campaigns_comparison"] = [
            {
                "campaign": campaign.get("campaign"),
                "open_rate": float(campaign.get("open_rate") or 0),
                "click_rate": float(campaign.get("click_rate") or 0),
            }
            for campaign in result.get("campaign_performance", [])[:4]
            if isinstance(campaign, dict)
        ]

        result["journey_completion_funnel"] = [
            {"stage": "Entered", "value": int(summary.get("total_journeys") or 0) * 10000 or int(sent * 0.08)},
            {
                "stage": "Mid-Journey",
                "value": int((int(summary.get("total_journeys") or 0) * 10000 or sent * 0.08) * 0.72),
            },
            {"stage": "Completed", "value": int(converted)},
            {
                "stage": "Drop-off",
                "value": max(
                    int((int(summary.get("total_journeys") or 0) * 10000 or sent * 0.08) * 0.72)
                    - int(converted),
                    0,
                ),
            },
        ]
        return result
