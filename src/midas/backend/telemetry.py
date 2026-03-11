"""
Telemetry module that writes OTel v2 OTLP-format spans and logs to Delta tables
via the Databricks SQL Connector. Replaces the old Lakebase Postgres writer.

Spans and logs are buffered and flushed asynchronously to avoid blocking requests.
"""

import os
import time
import uuid
import json
import logging
import functools
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import Optional

logger = logging.getLogger("midas.telemetry")

# Master toggle — set OTEL_ENABLED=true to enable telemetry, anything else disables it
OTEL_ENABLED = os.environ.get("OTEL_ENABLED", "false").lower() == "true"

# Configuration — set via env vars or defaults
OTEL_CATALOG = os.environ.get("OTEL_CATALOG", "midas_catalog")
OTEL_SCHEMA = os.environ.get("OTEL_SCHEMA", "otel_raw")
OTEL_WAREHOUSE_ID = os.environ.get("OTEL_WAREHOUSE_ID", "")
SERVICE_NAME = os.environ.get("OTEL_SERVICE_NAME", "midas-app")

_executor = ThreadPoolExecutor(max_workers=2)

# Connection management with token refresh
_conn_lock = threading.Lock()
_conn = None
_conn_created_at: float = 0
_CONN_MAX_AGE = 45 * 60  # 45 minutes


def _get_connection():
    """Get or create a SQL connection, refreshing if stale."""
    global _conn, _conn_created_at

    if not OTEL_ENABLED:
        return None

    if _conn is not None and (time.monotonic() - _conn_created_at) < _CONN_MAX_AGE:
        return _conn

    with _conn_lock:
        if _conn is not None and (time.monotonic() - _conn_created_at) < _CONN_MAX_AGE:
            return _conn

        # Close old connection
        if _conn is not None:
            try:
                _conn.close()
            except Exception:
                pass

        try:
            from .config import get_config
            from databricks import sql as dbsql

            if not OTEL_WAREHOUSE_ID:
                logger.warning("OTEL_WAREHOUSE_ID not set — telemetry disabled")
                return None

            cfg = get_config()
            _conn = dbsql.connect(
                server_hostname=cfg.host,
                http_path=f"/sql/1.0/warehouses/{OTEL_WAREHOUSE_ID}",
                credentials_provider=lambda: cfg.authenticate,
            )
            _conn_created_at = time.monotonic()
            logger.info("Telemetry SQL connection established")
            return _conn
        except Exception as e:
            logger.warning(f"Telemetry connection failed: {e}")
            _conn = None
            return None


def _write_span(span: dict):
    """Write a single span to the v2 OTLP spans table."""
    conn = _get_connection()
    if conn is None:
        return

    table = f"{OTEL_CATALOG}.{OTEL_SCHEMA}.spans"
    try:
        cursor = conn.cursor()
        cursor.execute(f"""
            INSERT INTO {table} (
                record_id, time, date, service_name,
                trace_id, span_id, parent_span_id, name, kind,
                start_time_unix_nano, end_time_unix_nano,
                status, attributes, resource, instrumentation_scope
            ) VALUES (
                %(record_id)s, %(time)s, %(date)s, %(service_name)s,
                %(trace_id)s, %(span_id)s, %(parent_span_id)s, %(name)s, %(kind)s,
                %(start_time_unix_nano)s, %(end_time_unix_nano)s,
                PARSE_JSON(%(status_json)s) :: STRUCT<message: STRING, code: STRING>,
                PARSE_JSON(%(attributes)s),
                PARSE_JSON(%(resource_json)s) :: STRUCT<attributes: VARIANT, dropped_attributes_count: INT>,
                PARSE_JSON(%(scope_json)s) :: STRUCT<name: STRING, version: STRING, attributes: VARIANT, dropped_attributes_count: INT>
            )
        """, {
            "record_id": uuid.uuid4().hex,
            "time": span["time"],
            "date": span["date"],
            "service_name": SERVICE_NAME,
            "trace_id": span["trace_id"],
            "span_id": span["span_id"],
            "parent_span_id": span.get("parent_span_id"),
            "name": span["name"],
            "kind": "SPAN_KIND_INTERNAL",
            "start_time_unix_nano": span["start_time_unix_nano"],
            "end_time_unix_nano": span["end_time_unix_nano"],
            "status_json": json.dumps({
                "code": span["status_code"],
                "message": span.get("status_message", ""),
            }),
            "attributes": json.dumps(span.get("attributes", {})),
            "resource_json": json.dumps({
                "attributes": {
                    "service.name": SERVICE_NAME,
                    "deployment.environment": os.environ.get("DATABRICKS_APP_NAME", "local"),
                },
                "dropped_attributes_count": 0,
            }),
            "scope_json": json.dumps({
                "name": "midas",
                "version": "1.0.0",
                "attributes": {},
                "dropped_attributes_count": 0,
            }),
        })
        cursor.close()
    except Exception as e:
        err_lower = str(e).lower()
        if any(kw in err_lower for kw in ("auth", "token", "expired", "credential")):
            logger.warning(f"Telemetry auth error, will refresh: {e}")
            global _conn_created_at
            _conn_created_at = 0
        else:
            logger.warning(f"Failed to write span: {e}")


def _write_log(log_entry: dict):
    """Write a single log record to the v2 OTLP logs table."""
    conn = _get_connection()
    if conn is None:
        return

    table = f"{OTEL_CATALOG}.{OTEL_SCHEMA}.logs"
    try:
        cursor = conn.cursor()
        cursor.execute(f"""
            INSERT INTO {table} (
                record_id, time, date, service_name,
                trace_id, span_id, time_unix_nano,
                severity_number, severity_text,
                body, attributes, resource, instrumentation_scope
            ) VALUES (
                %(record_id)s, %(time)s, %(date)s, %(service_name)s,
                %(trace_id)s, %(span_id)s, %(time_unix_nano)s,
                %(severity_number)s, %(severity_text)s,
                PARSE_JSON(%(body)s), PARSE_JSON(%(attributes)s),
                PARSE_JSON(%(resource_json)s) :: STRUCT<attributes: VARIANT, dropped_attributes_count: INT>,
                PARSE_JSON(%(scope_json)s) :: STRUCT<name: STRING, version: STRING, attributes: VARIANT, dropped_attributes_count: INT>
            )
        """, {
            "record_id": uuid.uuid4().hex,
            "time": log_entry["time"],
            "date": log_entry["date"],
            "service_name": SERVICE_NAME,
            "trace_id": log_entry.get("trace_id"),
            "span_id": log_entry.get("span_id"),
            "time_unix_nano": log_entry["time_unix_nano"],
            "severity_number": log_entry["severity_number"],
            "severity_text": log_entry["severity_text"],
            "body": json.dumps(log_entry["body"]),
            "attributes": json.dumps(log_entry.get("attributes", {})),
            "resource_json": json.dumps({
                "attributes": {
                    "service.name": SERVICE_NAME,
                    "deployment.environment": os.environ.get("DATABRICKS_APP_NAME", "local"),
                },
                "dropped_attributes_count": 0,
            }),
            "scope_json": json.dumps({
                "name": "midas",
                "version": "1.0.0",
                "attributes": {},
                "dropped_attributes_count": 0,
            }),
        })
        cursor.close()
    except Exception as e:
        logger.warning(f"Failed to write log: {e}")


def _write_span_async(span: dict):
    """Submit span write to background thread pool."""
    try:
        _executor.submit(_write_span, span)
    except Exception:
        pass


def _write_log_async(log_entry: dict):
    """Submit log write to background thread pool."""
    try:
        _executor.submit(_write_log, log_entry)
    except Exception:
        pass


# Thread-local trace context
_trace_ctx = threading.local()


def _current_trace_id() -> str:
    return getattr(_trace_ctx, "trace_id", None) or uuid.uuid4().hex[:32]


def _current_parent_id() -> Optional[str]:
    return getattr(_trace_ctx, "span_id", None)


@contextmanager
def trace_span(operation: str, route: str = None, metadata: dict = None):
    """Context manager that records a span in OTel v2 format."""
    if not OTEL_ENABLED:
        yield None
        return

    span_id = uuid.uuid4().hex[:16]
    trace_id = _current_trace_id()
    parent_id = _current_parent_id()

    prev_span = getattr(_trace_ctx, "span_id", None)
    prev_trace = getattr(_trace_ctx, "trace_id", None)
    _trace_ctx.span_id = span_id
    _trace_ctx.trace_id = trace_id

    start_ns = time.time_ns()
    start_ts = datetime.now(timezone.utc)
    status_code = "STATUS_CODE_OK"
    status_message = None

    try:
        yield span_id
    except Exception as e:
        status_code = "STATUS_CODE_ERROR"
        status_message = str(e)[:500]
        raise
    finally:
        end_ns = time.time_ns()
        end_ts = datetime.now(timezone.utc)

        _trace_ctx.span_id = prev_span
        _trace_ctx.trace_id = prev_trace

        attrs = metadata or {}
        if route:
            attrs["midas.route"] = route

        _write_span_async({
            "trace_id": trace_id,
            "span_id": span_id,
            "parent_span_id": parent_id,
            "name": operation,
            "time": start_ts.strftime("%Y-%m-%d %H:%M:%S.%f"),
            "date": start_ts.strftime("%Y-%m-%d"),
            "start_time_unix_nano": start_ns,
            "end_time_unix_nano": end_ns,
            "status_code": status_code,
            "status_message": status_message,
            "attributes": attrs,
        })


def traced(operation: str = None):
    """Decorator for tracing a function."""
    def decorator(fn):
        op_name = operation or f"{fn.__module__}.{fn.__name__}"

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            with trace_span(op_name):
                return fn(*args, **kwargs)

        @functools.wraps(fn)
        async def async_wrapper(*args, **kwargs):
            with trace_span(op_name):
                return await fn(*args, **kwargs)

        import asyncio
        if asyncio.iscoroutinefunction(fn):
            return async_wrapper
        return wrapper
    return decorator


def emit_log(message: str, severity: str = "INFO", attributes: dict = None):
    """Emit a log record in OTel v2 format."""
    if not OTEL_ENABLED:
        return

    now = datetime.now(timezone.utc)
    sev_map = {"DEBUG": "5", "INFO": "9", "WARN": "13", "ERROR": "17", "FATAL": "21"}

    _write_log_async({
        "time": now.strftime("%Y-%m-%d %H:%M:%S.%f"),
        "date": now.strftime("%Y-%m-%d"),
        "time_unix_nano": time.time_ns(),
        "trace_id": getattr(_trace_ctx, "trace_id", None),
        "span_id": getattr(_trace_ctx, "span_id", None),
        "severity_number": sev_map.get(severity, "9"),
        "severity_text": severity,
        "body": message,
        "attributes": attributes or {},
    })


def init_telemetry_tables():
    """Create the v2 OTLP spans and logs tables if they don't exist."""
    if not OTEL_ENABLED:
        logger.info("OTel disabled — skipping table init")
        return False

    conn = _get_connection()
    if conn is None:
        logger.warning("Cannot init telemetry tables — no connection")
        return False

    try:
        cursor = conn.cursor()

        # Create schema
        cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {OTEL_CATALOG}.{OTEL_SCHEMA}")

        # Create spans table (v2 OTLP schema)
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {OTEL_CATALOG}.{OTEL_SCHEMA}.spans (
                record_id STRING,
                time TIMESTAMP,
                date DATE,
                service_name STRING,
                trace_id STRING,
                span_id STRING,
                trace_state STRING,
                parent_span_id STRING,
                flags INT,
                name STRING,
                kind STRING,
                start_time_unix_nano LONG,
                end_time_unix_nano LONG,
                attributes VARIANT,
                dropped_attributes_count INT,
                events ARRAY<STRUCT<
                    time_unix_nano: LONG,
                    name: STRING,
                    attributes: VARIANT,
                    dropped_attributes_count: INT
                >>,
                dropped_events_count INT,
                links ARRAY<STRUCT<
                    trace_id: STRING,
                    span_id: STRING,
                    trace_state: STRING,
                    attributes: VARIANT,
                    dropped_attributes_count: INT,
                    flags: INT
                >>,
                dropped_links_count INT,
                status STRUCT<
                    message: STRING,
                    code: STRING
                >,
                resource STRUCT<
                    attributes: VARIANT,
                    dropped_attributes_count: INT
                >,
                resource_schema_url STRING,
                instrumentation_scope STRUCT<
                    name: STRING,
                    version: STRING,
                    attributes: VARIANT,
                    dropped_attributes_count: INT
                >,
                span_schema_url STRING
            )
            CLUSTER BY (time, service_name, trace_id)
            COMMENT 'OTel v2 OTLP spans from Midas app and Spark compute'
            TBLPROPERTIES ('quality' = 'bronze')
        """)

        # Create logs table (v2 OTLP schema)
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {OTEL_CATALOG}.{OTEL_SCHEMA}.logs (
                record_id STRING,
                time TIMESTAMP,
                date DATE,
                service_name STRING,
                event_name STRING,
                trace_id STRING,
                span_id STRING,
                time_unix_nano LONG,
                observed_time_unix_nano LONG,
                severity_number STRING,
                severity_text STRING,
                body VARIANT,
                attributes VARIANT,
                dropped_attributes_count INT,
                flags INT,
                resource STRUCT<
                    attributes: VARIANT,
                    dropped_attributes_count: INT
                >,
                resource_schema_url STRING,
                instrumentation_scope STRUCT<
                    name: STRING,
                    version: STRING,
                    attributes: VARIANT,
                    dropped_attributes_count: INT
                >,
                log_schema_url STRING
            )
            CLUSTER BY (time, service_name)
            COMMENT 'OTel v2 OTLP logs from Midas app and Spark compute'
            TBLPROPERTIES ('quality' = 'bronze')
        """)

        # Create metrics table (v2 OTLP schema)
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {OTEL_CATALOG}.{OTEL_SCHEMA}.metrics (
                record_id STRING,
                time TIMESTAMP,
                date DATE,
                service_name STRING,
                name STRING,
                description STRING,
                unit STRING,
                metric_type STRING,
                start_time_unix_nano LONG,
                time_unix_nano LONG,
                gauge STRUCT<
                    value: DOUBLE,
                    exemplars: ARRAY<STRUCT<
                        time_unix_nano: LONG,
                        value: DOUBLE,
                        span_id: STRING,
                        trace_id: STRING,
                        filtered_attributes: VARIANT
                    >>,
                    attributes: VARIANT,
                    flags: INT
                >,
                sum STRUCT<
                    value: DOUBLE,
                    exemplars: ARRAY<STRUCT<
                        time_unix_nano: LONG,
                        value: DOUBLE,
                        span_id: STRING,
                        trace_id: STRING,
                        filtered_attributes: VARIANT
                    >>,
                    attributes: VARIANT,
                    flags: INT,
                    aggregation_temporality: STRING,
                    is_monotonic: BOOLEAN
                >,
                histogram STRUCT<
                    count: LONG,
                    sum: DOUBLE,
                    bucket_counts: ARRAY<LONG>,
                    explicit_bounds: ARRAY<DOUBLE>,
                    exemplars: ARRAY<STRUCT<
                        time_unix_nano: LONG,
                        value: DOUBLE,
                        span_id: STRING,
                        trace_id: STRING,
                        filtered_attributes: VARIANT
                    >>,
                    attributes: VARIANT,
                    flags: INT,
                    min: DOUBLE,
                    max: DOUBLE,
                    aggregation_temporality: STRING
                >,
                summary STRUCT<
                    count: LONG,
                    sum: DOUBLE,
                    quantile_values: ARRAY<STRUCT<
                        quantile: DOUBLE,
                        value: DOUBLE
                    >>,
                    attributes: VARIANT,
                    flags: INT
                >,
                metadata VARIANT,
                resource STRUCT<
                    attributes: VARIANT,
                    dropped_attributes_count: INT
                >,
                resource_schema_url STRING,
                instrumentation_scope STRUCT<
                    name: STRING,
                    version: STRING,
                    attributes: VARIANT,
                    dropped_attributes_count: INT
                >,
                metric_schema_url STRING
            )
            CLUSTER BY (time, service_name)
            COMMENT 'OTel v2 OTLP metrics from Spark compute'
            TBLPROPERTIES ('quality' = 'bronze')
        """)

        cursor.close()
        logger.info("Telemetry v2 OTLP tables initialized")
        return True
    except Exception as e:
        logger.warning(f"Failed to init telemetry tables: {e}")
        return False
