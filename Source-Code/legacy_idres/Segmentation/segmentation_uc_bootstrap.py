"""Install Databricks UC compatibility for Segmentation modules."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd


SEGMENTATION_ROOT = Path(__file__).resolve().parent
LEGACY_ROOT = SEGMENTATION_ROOT.parent
PROJECT_ROOT = LEGACY_ROOT.parent
BACKEND_ROOT = PROJECT_ROOT / "backend"


def _is_ai_segment_members_path(path_or_name: object) -> bool:
    path = Path(path_or_name)
    parts = {part.lower() for part in path.parts}
    return "ai_segments" in parts and path.suffix == ""


def _is_ai_segment_csv_path(path_or_name: object) -> bool:
    path = Path(path_or_name)
    parts = {part.lower() for part in path.parts}
    return "ai_segments" in parts and path.suffix.lower() == ".csv"


def _is_segmentation_artifact_dir(path_or_name: object) -> bool:
    parts = {part.lower() for part in Path(path_or_name).parts}
    return bool(parts & {"ai_segments", "segmentation", "automotive"})


if os.getenv("CODEX_DATA_SOURCE", "uc").strip().lower() == "uc":
    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))

    from databricks_uc_io import install_databricks_compat, write_table_df, write_volume_text

    install_databricks_compat(LEGACY_ROOT, extra_roots=(PROJECT_ROOT,))

    _original_to_csv = pd.DataFrame.to_csv
    _original_mkdir = Path.mkdir

    def _to_csv(self, path_or_buf=None, *args, **kwargs):
        if path_or_buf is not None and _is_ai_segment_members_path(path_or_buf):
            frame = self.copy()
            if "segment_id" not in frame.columns:
                frame.insert(0, "segment_id", Path(path_or_buf).name)
            write_table_df("segment_members", frame, mode="append")
            return None
        if path_or_buf is not None and _is_ai_segment_csv_path(path_or_buf):
            csv_text = _original_to_csv(self, None, *args, **kwargs)
            write_volume_text(str(path_or_buf), csv_text)
            return None
        return _original_to_csv(self, path_or_buf, *args, **kwargs)

    def _mkdir(self, mode=0o777, parents=False, exist_ok=False):
        if _is_segmentation_artifact_dir(self):
            return None
        return _original_mkdir(self, mode=mode, parents=parents, exist_ok=exist_ok)

    pd.DataFrame.to_csv = _to_csv
    Path.mkdir = _mkdir
