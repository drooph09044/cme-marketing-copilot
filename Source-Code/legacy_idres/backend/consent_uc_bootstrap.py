"""Install Databricks UC compatibility for consent modules.

The consent scripts still use pandas/open/path based IO. Installing the shared
compatibility layer keeps that logic intact while allowing CODEX_DATA_SOURCE=uc
to resolve structured datasets through the central UC data access layer.
"""

from __future__ import annotations

import sys
import os
import time
from pathlib import Path

import pandas as pd


# This module lives at legacy_idres/backend/consent_uc_bootstrap.py.
# parents[1] is legacy_idres; parents[2] is the application root and is too
# broad for consent data interception.
LEGACY_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = LEGACY_ROOT.parent
BACKEND_ROOT = PROJECT_ROOT / "backend"
DATA_DIR_MARKERS = {
    "generated_data",
    "consent_data",
    "standardized_data",
    "preprocessed_data",
    "golden_records_output",
    "matching_output",
    "clustering_output",
}
UC_WRITE_DATASETS = {
    "identity_graph": "identity_graph",
    "consent_events_linked": "consent_linked",
    "consent_events_unlinked": "consent_unlinked",
    "consent_event_ledger": "consent_event_ledger",
    "consent_resolved": "consent_resolved",
    "consent_golden_record": "consent_golden_record",
    "consent_gate_results": "consent_gate_results",
    "suppression_list": "suppression_list_full",
    "suppression_list_full": "suppression_list_full",
    "household_consent_flags": "household_consent_flags",
    "demo_personas": "demo_personas",
}


def _is_consent_data_artifact(path_or_name: object) -> bool:
    path = Path(path_or_name)
    parts = {part.lower() for part in path.parts}
    return bool(parts & DATA_DIR_MARKERS) or path.name.lower() in {
        "golden_records",
        "identity_graph",
        "consent_golden_record",
        "consent_resolved",
        "consent_event_ledger",
        "consent_events_linked",
        "consent_events_unlinked",
        "household_consent_flags",
    }


def _logical_write_dataset(path_or_name: object) -> str | None:
    name = Path(path_or_name).name.lower()
    if name in UC_WRITE_DATASETS:
        return UC_WRITE_DATASETS[name]
    for prefix, logical_name in UC_WRITE_DATASETS.items():
        if name.startswith(prefix + "_"):
            return logical_name
    return None

if os.getenv("CODEX_DATA_SOURCE", "uc").strip().lower() == "uc":
    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))

    from databricks_uc_io import install_databricks_compat
    from databricks_uc_io import write_table_df

    install_databricks_compat(LEGACY_ROOT, extra_roots=(PROJECT_ROOT,))

    _original_exists = os.path.exists
    _original_getmtime = os.path.getmtime
    _original_makedirs = os.makedirs
    _original_to_csv = pd.DataFrame.to_csv

    def _exists(path) -> bool:
        if _is_consent_data_artifact(path):
            return Path(path).exists()
        return _original_exists(path)

    def _getmtime(path) -> float:
        if _is_consent_data_artifact(path) and Path(path).exists():
            return time.time()
        return _original_getmtime(path)

    def _makedirs(name, mode=0o777, exist_ok=False):
        if _is_consent_data_artifact(name):
            return None
        return _original_makedirs(name, mode=mode, exist_ok=exist_ok)

    def _to_csv(self, path_or_buf=None, *args, **kwargs):
        if path_or_buf is not None:
            logical_name = _logical_write_dataset(path_or_buf)
            if logical_name:
                write_table_df(logical_name, self, mode="overwrite")
                return None
        return _original_to_csv(self, path_or_buf, *args, **kwargs)

    os.path.exists = _exists
    os.path.getmtime = _getmtime
    os.makedirs = _makedirs
    pd.DataFrame.to_csv = _to_csv
