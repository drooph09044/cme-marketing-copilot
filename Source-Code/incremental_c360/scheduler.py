from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def local_scheduler_command(project_root: str | None = None, config_path: str | None = None) -> str:
    root = Path(project_root or Path(__file__).resolve().parent)
    cfg = config_path or str(root / "config.yaml")
    return f'"{sys.executable}" "{root / "main.py"}" --config "{cfg}"'


def install_windows_task(task_name: str, run_time: str, project_root: str | None = None, config_path: str | None = None) -> None:
    command = local_scheduler_command(project_root, config_path)
    subprocess.run(["schtasks", "/Create", "/SC", "DAILY", "/TN", task_name, "/TR", command, "/ST", run_time, "/F"], check=True)


def cron_entry(config: dict, project_root: str | None = None) -> str:
    cron = config.get("scheduler", {}).get("local_cron", "0 8 * * *")
    return f"{cron} {local_scheduler_command(project_root)}"

