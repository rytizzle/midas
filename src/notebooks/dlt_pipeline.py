# Databricks notebook source
# MAGIC %md
# MAGIC # OTel v2 Observability Pipeline
# MAGIC
# MAGIC **Bronze** (raw OTel v2 OTLP) -> **Silver** (cleaned, parsed) -> **Gold** (analytics-ready for Genie)
# MAGIC
# MAGIC Adapted for the v2 OTLP schema with VARIANT attributes and nested STRUCTs.

# COMMAND ----------

import dlt
from pyspark.sql import functions as F

SOURCE_CATALOG = spark.conf.get("otel.source.catalog", "midas_catalog")
SOURCE_SCHEMA = spark.conf.get("otel.source.schema", "otel_raw")

# =============================================================================
# SILVER LAYER
# =============================================================================

@dlt.table(
    name="silver_spans",
    comment="Cleaned OTel v2 spans with extracted attributes and compute context",
    table_properties={"quality": "silver"},
)
@dlt.expect_or_drop("valid_trace_id", "trace_id IS NOT NULL")
def silver_spans():
    return (
        spark.read.table(f"{SOURCE_CATALOG}.{SOURCE_SCHEMA}.spans")
        # Duration in ms from nanoseconds
        .withColumn("duration_ms", F.round((F.col("end_time_unix_nano") - F.col("start_time_unix_nano")) / 1e6, 2))
        # Status fields
        .withColumn("is_error", F.col("status.code") == "STATUS_CODE_ERROR")
        .withColumn("status_code", F.col("status.code"))
        .withColumn("status_message", F.col("status.message"))
        # Operation categories
        .withColumn("operation_category", F.split(F.col("name"), "\\.").getItem(0))
        .withColumn("operation_detail", F.expr("""
            CASE
                WHEN name LIKE 'http.%' THEN attributes:['http.route']::STRING
                WHEN name LIKE 'sql.%' THEN attributes:['db.table']::STRING
                WHEN name LIKE 'llm.%' THEN attributes:['llm.model']::STRING
                WHEN name LIKE 'sdp.flow.%' THEN attributes:['sdp.flow.name']::STRING
                WHEN name LIKE 'streaming.%' THEN attributes:['spark.streaming.query.name']::STRING
                ELSE NULL
            END
        """))
        # Resource attributes (from nested STRUCT with VARIANT)
        .withColumn("compute_type", F.expr("resource.attributes:['databricks.compute.type']::STRING"))
        .withColumn("cluster_id", F.expr("resource.attributes:['databricks.cluster.id']::STRING"))
        .withColumn("cloud_region", F.expr("resource.attributes:['cloud.region']::STRING"))
        # Spark-specific from attributes VARIANT
        .withColumn("output_rows", F.expr("attributes:['spark.plan.statistics.output_rows']::LONG"))
        .withColumn("output_bytes", F.expr("attributes:['spark.plan.statistics.output_bytes']::LONG"))
        .withColumn("shuffle_read_bytes", F.expr("attributes:['spark.stage.shuffle.read.bytes']::LONG"))
        .withColumn("shuffle_write_bytes", F.expr("attributes:['spark.stage.shuffle.write.bytes']::LONG"))
        .withColumn("disk_spill_bytes", F.expr("attributes:['spark.stage.disk_bytes_spilled']::LONG"))
        # SDP-specific
        .withColumn("sdp_pipeline_name", F.expr("attributes:['sdp.pipeline.name']::STRING"))
        .withColumn("sdp_flow_name", F.expr("attributes:['sdp.flow.name']::STRING"))
        .withColumn("sdp_flow_output_rows", F.expr("attributes:['sdp.flow.output_rows']::LONG"))
        # Streaming-specific
        .withColumn("streaming_input_rows", F.expr("attributes:['spark.streaming.num_input_rows']::LONG"))
        .withColumn("streaming_input_rate", F.expr("attributes:['spark.streaming.input_rows_per_second']::DOUBLE"))
        # LLM-specific
        .withColumn("llm_model", F.expr("attributes:['llm.model']::STRING"))
        .withColumn("llm_col_count", F.expr("attributes:['llm.request.col_count']::INT"))
        # Time dimensions
        .withColumn("hour", F.date_trunc("hour", F.col("time")))
    )


@dlt.table(
    name="silver_logs",
    comment="Cleaned OTel v2 logs with parsed severity and error classification",
    table_properties={"quality": "silver"},
)
@dlt.expect_or_drop("valid_time", "time IS NOT NULL")
def silver_logs():
    return (
        spark.read.table(f"{SOURCE_CATALOG}.{SOURCE_SCHEMA}.logs")
        .withColumn("body_text", F.expr("body::STRING"))
        .withColumn("is_error", F.col("severity_text").isin("ERROR", "FATAL"))
        .withColumn("is_warning", F.col("severity_text") == "WARN")
        .withColumn("error_type", F.when(
            F.col("severity_text") == "ERROR",
            F.split(F.expr("body::STRING"), ":").getItem(0)
        ))
        .withColumn("compute_type", F.expr("resource.attributes:['databricks.compute.type']::STRING"))
        .withColumn("hour", F.date_trunc("hour", F.col("time")))
    )


@dlt.table(
    name="silver_metrics",
    comment="Cleaned OTel v2 metrics with extracted gauge/sum values",
    table_properties={"quality": "silver"},
)
@dlt.expect_or_drop("valid_time", "time IS NOT NULL")
@dlt.expect_or_drop("valid_metric", "name IS NOT NULL")
def silver_metrics():
    return (
        spark.read.table(f"{SOURCE_CATALOG}.{SOURCE_SCHEMA}.metrics")
        # Extract the value from the appropriate metric type struct
        .withColumn("value", F.coalesce(
            F.col("gauge.value"),
            F.col("sum.value"),
        ))
        .withColumn("cluster_id", F.expr("resource.attributes:['databricks.cluster.id']::STRING"))
        .withColumn("compute_type", F.expr("resource.attributes:['databricks.compute.type']::STRING"))
        .withColumn("metric_category", F.split(F.col("name"), "\\.").getItem(1))
        .withColumn("hour", F.date_trunc("hour", F.col("time")))
    )


# =============================================================================
# GOLD LAYER
# =============================================================================

@dlt.table(
    name="gold_service_health",
    comment="Hourly service health: request volume, error rate, and latency percentiles per service. Use this to understand how each application or pipeline is performing over time.",
    table_properties={"quality": "gold"},
)
def gold_service_health():
    return (
        dlt.read("silver_spans")
        .groupBy("service_name", "hour", "date", "compute_type")
        .agg(
            F.count("*").alias("request_count"),
            F.sum(F.when(F.col("is_error"), 1).otherwise(0)).alias("error_count"),
            F.round(100.0 * F.sum(F.when(F.col("is_error"), 1).otherwise(0)) / F.count("*"), 2).alias("error_rate_pct"),
            F.round(F.avg("duration_ms"), 1).alias("avg_latency_ms"),
            F.round(F.percentile_approx("duration_ms", 0.5), 1).alias("p50_latency_ms"),
            F.round(F.percentile_approx("duration_ms", 0.95), 1).alias("p95_latency_ms"),
            F.round(F.percentile_approx("duration_ms", 0.99), 1).alias("p99_latency_ms"),
            F.round(F.max("duration_ms"), 1).alias("max_latency_ms"),
        )
    )


@dlt.table(
    name="gold_operation_performance",
    comment="Latency and throughput statistics per operation per service. Use this to find the slowest operations and identify bottlenecks.",
    table_properties={"quality": "gold"},
)
def gold_operation_performance():
    return (
        dlt.read("silver_spans")
        .groupBy("service_name", "name", "operation_category", "date")
        .agg(
            F.count("*").alias("call_count"),
            F.sum(F.when(F.col("is_error"), 1).otherwise(0)).alias("error_count"),
            F.round(F.avg("duration_ms"), 1).alias("avg_ms"),
            F.round(F.percentile_approx("duration_ms", 0.5), 1).alias("p50_ms"),
            F.round(F.percentile_approx("duration_ms", 0.95), 1).alias("p95_ms"),
            F.round(F.max("duration_ms"), 1).alias("max_ms"),
            F.sum("output_rows").alias("total_output_rows"),
        )
    )


@dlt.table(
    name="gold_error_analysis",
    comment="Error trends by service, operation, and error type. Use this to investigate what is failing and how often.",
    table_properties={"quality": "gold"},
)
def gold_error_analysis():
    return (
        dlt.read("silver_spans")
        .filter(F.col("is_error"))
        .groupBy("service_name", "name", "status_message", "date")
        .agg(
            F.count("*").alias("error_count"),
            F.round(F.avg("duration_ms"), 1).alias("avg_duration_ms"),
            F.min("time").alias("first_seen"),
            F.max("time").alias("last_seen"),
        )
    )


@dlt.table(
    name="gold_cluster_resources",
    comment="Hourly CPU, memory, disk, and network utilization per cluster. Use for capacity planning.",
    table_properties={"quality": "gold"},
)
def gold_cluster_resources():
    return (
        dlt.read("silver_metrics")
        .filter(F.col("name").startswith("spark.host."))
        .groupBy("service_name", "cluster_id", "hour", "date")
        .agg(
            F.round(F.avg(F.when(F.col("name") == "spark.host.cpu.usage_percent", F.col("value"))), 1).alias("avg_cpu_pct"),
            F.round(F.max(F.when(F.col("name") == "spark.host.cpu.usage_percent", F.col("value"))), 1).alias("max_cpu_pct"),
            F.round(F.avg(F.when(F.col("name") == "spark.host.memory.used_bytes", F.col("value") / 1e9)), 2).alias("avg_memory_used_gb"),
            F.round(F.sum(F.when(F.col("name") == "spark.host.disk.read.bytes", F.col("value") / 1e6)), 1).alias("disk_read_mb"),
            F.round(F.sum(F.when(F.col("name") == "spark.host.network.receive.bytes", F.col("value") / 1e6)), 1).alias("network_rx_mb"),
        )
    )


@dlt.table(
    name="gold_log_severity_trends",
    comment="Hourly log volume by severity and service. Use this to spot spikes in errors or warnings.",
    table_properties={"quality": "gold"},
)
def gold_log_severity_trends():
    return (
        dlt.read("silver_logs")
        .groupBy("service_name", "severity_text", "hour", "date")
        .agg(
            F.count("*").alias("log_count"),
            F.count_distinct("trace_id").alias("unique_traces"),
        )
    )


@dlt.table(
    name="gold_top_errors",
    comment="Most frequent error types across all services. Use this to prioritize which errors to fix first.",
    table_properties={"quality": "gold"},
)
def gold_top_errors():
    return (
        dlt.read("silver_logs")
        .filter(F.col("is_error"))
        .groupBy("service_name", "error_type", "body_text")
        .agg(
            F.count("*").alias("occurrence_count"),
            F.min("time").alias("first_seen"),
            F.max("time").alias("last_seen"),
            F.count_distinct("date").alias("days_active"),
        )
    )


@dlt.table(
    name="gold_llm_usage",
    comment="LLM/Foundation Model API usage: call volume, latency, and table context. Use this to understand AI costs and performance.",
    table_properties={"quality": "gold"},
)
def gold_llm_usage():
    return (
        dlt.read("silver_spans")
        .filter(F.col("name") == "llm.generate")
        .groupBy("service_name", "llm_model", "date")
        .agg(
            F.count("*").alias("call_count"),
            F.round(F.avg("duration_ms") / 1000, 1).alias("avg_duration_seconds"),
            F.round(F.percentile_approx("duration_ms", 0.95) / 1000, 1).alias("p95_duration_seconds"),
            F.round(F.max("duration_ms") / 1000, 1).alias("max_duration_seconds"),
            F.round(F.avg("llm_col_count"), 0).alias("avg_columns_per_call"),
            F.sum(F.when(F.col("is_error"), 1).otherwise(0)).alias("failed_calls"),
        )
    )
