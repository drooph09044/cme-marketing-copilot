from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from metadata_manager import metadata_table_name


JOB_CONTROL_SCHEMA = """
job_name STRING,
run_id STRING,
batch_id STRING,
run_date STRING,
start_time STRING,
end_time STRING,
status STRING,
records_inserted BIGINT,
records_updated BIGINT,
records_failed BIGINT,
next_scheduled_run STRING
"""


class JobController:
    def __init__(self, runner, config: dict):
        self.runner = runner
        self.config = config
        self.table = metadata_table_name(config, "job_control_table")
        self.runner.sql(f"""
        CREATE TABLE IF NOT EXISTS {self.table} (
          job_name STRING, run_id STRING, batch_id STRING, run_date STRING, start_time STRING,
          end_time STRING, status STRING, records_inserted BIGINT, records_updated BIGINT,
          records_failed BIGINT, next_scheduled_run STRING
        ) USING DELTA
        """)

    def new_batch(self, run_date: date | None = None) -> dict[str, str]:
        run_date = run_date or date.today()
        run_id = str(uuid4())
        return {"run_id": run_id, "batch_id": f"{run_date:%Y%m%d}-{run_id[:8]}", "run_date": run_date.isoformat()}

    def start(self, batch: dict[str, str]) -> None:
        self._append({**batch, "job_name": self.config["campaign"]["name"], "start_time": datetime.now(timezone.utc).isoformat(), "end_time": None, "status": "RUNNING", "records_inserted": 0, "records_updated": 0, "records_failed": 0, "next_scheduled_run": self.next_run_date(batch["run_date"])})

    def finish(self, batch: dict[str, str], status: str, inserted: int, updated: int, failed: int = 0) -> None:
        self._append({**batch, "job_name": self.config["campaign"]["name"], "start_time": None, "end_time": datetime.now(timezone.utc).isoformat(), "status": status, "records_inserted": inserted, "records_updated": updated, "records_failed": failed, "next_scheduled_run": self.next_run_date(batch["run_date"])})

    def next_run_date(self, run_date: str) -> str:
        current = datetime.fromisoformat(run_date).date()
        include_weekends = bool(self.config.get("campaign", {}).get("include_weekends", True))
        nxt = current + timedelta(days=1)
        while not include_weekends and nxt.weekday() >= 5:
            nxt += timedelta(days=1)
        return nxt.isoformat()

    def _append(self, row: dict) -> None:
        self.runner.create_dataframe([row], schema=JOB_CONTROL_SCHEMA).write.format("delta").mode("append").saveAsTable(self.table)

