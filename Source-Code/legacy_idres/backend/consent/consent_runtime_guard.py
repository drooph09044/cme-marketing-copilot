"""Runtime guards for consent batch scripts."""

import os
from pathlib import Path


UC_FILESTYLE_IO_FLAG = "CODEX_ALLOW_UC_FILESTYLE_IO"
_TRUE_VALUES = {"1", "true", "yes", "on"}
PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_CONFIG = PROJECT_ROOT / "backend" / "config.yaml"


def _truthy(value):
    return str(value or "").strip().lower() in _TRUE_VALUES


def _config_allows_uc_filestyle_io():
    try:
        import yaml

        loaded = yaml.safe_load(BACKEND_CONFIG.read_text(encoding="utf-8")) or {}
    except Exception:
        return False
    databricks = loaded.get("databricks", {})
    if not isinstance(databricks, dict):
        return False
    return _truthy(databricks.get("allow_uc_filestyle_io"))


def uc_filestyle_io_enabled():
    return _truthy(os.getenv(UC_FILESTYLE_IO_FLAG, "")) or _config_allows_uc_filestyle_io()


def abort_if_uc_runtime(script_name):
    if os.getenv("CODEX_DATA_SOURCE", "").strip().lower() == "uc" and not uc_filestyle_io_enabled():
        raise SystemExit(
            f"{script_name} is local-file based and is disabled when CODEX_DATA_SOURCE=uc. "
            f"Set {UC_FILESTYLE_IO_FLAG}=1 to run it through the UC compatibility layer."
        )
