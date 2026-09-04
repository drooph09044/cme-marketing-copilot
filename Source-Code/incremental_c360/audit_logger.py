from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from metadata_manager import metadata_table_name


AUDIT_SCHEMA = """
run_id STRING,
batch_id STRING,
pipeline_name STRING,
domain_name STRING,
dataset_name STRING,
start_time STRING,
end_time STRING,
records_read BIGINT,
records_inserted BIGINT,
records_updated BIGINT,
records_rejected BIGINT,
status STRING,
error_message STRING,
execution_duration DOUBLE,
run_date STRING
"""

QUALITY_SCHEMA = """
run_id STRING,
batch_id STRING,
domain_name STRING,
dataset_name STRING,
rule_name STRING,
status STRING,
failed_count BIGINT,
message STRING,
checked_at STRING
"""


class AuditLogger:
    def __init__(self, runner, config: dict[str, Any]):
        self.runner = runner
        self.config = config
        self.audit_table = metadata_table_name(config, "audit_table")
        self.quality_table = metadata_table_name(config, "quality_table")
        self._ensure_tables()

    def start_run(self, run_id: str, batch_id: str, run_date: str) -> None:
        self.log({
            "run_id": run_id,
            "batch_id": batch_id,
            "pipeline_name": self.config.get("audit", {}).get("pipeline_name", "c360_incremental_generator"),
            "domain_name": None,
            "dataset_name": None,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "end_time": None,
            "records_read": 0,
            "records_inserted": 0,
            "records_updated": 0,
            "records_rejected": 0,
            "status": "RUNNING",
            "error_message": None,
            "execution_duration": None,
            "run_date": run_date,
        })

    def log(self, row: dict[str, Any]) -> None:
        df = self.runner.create_dataframe([row], schema=AUDIT_SCHEMA)
        df.write.format("delta").mode("append").saveAsTable(self.audit_table)

    def log_quality(self, rows: list[dict[str, Any]]) -> None:
        if rows:
            self.runner.create_dataframe(rows, schema=QUALITY_SCHEMA).write.format("delta").mode("append").saveAsTable(self.quality_table)

    def _ensure_tables(self) -> None:
        self.runner.sql(f"""
        CREATE TABLE IF NOT EXISTS {self.audit_table} (
          run_id STRING, batch_id STRING, pipeline_name STRING, domain_name STRING, dataset_name STRING,
          start_time STRING, end_time STRING, records_read BIGINT, records_inserted BIGINT,
          records_updated BIGINT, records_rejected BIGINT, status STRING, error_message STRING,
          execution_duration DOUBLE, run_date STRING
        ) USING DELTA
        """)
        self.runner.sql(f"""
        CREATE TABLE IF NOT EXISTS {self.quality_table} (
          run_id STRING, batch_id STRING, domain_name STRING, dataset_name STRING,
          rule_name STRING, status STRING, failed_count BIGINT, message STRING, checked_at STRING
        ) USING DELTA
        """)

