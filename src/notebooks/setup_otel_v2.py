# Databricks notebook source
# MAGIC %md
# MAGIC # OTel v2 Bronze Layer Setup
# MAGIC
# MAGIC This notebook:
# MAGIC 1. Creates the catalog schemas for raw OTel data and the observability pipeline
# MAGIC 2. Creates bronze tables using the **OTel v2 OTLP schema** (VARIANT, nested STRUCTs)
# MAGIC 3. Generates synthetic OTel data to bootstrap the demo

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
# MAGIC ## 3. Generate Synthetic OTel Data (v2 Format)

# COMMAND ----------

import random
import uuid
import json
from datetime import datetime, timedelta, timezone
from pyspark.sql import Row
from pyspark.sql.types import (
    StructType, StructField, StringType, TimestampType, LongType,
    IntegerType, DateType
)

try:
    CATALOG = dbutils.widgets.get("catalog")
except Exception:
    CATALOG = "midas_catalog"
random.seed(42)

NUM_HOURS = 72
BASE_TIME = datetime.now(timezone.utc) - timedelta(hours=NUM_HOURS)

SERVICES = {
    "midas-app": {
        "operations": [
            ("http.request", "GET /api/catalogs", 50, 200),
            ("http.request", "GET /api/schemas", 40, 150),
            ("http.request", "POST /api/profile", 2000, 8000),
            ("http.request", "POST /api/metadata/generate", 3000, 15000),
            ("http.request", "POST /api/apply", 500, 3000),
            ("sdk.catalogs.list", None, 100, 500),
            ("sdk.schemas.list", None, 80, 300),
            ("sdk.tables.list", None, 150, 800),
            ("sql.connect", None, 200, 2000),
            ("sql.count", None, 100, 1500),
            ("sql.describe", None, 50, 400),
            ("sql.column_stats", None, 300, 3000),
            ("llm.generate", None, 2000, 12000),
        ],
        "compute_type": "serverless",
        "cluster_id": None,
    },
    "etl-daily-ingest": {
        "operations": [
            ("spark.sql", None, 5000, 120000),
            ("spark.job", None, 3000, 60000),
            ("spark.stage", None, 1000, 30000),
        ],
        "compute_type": "job_cluster",
        "cluster_id": "0301-194532-abc123",
    },
    "streaming-cdc-pipeline": {
        "operations": [
            ("streaming.batch.cdc_ingest", None, 500, 5000),
            ("spark.sql", None, 200, 3000),
        ],
        "compute_type": "job_cluster",
        "cluster_id": "0301-194532-stream01",
    },
    "sdp-gold-pipeline": {
        "operations": [
            ("sdp.pipeline.update", None, 30000, 300000),
            ("sdp.flow.customers_gold", None, 5000, 60000),
            ("sdp.flow.orders_gold", None, 8000, 90000),
        ],
        "compute_type": "dlt_pipeline",
        "cluster_id": None,
    },
}

ERROR_MESSAGES = [
    "CONNECT_TIMEOUT: SQL warehouse connection timed out after 30s",
    "TABLE_NOT_FOUND: Table does not exist",
    "PERMISSION_DENIED: User does not have SELECT",
    "RATE_LIMIT_EXCEEDED: Foundation Model API rate limit exceeded",
    "OOM: Java heap space exceeded during shuffle",
]

# COMMAND ----------

# --- Generate Spans ---
spans_data = []
for hour_offset in range(NUM_HOURS):
    ts = BASE_TIME + timedelta(hours=hour_offset)
    hour_of_day = (ts.hour - 8) % 24
    if 9 <= hour_of_day <= 17:
        traffic_mult = random.uniform(1.5, 3.0)
    elif 0 <= hour_of_day <= 6:
        traffic_mult = random.uniform(0.1, 0.3)
    else:
        traffic_mult = random.uniform(0.5, 1.0)

    for service_name, svc_config in SERVICES.items():
        ops = svc_config["operations"]
        num_requests = int(random.uniform(5, 20) * traffic_mult)

        for _ in range(num_requests):
            trace_id = uuid.uuid4().hex[:32]
            span_id = uuid.uuid4().hex[:16]
            op_name, route, min_ms, max_ms = random.choice(ops)

            duration_ms = max_ms * random.uniform(2, 5) if random.random() < 0.05 else random.uniform(min_ms, max_ms)

            start_time = ts + timedelta(minutes=random.randint(0, 59), seconds=random.randint(0, 59))
            end_time = start_time + timedelta(milliseconds=duration_ms)
            start_ns = int(start_time.timestamp() * 1e9)
            end_ns = int(end_time.timestamp() * 1e9)

            error_rate = 0.02 if service_name == "midas-app" else 0.05
            is_error = random.random() < error_rate
            status_code = "STATUS_CODE_ERROR" if is_error else "STATUS_CODE_OK"
            status_msg = random.choice(ERROR_MESSAGES) if is_error else ""

            # Build attributes
            attrs = {}
            if route:
                attrs["http.route"] = route
                attrs["http.method"] = route.split(" ")[0]
            if "sql." in op_name:
                attrs["db.system"] = "databricks"
                attrs["db.operation"] = op_name.replace("sql.", "")
            if "llm." in op_name:
                attrs["llm.model"] = "databricks-claude-sonnet-4-5"
                attrs["llm.request.col_count"] = str(random.randint(5, 30))
            if "spark.stage" in op_name:
                attrs["spark.stage.shuffle.read.bytes"] = str(random.randint(0, 500000000))
                attrs["spark.stage.shuffle.write.bytes"] = str(random.randint(0, 300000000))
                attrs["spark.stage.disk_bytes_spilled"] = str(random.randint(0, 100000000) if random.random() < 0.1 else 0)
            if "sdp." in op_name and "flow" in op_name:
                attrs["sdp.flow.name"] = op_name.split(".")[-1]
                attrs["sdp.flow.output_rows"] = str(random.randint(100, 500000))
            if "streaming.batch" in op_name:
                attrs["spark.streaming.num_input_rows"] = str(random.randint(100, 50000))
                attrs["spark.streaming.input_rows_per_second"] = str(round(random.uniform(10, 5000), 1))

            resource_attrs = {
                "service.name": service_name,
                "databricks.compute.type": svc_config["compute_type"],
                "cloud.provider": "aws",
                "cloud.region": "us-west-2",
            }
            if svc_config["cluster_id"]:
                resource_attrs["databricks.cluster.id"] = svc_config["cluster_id"]

            spans_data.append((
                uuid.uuid4().hex,           # record_id
                start_time,                  # time
                start_time.date(),           # date
                service_name,                # service_name
                trace_id,                    # trace_id
                span_id,                     # span_id
                None,                        # parent_span_id
                op_name,                     # name
                "SPAN_KIND_INTERNAL",        # kind
                start_ns,                    # start_time_unix_nano
                end_ns,                      # end_time_unix_nano
                json.dumps(attrs),           # attributes (as JSON string)
                status_code,                 # status.code
                status_msg,                  # status.message
                json.dumps(resource_attrs),  # resource.attributes
            ))

print(f"Generated {len(spans_data)} spans")

# COMMAND ----------

# Write spans using SQL INSERT with PARSE_JSON for VARIANT columns
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, TimestampType, LongType, DateType

# Create a simple DataFrame and use SQL to insert with proper VARIANT casting
schema = StructType([
    StructField("record_id", StringType()),
    StructField("time", TimestampType()),
    StructField("date", DateType()),
    StructField("service_name", StringType()),
    StructField("trace_id", StringType()),
    StructField("span_id", StringType()),
    StructField("parent_span_id", StringType()),
    StructField("name", StringType()),
    StructField("kind", StringType()),
    StructField("start_time_unix_nano", LongType()),
    StructField("end_time_unix_nano", LongType()),
    StructField("attributes_json", StringType()),
    StructField("status_code", StringType()),
    StructField("status_message", StringType()),
    StructField("resource_attrs_json", StringType()),
])

spans_df = spark.createDataFrame(spans_data, schema=schema)
spans_df.createOrReplaceTempView("spans_staging")

spark.sql(f"""
    INSERT INTO {CATALOG}.otel_raw.spans (
        record_id, time, date, service_name,
        trace_id, span_id, parent_span_id, name, kind,
        start_time_unix_nano, end_time_unix_nano,
        attributes, status, resource, instrumentation_scope
    )
    SELECT
        record_id, time, date, service_name,
        trace_id, span_id, parent_span_id, name, kind,
        start_time_unix_nano, end_time_unix_nano,
        PARSE_JSON(attributes_json),
        STRUCT(status_message AS message, status_code AS code),
        STRUCT(PARSE_JSON(resource_attrs_json) AS attributes, 0 AS dropped_attributes_count),
        STRUCT('midas' AS name, '1.0.0' AS version, PARSE_JSON('{{}}') AS attributes, 0 AS dropped_attributes_count)
    FROM spans_staging
""")
print(f"Wrote {spans_df.count()} spans to {CATALOG}.otel_raw.spans")

# COMMAND ----------

# --- Generate Logs ---
logs_data = []
for hour_offset in range(NUM_HOURS):
    ts = BASE_TIME + timedelta(hours=hour_offset)
    num_logs = random.randint(10, 50)

    for _ in range(num_logs):
        svc = random.choice(list(SERVICES.keys()))
        log_time = ts + timedelta(minutes=random.randint(0, 59), seconds=random.randint(0, 59))
        log_ns = int(log_time.timestamp() * 1e9)

        sev_roll = random.random()
        if sev_roll < 0.6:
            severity, sev_num = "INFO", "9"
            body = random.choice([
                "Application started successfully",
                "Job completed",
                "Stage completed",
                f"SQL query {random.randint(1,999)} succeeded",
                "Pipeline update started",
            ])
        elif sev_roll < 0.85:
            severity, sev_num = "WARN", "13"
            body = random.choice([
                "Shuffle spill detected: 150MB to disk",
                "GC pause 2.3s on executor 4",
                "Query plan suboptimal: full table scan",
                "Connection pool exhausted",
            ])
        else:
            severity, sev_num = "ERROR", "17"
            body = random.choice(ERROR_MESSAGES)

        attrs = {"service.name": svc}
        resource_attrs = {
            "service.name": svc,
            "databricks.compute.type": SERVICES[svc]["compute_type"],
        }

        logs_data.append((
            uuid.uuid4().hex,
            log_time,
            log_time.date(),
            svc,
            uuid.uuid4().hex[:32] if random.random() < 0.7 else None,
            uuid.uuid4().hex[:16] if random.random() < 0.5 else None,
            log_ns,
            sev_num,
            severity,
            json.dumps(body),
            json.dumps(attrs),
            json.dumps(resource_attrs),
        ))

print(f"Generated {len(logs_data)} logs")

# COMMAND ----------

logs_schema = StructType([
    StructField("record_id", StringType()),
    StructField("time", TimestampType()),
    StructField("date", DateType()),
    StructField("service_name", StringType()),
    StructField("trace_id", StringType()),
    StructField("span_id", StringType()),
    StructField("time_unix_nano", LongType()),
    StructField("severity_number", StringType()),
    StructField("severity_text", StringType()),
    StructField("body_json", StringType()),
    StructField("attributes_json", StringType()),
    StructField("resource_attrs_json", StringType()),
])

logs_df = spark.createDataFrame(logs_data, schema=logs_schema)
logs_df.createOrReplaceTempView("logs_staging")

spark.sql(f"""
    INSERT INTO {CATALOG}.otel_raw.logs (
        record_id, time, date, service_name,
        trace_id, span_id, time_unix_nano,
        severity_number, severity_text,
        body, attributes, resource, instrumentation_scope
    )
    SELECT
        record_id, time, date, service_name,
        trace_id, span_id, time_unix_nano,
        severity_number, severity_text,
        PARSE_JSON(body_json),
        PARSE_JSON(attributes_json),
        STRUCT(PARSE_JSON(resource_attrs_json) AS attributes, 0 AS dropped_attributes_count),
        STRUCT('midas' AS name, '1.0.0' AS version, PARSE_JSON('{{}}') AS attributes, 0 AS dropped_attributes_count)
    FROM logs_staging
""")
print(f"Wrote {logs_df.count()} logs to {CATALOG}.otel_raw.logs")

# COMMAND ----------

# --- Generate Metrics ---
metrics_data = []
for hour_offset in range(NUM_HOURS):
    ts = BASE_TIME + timedelta(hours=hour_offset)
    for minute_offset in range(0, 60, 15):
        metric_time = ts + timedelta(minutes=minute_offset)
        metric_ns = int(metric_time.timestamp() * 1e9)

        for svc_name, svc_config in SERVICES.items():
            resource_attrs = {
                "service.name": svc_name,
                "databricks.compute.type": svc_config["compute_type"],
            }

            if svc_config["cluster_id"]:
                resource_attrs["databricks.cluster.id"] = svc_config["cluster_id"]
                metrics = [
                    ("spark.host.cpu.usage_percent", "gauge", random.uniform(10, 85)),
                    ("spark.host.memory.used_bytes", "gauge", random.uniform(2e9, 14e9)),
                    ("spark.host.disk.read.bytes", "sum", random.uniform(1e6, 1e9)),
                    ("spark.host.network.receive.bytes", "sum", random.uniform(1e6, 1e9)),
                ]
            else:
                metrics = []

            for metric_name, metric_type, value in metrics:
                metrics_data.append((
                    uuid.uuid4().hex,
                    metric_time,
                    metric_time.date(),
                    svc_name,
                    metric_name,
                    metric_type,
                    metric_ns,
                    round(value, 2),
                    json.dumps(resource_attrs),
                ))

print(f"Generated {len(metrics_data)} metrics")

# COMMAND ----------

metrics_schema = StructType([
    StructField("record_id", StringType()),
    StructField("time", TimestampType()),
    StructField("date", DateType()),
    StructField("service_name", StringType()),
    StructField("name", StringType()),
    StructField("metric_type", StringType()),
    StructField("time_unix_nano", LongType()),
    StructField("value", LongType()),  # will cast to double
    StructField("resource_attrs_json", StringType()),
])

from pyspark.sql.types import DoubleType
metrics_schema_fixed = StructType([
    StructField("record_id", StringType()),
    StructField("time", TimestampType()),
    StructField("date", DateType()),
    StructField("service_name", StringType()),
    StructField("name", StringType()),
    StructField("metric_type", StringType()),
    StructField("time_unix_nano", LongType()),
    StructField("value", DoubleType()),
    StructField("resource_attrs_json", StringType()),
])

metrics_df = spark.createDataFrame(metrics_data, schema=metrics_schema_fixed)
metrics_df.createOrReplaceTempView("metrics_staging")

spark.sql(f"""
    INSERT INTO {CATALOG}.otel_raw.metrics (
        record_id, time, date, service_name, name, metric_type, time_unix_nano,
        gauge, resource, instrumentation_scope
    )
    SELECT
        record_id, time, date, service_name, name, metric_type, time_unix_nano,
        CASE WHEN metric_type = 'gauge'
            THEN STRUCT(value AS value, CAST(NULL AS ARRAY<STRUCT<time_unix_nano: LONG, value: DOUBLE, span_id: STRING, trace_id: STRING, filtered_attributes: VARIANT>>) AS exemplars, PARSE_JSON('{{}}') AS attributes, 0 AS flags)
            ELSE NULL
        END AS gauge,
        STRUCT(PARSE_JSON(resource_attrs_json) AS attributes, 0 AS dropped_attributes_count),
        STRUCT('midas' AS name, '1.0.0' AS version, PARSE_JSON('{{}}') AS attributes, 0 AS dropped_attributes_count)
    FROM metrics_staging
""")
print(f"Wrote {metrics_df.count()} metrics to {CATALOG}.otel_raw.metrics")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Verify Bronze Data

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT 'spans' as table_name, count(*) as row_count FROM ${catalog}.otel_raw.spans
# MAGIC UNION ALL
# MAGIC SELECT 'logs', count(*) FROM ${catalog}.otel_raw.logs
# MAGIC UNION ALL
# MAGIC SELECT 'metrics', count(*) FROM ${catalog}.otel_raw.metrics
