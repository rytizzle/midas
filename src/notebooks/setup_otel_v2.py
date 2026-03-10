# Databricks notebook source
# MAGIC %md
# MAGIC # OTel v2 Bronze Layer Setup
# MAGIC
# MAGIC This notebook:
# MAGIC 1. Creates the catalog schemas for raw OTel data and the observability pipeline
# MAGIC 2. Creates empty bronze tables using the **OTel v2 OTLP schema** (VARIANT, nested STRUCTs)
# MAGIC
# MAGIC Real telemetry data is written by the Midas app at runtime via `telemetry.py`.

# COMMAND ----------

dbutils.widgets.text("catalog", "midas_catalog", "Catalog Name")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Create Schemas

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE SCHEMA IF NOT EXISTS ${catalog}.otel_raw
# MAGIC COMMENT 'Raw OTel v2 OTLP bronze tables - spans, logs, metrics';
# MAGIC
# MAGIC CREATE SCHEMA IF NOT EXISTS ${catalog}.otel_observability
# MAGIC COMMENT 'Processed OTel data - silver cleaned tables and gold analytics';

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Create Bronze Tables (OTel v2 OTLP Schema)

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE TABLE IF NOT EXISTS ${catalog}.otel_raw.spans (
# MAGIC   record_id STRING,
# MAGIC   time TIMESTAMP,
# MAGIC   date DATE,
# MAGIC   service_name STRING,
# MAGIC   trace_id STRING,
# MAGIC   span_id STRING,
# MAGIC   trace_state STRING,
# MAGIC   parent_span_id STRING,
# MAGIC   flags INT,
# MAGIC   name STRING,
# MAGIC   kind STRING,
# MAGIC   start_time_unix_nano LONG,
# MAGIC   end_time_unix_nano LONG,
# MAGIC   attributes VARIANT,
# MAGIC   dropped_attributes_count INT,
# MAGIC   events ARRAY<STRUCT<
# MAGIC     time_unix_nano: LONG,
# MAGIC     name: STRING,
# MAGIC     attributes: VARIANT,
# MAGIC     dropped_attributes_count: INT
# MAGIC   >>,
# MAGIC   dropped_events_count INT,
# MAGIC   links ARRAY<STRUCT<
# MAGIC     trace_id: STRING,
# MAGIC     span_id: STRING,
# MAGIC     trace_state: STRING,
# MAGIC     attributes: VARIANT,
# MAGIC     dropped_attributes_count: INT,
# MAGIC     flags: INT
# MAGIC   >>,
# MAGIC   dropped_links_count INT,
# MAGIC   status STRUCT<
# MAGIC     message: STRING,
# MAGIC     code: STRING
# MAGIC   >,
# MAGIC   resource STRUCT<
# MAGIC     attributes: VARIANT,
# MAGIC     dropped_attributes_count: INT
# MAGIC   >,
# MAGIC   resource_schema_url STRING,
# MAGIC   instrumentation_scope STRUCT<
# MAGIC     name: STRING,
# MAGIC     version: STRING,
# MAGIC     attributes: VARIANT,
# MAGIC     dropped_attributes_count: INT
# MAGIC   >,
# MAGIC   span_schema_url STRING
# MAGIC )
# MAGIC CLUSTER BY (time, service_name, trace_id)
# MAGIC COMMENT 'OTel v2 OTLP spans from Midas app and Spark compute'
# MAGIC TBLPROPERTIES ('quality' = 'bronze');

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE TABLE IF NOT EXISTS ${catalog}.otel_raw.logs (
# MAGIC   record_id STRING,
# MAGIC   time TIMESTAMP,
# MAGIC   date DATE,
# MAGIC   service_name STRING,
# MAGIC   event_name STRING,
# MAGIC   trace_id STRING,
# MAGIC   span_id STRING,
# MAGIC   time_unix_nano LONG,
# MAGIC   observed_time_unix_nano LONG,
# MAGIC   severity_number STRING,
# MAGIC   severity_text STRING,
# MAGIC   body VARIANT,
# MAGIC   attributes VARIANT,
# MAGIC   dropped_attributes_count INT,
# MAGIC   flags INT,
# MAGIC   resource STRUCT<
# MAGIC     attributes: VARIANT,
# MAGIC     dropped_attributes_count: INT
# MAGIC   >,
# MAGIC   resource_schema_url STRING,
# MAGIC   instrumentation_scope STRUCT<
# MAGIC     name: STRING,
# MAGIC     version: STRING,
# MAGIC     attributes: VARIANT,
# MAGIC     dropped_attributes_count: INT
# MAGIC   >,
# MAGIC   log_schema_url STRING
# MAGIC )
# MAGIC CLUSTER BY (time, service_name)
# MAGIC COMMENT 'OTel v2 OTLP logs from Midas app and Spark compute'
# MAGIC TBLPROPERTIES ('quality' = 'bronze');

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE TABLE IF NOT EXISTS ${catalog}.otel_raw.metrics (
# MAGIC   record_id STRING,
# MAGIC   time TIMESTAMP,
# MAGIC   date DATE,
# MAGIC   service_name STRING,
# MAGIC   name STRING,
# MAGIC   description STRING,
# MAGIC   unit STRING,
# MAGIC   metric_type STRING,
# MAGIC   start_time_unix_nano LONG,
# MAGIC   time_unix_nano LONG,
# MAGIC   gauge STRUCT<
# MAGIC     value: DOUBLE,
# MAGIC     exemplars: ARRAY<STRUCT<time_unix_nano: LONG, value: DOUBLE, span_id: STRING, trace_id: STRING, filtered_attributes: VARIANT>>,
# MAGIC     attributes: VARIANT,
# MAGIC     flags: INT
# MAGIC   >,
# MAGIC   sum STRUCT<
# MAGIC     value: DOUBLE,
# MAGIC     exemplars: ARRAY<STRUCT<time_unix_nano: LONG, value: DOUBLE, span_id: STRING, trace_id: STRING, filtered_attributes: VARIANT>>,
# MAGIC     attributes: VARIANT,
# MAGIC     flags: INT,
# MAGIC     aggregation_temporality: STRING,
# MAGIC     is_monotonic: BOOLEAN
# MAGIC   >,
# MAGIC   histogram STRUCT<
# MAGIC     count: LONG,
# MAGIC     sum: DOUBLE,
# MAGIC     bucket_counts: ARRAY<LONG>,
# MAGIC     explicit_bounds: ARRAY<DOUBLE>,
# MAGIC     exemplars: ARRAY<STRUCT<time_unix_nano: LONG, value: DOUBLE, span_id: STRING, trace_id: STRING, filtered_attributes: VARIANT>>,
# MAGIC     attributes: VARIANT,
# MAGIC     flags: INT,
# MAGIC     min: DOUBLE,
# MAGIC     max: DOUBLE,
# MAGIC     aggregation_temporality: STRING
# MAGIC   >,
# MAGIC   summary STRUCT<
# MAGIC     count: LONG,
# MAGIC     sum: DOUBLE,
# MAGIC     quantile_values: ARRAY<STRUCT<quantile: DOUBLE, value: DOUBLE>>,
# MAGIC     attributes: VARIANT,
# MAGIC     flags: INT
# MAGIC   >,
# MAGIC   metadata VARIANT,
# MAGIC   resource STRUCT<
# MAGIC     attributes: VARIANT,
# MAGIC     dropped_attributes_count: INT
# MAGIC   >,
# MAGIC   resource_schema_url STRING,
# MAGIC   instrumentation_scope STRUCT<
# MAGIC     name: STRING,
# MAGIC     version: STRING,
# MAGIC     attributes: VARIANT,
# MAGIC     dropped_attributes_count: INT
# MAGIC   >,
# MAGIC   metric_schema_url STRING
# MAGIC )
# MAGIC CLUSTER BY (time, service_name)
# MAGIC COMMENT 'OTel v2 OTLP metrics from Spark compute'
# MAGIC TBLPROPERTIES ('quality' = 'bronze');

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Verify Bronze Tables

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT 'spans' as table_name, count(*) as row_count FROM ${catalog}.otel_raw.spans
# MAGIC UNION ALL
# MAGIC SELECT 'logs', count(*) FROM ${catalog}.otel_raw.logs
# MAGIC UNION ALL
# MAGIC SELECT 'metrics', count(*) FROM ${catalog}.otel_raw.metrics
