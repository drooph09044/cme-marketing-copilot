import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
LEGACY_ROOT = PROJECT_ROOT / "legacy_idres"
for import_root in (BACKEND_ROOT, LEGACY_ROOT):
    if str(import_root) not in sys.path:
        sys.path.insert(0, str(import_root))

import databricks_uc_io


class _FakeFiles:
    def __init__(self):
        self.uploads = []
        self.deletes = []

    def upload(self, path, stream, overwrite=False):
        self.uploads.append((path, stream.read(), overwrite))

    def delete(self, path):
        self.deletes.append(path)


class DatabricksUcBulkWriteTests(unittest.TestCase):
    def _csv_path(self):
        handle = tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            suffix=".csv",
            delete=False,
        )
        self.addCleanup(lambda: Path(handle.name).unlink(missing_ok=True))
        handle.write("record_id,full_name\n1,Ada Lovelace\n2,Grace Hopper\n")
        handle.close()
        return handle.name

    def test_bulk_csv_write_uses_one_atomic_replace_and_cleans_stage(self):
        files = _FakeFiles()
        client = SimpleNamespace(files=files)
        table = databricks_uc_io.TableRef("catalog", "schema", "target")
        statements = []

        with (
            patch.dict(os.environ, {"CODEX_DATA_SOURCE": "uc"}),
            patch.object(databricks_uc_io, "_resolve_table_for_write", return_value=table),
            patch.object(databricks_uc_io, "_output_volume_dir", return_value="/Volumes/c/s/v"),
            patch.object(databricks_uc_io, "_workspace_client", return_value=client),
            patch.object(
                databricks_uc_io,
                "_validated_sql_count",
                return_value=2,
            ) as validated_count,
            patch.object(
                databricks_uc_io,
                "_execute_statement",
                side_effect=lambda statement, timeout=None: statements.append((statement, timeout)),
            ),
        ):
            result = databricks_uc_io.write_table_csv_file(
                "golden_records",
                self._csv_path(),
                source="sports",
            )

        self.assertEqual(result, table)
        self.assertEqual(len(files.uploads), 1)
        self.assertTrue(files.uploads[0][0].startswith("/Volumes/c/s/v/codex_stage_target_"))
        self.assertTrue(files.uploads[0][0].endswith(".csv"))
        self.assertEqual(files.uploads[0][2], True)
        self.assertEqual(files.deletes, [files.uploads[0][0]])
        self.assertEqual(len(statements), 1)
        statement, timeout = statements[0]
        self.assertIn("CREATE OR REPLACE TABLE `catalog`.`schema`.`target` USING DELTA AS", statement)
        self.assertIn("FROM read_files(", statement)
        self.assertIn("`record_id` STRING, `full_name` STRING", statement)
        self.assertNotIn("DELETE FROM", statement)
        self.assertNotIn("INSERT INTO", statement)
        self.assertEqual(timeout, 900)
        self.assertEqual(validated_count.call_count, 2)

    def test_failed_replace_still_cleans_stage_without_deleting_target(self):
        files = _FakeFiles()
        client = SimpleNamespace(files=files)
        table = databricks_uc_io.TableRef("catalog", "schema", "target")
        statements = []

        def fail_replace(statement, timeout=None):
            statements.append(statement)
            raise RuntimeError("replacement failed")

        with (
            patch.dict(os.environ, {"CODEX_DATA_SOURCE": "uc"}),
            patch.object(databricks_uc_io, "_resolve_table_for_write", return_value=table),
            patch.object(databricks_uc_io, "_output_volume_dir", return_value="/Volumes/c/s/v"),
            patch.object(databricks_uc_io, "_workspace_client", return_value=client),
            patch.object(
                databricks_uc_io,
                "_validated_sql_count",
                return_value=2,
            ) as validated_count,
            patch.object(databricks_uc_io, "_execute_statement", side_effect=fail_replace),
        ):
            with self.assertRaisesRegex(RuntimeError, "replacement failed"):
                databricks_uc_io.write_table_csv_file(
                    "golden_records",
                    self._csv_path(),
                    source="sports",
                )

        self.assertEqual(len(statements), 1)
        self.assertNotIn("DELETE FROM", statements[0])
        self.assertEqual(files.deletes, [files.uploads[0][0]])
        self.assertEqual(validated_count.call_count, 1)

    def test_pipeline_csv_paths_map_to_expected_uc_datasets(self):
        with patch.dict(os.environ, {"CODEX_DATA_SOURCE": "local"}):
            import pipeline_uc_bootstrap

        cases = {
            "matching_output/sports/enhanced_prepared_records.csv": (
                "enhanced_prepared_records",
                "sports",
            ),
            "matching_output/media/candidate_pairs.csv": ("candidate_pairs", "media"),
            "clustering_output/sports/clustered_records.csv": ("clustered_records", "sports"),
            "clustering_output/media/household_links.csv": ("household_links", "media"),
            "golden_records_output/sports/golden_records.csv": ("golden_records", "sports"),
            "golden_records_output/media/superseded_ids.csv": ("superseded_ids", "media"),
        }
        for path, expected in cases.items():
            with self.subTest(path=path):
                self.assertEqual(
                    pipeline_uc_bootstrap._logical_dataset_for_path(path),
                    expected,
                )


if __name__ == "__main__":
    unittest.main()
