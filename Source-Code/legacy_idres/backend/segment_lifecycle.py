"""Durable lifecycle storage for manual and AI audience segments.

The existing segment engines intentionally keep their current JSON/CSV
artifacts.  This module only coordinates the workflow metadata that must
survive a page navigation: source ownership, activation, and publication to
Journey Builder.  The configured Databricks compatibility layer transparently
maps these paths to the governed Unity Catalog Volume in Databricks Apps.
"""

from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


SUPPORTED_SOURCES = {"all", "media", "sports", "automotive", "telecom"}
JOURNEY_READY_STATUSES = {"Ready for activation", "Production ready"}

_LOCKS: dict[tuple[str, str], threading.RLock] = {}
_LOCKS_GUARD = threading.Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_int(value: Any) -> int:
    try:
        return max(int(float(value or 0)), 0)
    except (TypeError, ValueError):
        return 0


def _record_id(record: dict[str, Any]) -> str:
    return str(record.get("segment_id") or record.get("id") or "").strip()


def _lock_for(manual_file: Path, ai_directory: Path) -> threading.RLock:
    key = (str(manual_file), str(ai_directory))
    with _LOCKS_GUARD:
        return _LOCKS.setdefault(key, threading.RLock())


class SegmentLifecycleStore:
    """Coordinates lifecycle metadata across the existing segment artifacts."""

    def __init__(
        self,
        manual_file: Path,
        ai_directory: Path,
        *,
        extra_directories: Iterable[Path] = (),
        default_source: str = "sports",
    ) -> None:
        self.manual_file = Path(manual_file)
        self.ai_directory = Path(ai_directory)
        self.extra_directories = tuple(Path(path) for path in extra_directories)
        self.default_source = self.normalize_source(default_source, "sports")
        self._lock = _lock_for(self.manual_file, self.ai_directory)

    @staticmethod
    def normalize_source(value: Any, fallback: str = "all") -> str:
        normalized = str(value or "").strip().lower()
        if normalized in SUPPORTED_SOURCES:
            return normalized
        safe_fallback = str(fallback or "all").strip().lower()
        return safe_fallback if safe_fallback in SUPPORTED_SOURCES else "all"

    def _source_for(self, record: dict[str, Any]) -> str:
        explicit = record.get("source_system") or record.get("sourceSystem")
        if explicit:
            return self.normalize_source(explicit, "all")
        if str(record.get("domain") or "").strip().lower() == "automotive":
            return "automotive"
        # Older streaming artifacts did not persist a source system.  Treat
        # them as global rather than incorrectly assigning Media or Sports.
        return "all"

    @staticmethod
    def _pipeline_status(record: dict[str, Any]) -> str:
        explicit = str(
            record.get("pipeline_status")
            or record.get("_pipelineStatus")
            or ""
        ).strip()
        if explicit:
            return explicit
        status = str(record.get("status") or "").strip()
        if status in {
            "Draft",
            "Needs review",
            "In QA review",
            "Ready for activation",
            "Production ready",
        }:
            return status
        return "Draft"

    @staticmethod
    def _activation_status(record: dict[str, Any]) -> str:
        activation = record.get("activation")
        nested = activation.get("status") if isinstance(activation, dict) else ""
        explicit = str(
            record.get("activation_status")
            or nested
            or record.get("_status")
            or ""
        ).strip().lower()
        if explicit in {"active", "activated", "queued", "published"}:
            return "activated"
        return "inactive"

    @staticmethod
    def _journey_status(record: dict[str, Any]) -> str:
        if record.get("published_to_journey_builder") is True:
            return "published"
        explicit = str(record.get("journey_builder_status") or "").strip().lower()
        return "published" if explicit == "published" else "not_published"

    def present(self, record: dict[str, Any], *, origin: str = "") -> dict[str, Any]:
        """Return one backward-compatible record for Flask/React consumers."""
        item = dict(record or {})
        segment_id = _record_id(item)
        source = self._source_for(item)
        pipeline_status = self._pipeline_status(item)
        activation_status = self._activation_status(item)
        journey_status = self._journey_status(item)
        count = _safe_int(item.get("count", item.get("total", item.get("_count", 0))))

        item.update(
            {
                "id": segment_id,
                "segment_id": segment_id,
                "source_system": source,
                "count": count,
                "total": count,
                "pipeline_status": pipeline_status,
                "activation_status": activation_status,
                "journey_builder_status": journey_status,
                "published_to_journey_builder": journey_status == "published",
                "_custom": True,
                "_status": "active" if activation_status == "activated" else "inactive",
                "_pipelineStatus": pipeline_status,
            }
        )
        # The Activation workspace uses ``status`` for its visible pipeline
        # badge.  Keep the persisted activation status in its dedicated field.
        item["status"] = pipeline_status
        if origin:
            item["definition_origin"] = origin
        elif not item.get("definition_origin"):
            item["definition_origin"] = (
                "AI custom segment" if item.get("domain") or item.get("root") else "Saved custom segment"
            )
        return item

    def _read_manual(self) -> list[dict[str, Any]]:
        if not self.manual_file.exists():
            return []
        try:
            payload = json.loads(self.manual_file.read_text(encoding="utf-8"))
        except (OSError, TypeError, ValueError):
            return []
        return [dict(item) for item in payload if isinstance(item, dict)] if isinstance(payload, list) else []

    def _write_manual(self, records: list[dict[str, Any]]) -> None:
        self.manual_file.parent.mkdir(parents=True, exist_ok=True)
        self.manual_file.write_text(
            json.dumps(records, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    @staticmethod
    def _read_object(path: Path) -> dict[str, Any] | None:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, TypeError, ValueError):
            return None
        return dict(payload) if isinstance(payload, dict) else None

    @staticmethod
    def _write_object(path: Path, record: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(record, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def _iter_directory_records(
        self,
        directory: Path,
        origin: str,
    ) -> Iterable[tuple[Path, dict[str, Any], str]]:
        if not directory.exists():
            return
        for path in sorted(directory.glob("*.json")):
            record = self._read_object(path)
            if record is not None:
                yield path, record, origin

    def list(
        self,
        source_system: Any = "all",
        *,
        published_only: bool = False,
        include_extra: bool = True,
    ) -> list[dict[str, Any]]:
        requested_source = self.normalize_source(source_system, "all")
        with self._lock:
            candidates: list[tuple[dict[str, Any], str]] = [
                (record, "AI custom segment")
                for _, record, _ in self._iter_directory_records(
                    self.ai_directory,
                    "AI custom segment",
                )
            ]
            candidates.extend(
                (record, "Saved custom segment")
                for record in self._read_manual()
            )
            if include_extra:
                for directory in self.extra_directories:
                    candidates.extend(
                        (record, "Saved custom segment")
                        for _, record, _ in self._iter_directory_records(
                            directory,
                            "Saved custom segment",
                        )
                    )

        deduplicated: dict[str, dict[str, Any]] = {}
        for record, origin in candidates:
            presented = self.present(record, origin=origin)
            segment_id = presented["id"]
            if not segment_id or segment_id in deduplicated:
                continue
            record_source = presented["source_system"]
            if requested_source != "all" and record_source not in {requested_source, "all"}:
                continue
            if published_only and not presented["published_to_journey_builder"]:
                continue
            deduplicated[segment_id] = presented

        def sort_key(item: dict[str, Any]) -> str:
            return str(
                item.get("published_at")
                or item.get("activated_at")
                or item.get("created_at")
                or ""
            )

        return sorted(deduplicated.values(), key=sort_key, reverse=True)

    def get(self, segment_id: str) -> dict[str, Any] | None:
        wanted = str(segment_id or "").strip()
        if not wanted:
            return None
        for record in self.list("all"):
            if record["id"] == wanted:
                return record
        return None

    def save_manual(self, payload: dict[str, Any]) -> dict[str, Any]:
        body = payload.get("segment") if isinstance(payload.get("segment"), dict) else payload
        body = dict(body or {})
        name = str(body.get("name") or "").strip()
        if not name:
            raise ValueError("name is required")

        with self._lock:
            existing = self._read_manual()
            segment_id = _record_id(body)
            if not segment_id:
                base = int(time.time() * 1000)
                segment_id = f"custom_{base}"
                existing_ids = {_record_id(record) for record in existing}
                while segment_id in existing_ids:
                    base += 1
                    segment_id = f"custom_{base}"

            previous = next(
                (record for record in existing if _record_id(record) == segment_id),
                {},
            )
            now = _utc_now()
            record = {
                **previous,
                **body,
                "id": segment_id,
                "segment_id": segment_id,
                "name": name,
                "source_system": self.normalize_source(
                    body.get("source_system") or body.get("sourceSystem"),
                    self.default_source,
                ),
                "count": _safe_int(body.get("count", body.get("total", previous.get("count", 0)))),
                "total": _safe_int(body.get("total", body.get("count", previous.get("total", 0)))),
                "created_at": previous.get("created_at") or body.get("created_at") or now,
                "last_refreshed": body.get("last_refreshed") or previous.get("last_refreshed") or now,
                "pipeline_status": self._pipeline_status({**previous, **body}),
                "activation_status": self._activation_status({**previous, **body}),
                "journey_builder_status": self._journey_status({**previous, **body}),
            }

            updated = False
            for index, current in enumerate(existing):
                if _record_id(current) == segment_id:
                    existing[index] = record
                    updated = True
                    break
            if not updated:
                existing.insert(0, record)
            self._write_manual(existing)
        return self.present(record, origin="Saved custom segment")

    def _update_record(
        self,
        segment_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any] | None:
        wanted = str(segment_id or "").strip()
        if not wanted:
            return None
        with self._lock:
            manual_records = self._read_manual()
            for index, record in enumerate(manual_records):
                if _record_id(record) != wanted:
                    continue
                updated = {**record, **updates, "id": wanted, "segment_id": wanted}
                manual_records[index] = updated
                self._write_manual(manual_records)
                return self.present(updated, origin="Saved custom segment")

            for path, record, origin in self._iter_directory_records(
                self.ai_directory,
                "AI custom segment",
            ):
                if _record_id(record) != wanted:
                    continue
                updated = {**record, **updates, "segment_id": wanted}
                self._write_object(path, updated)
                return self.present(updated, origin=origin)

            for directory in self.extra_directories:
                for path, record, origin in self._iter_directory_records(
                    directory,
                    "Saved custom segment",
                ):
                    if _record_id(record) != wanted:
                        continue
                    updated = {**record, **updates, "id": wanted, "segment_id": wanted}
                    self._write_object(path, updated)
                    return self.present(updated, origin=origin)
        return None

    def activate(
        self,
        segment_id: str,
        *,
        source_system: Any,
        channel: str,
        queued_count: int,
    ) -> dict[str, Any] | None:
        existing = self.get(segment_id)
        if existing is None:
            return None
        pipeline_status = existing.get("pipeline_status")
        if pipeline_status not in JOURNEY_READY_STATUSES:
            pipeline_status = "Ready for activation"
        now = _utc_now()
        return self._update_record(
            segment_id,
            {
                "source_system": self.normalize_source(
                    source_system,
                    existing.get("source_system") or self.default_source,
                ),
                "activation_status": "activated",
                "activated_at": now,
                "activation_channel": str(channel or "crm").strip() or "crm",
                "activation_queued_count": _safe_int(queued_count),
                "pipeline_status": pipeline_status,
            },
        )

    def publish(
        self,
        segment_ids: Iterable[str],
        *,
        source_system: Any,
        destination: str = "journey_builder",
        definitions: Iterable[dict[str, Any]] = (),
    ) -> tuple[list[dict[str, Any]], list[str]]:
        source = self.normalize_source(source_system, self.default_source)
        definition_map = {
            _record_id(definition): dict(definition)
            for definition in definitions
            if isinstance(definition, dict) and _record_id(definition)
        }
        published: list[dict[str, Any]] = []
        missing: list[str] = []
        now = _utc_now()

        for raw_id in segment_ids:
            segment_id = str(raw_id or "").strip()
            if not segment_id:
                continue
            existing = self.get(segment_id)
            if existing is None and segment_id in definition_map:
                definition = {
                    **definition_map[segment_id],
                    "id": segment_id,
                    "segment_id": segment_id,
                    "source_system": source,
                }
                try:
                    existing = self.save_manual(definition)
                except ValueError:
                    existing = None
            if existing is None:
                missing.append(segment_id)
                continue
            updated = self._update_record(
                segment_id,
                {
                    "source_system": self.normalize_source(
                        existing.get("source_system"),
                        source,
                    ),
                    "journey_builder_status": "published",
                    "published_to_journey_builder": True,
                    "published_at": now,
                    "publish_destination": str(destination or "journey_builder").strip()
                    or "journey_builder",
                },
            )
            if updated is not None:
                published.append(updated)
        return published, missing

