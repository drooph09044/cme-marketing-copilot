import json
import sys
import unittest
from pathlib import Path


LEGACY_BACKEND = Path(__file__).resolve().parents[1] / "legacy_idres" / "backend"
if str(LEGACY_BACKEND) not in sys.path:
    sys.path.insert(0, str(LEGACY_BACKEND))

from segment_lifecycle import SegmentLifecycleStore


class SegmentLifecycleStoreTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).resolve().parent / "segment_lifecycle_runtime"
        self.manual_file = self.root / "copilot_segments.json"
        self.ai_directory = self.root
        self._cleanup_runtime_files()
        self.store = SegmentLifecycleStore(
            self.manual_file,
            self.ai_directory,
            default_source="sports",
        )

    def tearDown(self):
        self._cleanup_runtime_files()

    def _cleanup_runtime_files(self):
        paths = [self.root / "copilot_segments.json"]
        if self.root.exists():
            paths.extend(self.root.glob("seg_ai_*.json"))
        for path in paths:
            if path.exists():
                path.unlink()

    def test_manual_create_activate_publish_survives_reload_for_every_source(self):
        for source in ("media", "sports", "automotive", "telecom"):
            saved = self.store.save_manual(
                {
                    "name": "manual_test_segment",
                    "source_system": source,
                    "total": 17,
                    "pipeline_status": "Draft",
                }
            )
            activated = self.store.activate(
                saved["id"],
                source_system=source,
                channel="crm",
                queued_count=17,
            )
            published, missing = self.store.publish(
                [saved["id"]],
                source_system=source,
            )

            self.assertEqual([], missing)
            self.assertEqual("activated", activated["activation_status"])
            self.assertEqual("Ready for activation", activated["pipeline_status"])
            self.assertTrue(published[0]["published_to_journey_builder"])

        reloaded = SegmentLifecycleStore(
            self.manual_file,
            self.ai_directory,
            default_source="sports",
        )
        for source in ("media", "sports", "automotive", "telecom"):
            source_records = reloaded.list(source, published_only=True)
            self.assertEqual(1, len(source_records))
            self.assertEqual(source, source_records[0]["source_system"])
            self.assertEqual("published", source_records[0]["journey_builder_status"])

    def test_ai_artifact_keeps_source_and_lifecycle_metadata(self):
        for source in ("media", "sports", "automotive", "telecom"):
            segment_id = f"seg_ai_{source}"
            ai_path = self.ai_directory / f"{segment_id}.json"
            ai_path.write_text(
                json.dumps(
                    {
                        "segment_id": segment_id,
                        "name": "ai_test_segment",
                        "domain": "automotive" if source == "automotive" else "streaming",
                        "source_system": source,
                        "count": 23,
                        "pipeline_status": "Draft",
                    }
                ),
                encoding="utf-8",
            )

            activated = self.store.activate(
                segment_id,
                source_system=source,
                channel="crm",
                queued_count=23,
            )
            published, missing = self.store.publish(
                [segment_id],
                source_system=source,
            )

            self.assertEqual([], missing)
            self.assertEqual("activated", activated["activation_status"])
            self.assertEqual(23, published[0]["count"])

        for source in ("media", "sports", "automotive", "telecom"):
            self.assertEqual(
                [f"seg_ai_{source}"],
                [record["id"] for record in self.store.list(source, published_only=True)],
            )

    def test_publish_can_persist_a_legacy_browser_only_definition(self):
        published, missing = self.store.publish(
            ["custom_legacy"],
            source_system="telecom",
            definitions=[
                {
                    "id": "custom_legacy",
                    "name": "Legacy Browser Segment",
                    "count": 9,
                    "pipeline_status": "Ready for activation",
                }
            ],
        )

        self.assertEqual([], missing)
        self.assertEqual("custom_legacy", published[0]["id"])
        self.assertEqual("telecom", published[0]["source_system"])
        self.assertTrue(self.manual_file.exists())


if __name__ == "__main__":
    unittest.main()
