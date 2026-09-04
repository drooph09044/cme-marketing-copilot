import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import databricks_uc_io


class DatabricksUcFilesystemTests(unittest.TestCase):
    def test_generated_json_unlink_uses_volume_delete(self):
        for source in ("media", "sports", "automotive", "telecom"):
            with self.subTest(source=source):
                cluster_index = (
                    Path("/app/python/source_code/Source-Code/legacy_idres")
                    / "clustering_output"
                    / source
                    / "cluster_index.json"
                )

                with (
                    patch.dict(os.environ, {"CODEX_DATA_SOURCE": "uc"}),
                    patch.object(databricks_uc_io, "delete_volume_file") as volume_delete,
                    patch.object(databricks_uc_io, "_ORIGINAL_UNLINK") as local_unlink,
                ):
                    databricks_uc_io._unlink_compat(cluster_index, missing_ok=True)

                volume_delete.assert_called_once_with(
                    str(cluster_index),
                    missing_ok=True,
                )
                local_unlink.assert_not_called()

    def test_virtual_pipeline_directory_does_not_touch_deployed_source(self):
        for source in ("media", "sports", "automotive", "telecom"):
            with self.subTest(source=source):
                output_directory = (
                    Path("/app/python/source_code/Source-Code/legacy_idres")
                    / "clustering_output"
                    / source
                )

                with (
                    patch.dict(os.environ, {"CODEX_DATA_SOURCE": "uc"}),
                    patch.object(databricks_uc_io, "_ORIGINAL_MKDIR") as local_mkdir,
                ):
                    databricks_uc_io._mkdir_compat(
                        output_directory,
                        parents=True,
                        exist_ok=True,
                    )

                local_mkdir.assert_not_called()

    def test_non_artifact_unlink_remains_local(self):
        regular_file = Path("/tmp/codex-non-artifact.txt")

        with (
            patch.dict(os.environ, {"CODEX_DATA_SOURCE": "uc"}),
            patch.object(databricks_uc_io, "delete_volume_file") as volume_delete,
            patch.object(databricks_uc_io, "_ORIGINAL_UNLINK") as local_unlink,
        ):
            databricks_uc_io._unlink_compat(regular_file, missing_ok=True)

        local_unlink.assert_called_once_with(regular_file, missing_ok=True)
        volume_delete.assert_not_called()


if __name__ == "__main__":
    unittest.main()
