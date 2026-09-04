from __future__ import annotations

from datetime import datetime, timezone

from metadata_manager import metadata_table_name


WATERMARK_SCHEMA = """
pipeline_name STRING,
domain_name STRING,
dataset_name STRING,
watermark_column STRING,
watermark_value STRING,
batch_id STRING,
updated_at STRING
"""


class WatermarkManager:
    def __init__(self, runner, config: dict):
        self.runner = runner
        self.config = config
        self.table = metadata_table_name(config, "watermark_table")
        self.runner.sql(f"""
        CREATE TABLE IF NOT EXISTS {self.table} (
          pipeline_name STRING, domain_name STRING, dataset_name STRING, watermark_column STRING,
          watermark_value STRING, batch_id STRING, updated_at STRING
        ) USING DELTA
        """)

    def update(self, pipeline_name: str, domain: str, dataset: str, column: str | None, value: str | None, batch_id: str) -> None:
        row = {
            "pipeline_name": pipeline_name,
            "domain_name": domain,
            "dataset_name": dataset,
            "watermark_column": column,
            "watermark_value": value,
            "batch_id": batch_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        df = self.runner.create_dataframe([row], schema=WATERMARK_SCHEMA)
        df.createOrReplaceTempView("_c360_watermark_update")
        self.runner.sql(f"""
        MERGE INTO {self.table} target
        USING _c360_watermark_update source
        ON target.pipeline_name = source.pipeline_name
         AND target.domain_name = source.domain_name
         AND target.dataset_name = source.dataset_name
        WHEN MATCHED THEN UPDATE SET *
        WHEN NOT MATCHED THEN INSERT *
        """)

