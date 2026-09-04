"""Measurement/reporting service helpers."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from databricks_uc_io import DatabricksDataAccessError
from services.base import BaseService, RuntimeContext
from services.repositories import ArtifactRepository


class MeasurementService(BaseService):
    """Loads and normalizes measurement data through the repository layer."""

    def __init__(
        self,
        context: RuntimeContext | None = None,
        artifact_repository: ArtifactRepository | None = None,
    ) -> None:
        super().__init__(context)
        self.artifacts = artifact_repository or ArtifactRepository(self.context)

    def load_general_data(self, csv_path: Path) -> pd.DataFrame:
        frame = self.artifacts.read_csv(csv_path)

        if frame.empty:
            raise DatabricksDataAccessError("Unity Catalog table for general_data returned no rows.")

        frame = frame.copy()
        frame.columns = frame.columns.astype(str).str.strip()

        if "revenue" in frame.columns:
            frame["revenue"] = pd.to_numeric(frame["revenue"], errors="coerce").fillna(0)
        for column in ("campaign_start_date", "campaign_end_date"):
            if column in frame.columns:
                frame[column] = pd.to_datetime(
                    frame[column],
                    format="%d-%m-%Y",
                    errors="coerce",
                )
        return frame

