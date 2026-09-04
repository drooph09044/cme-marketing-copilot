CREATE SCHEMA IF NOT EXISTS main.c360_ops;

CREATE TABLE IF NOT EXISTS main.c360_ops.incremental_audit_log (
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
) USING DELTA;

CREATE TABLE IF NOT EXISTS main.c360_ops.incremental_job_control (
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
) USING DELTA;

CREATE TABLE IF NOT EXISTS main.c360_ops.incremental_watermarks (
  pipeline_name STRING,
  domain_name STRING,
  dataset_name STRING,
  watermark_column STRING,
  watermark_value STRING,
  batch_id STRING,
  updated_at STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS main.c360_ops.incremental_quality_results (
  run_id STRING,
  batch_id STRING,
  domain_name STRING,
  dataset_name STRING,
  rule_name STRING,
  status STRING,
  failed_count BIGINT,
  message STRING,
  checked_at STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS main.c360_ops.incremental_update_history (
  run_id STRING,
  batch_id STRING,
  run_date STRING,
  domain_name STRING,
  dataset_name STRING,
  record_key STRING,
  update_reason STRING,
  updated_at STRING
) USING DELTA;

