import logging
from fastapi import APIRouter
from pydantic import BaseModel
from ..config import get_user_sql_connection
from ..core.dependencies import Dependencies
from ..telemetry import trace_span

logger = logging.getLogger("midas.profiling")
router = APIRouter(prefix="/profiling", tags=["profiling"])


class ProfileRequest(BaseModel):
    tables: list[str]
    warehouse_id: str


def _escape_ident(name: str) -> str:
    return ".".join(f"`{part}`" for part in name.split("."))


def _run_sql(cursor, sql: str, warehouse_id: str):
    """Execute SQL and log the query + warehouse."""
    logger.info(f"[warehouse={warehouse_id}] {sql}")
    cursor.execute(sql)


def _profile_table(cursor, table_fqn: str, warehouse_id: str) -> dict:
    """Profile a table in 3 queries regardless of column count.

    Query 1: DESCRIBE TABLE — schema + row count via COUNT(*)
    Query 2: Combined stats — distinct counts, null %, and sample values per column (single scan)
    Query 3: Sample rows — SELECT * LIMIT 10
    """
    ident = _escape_ident(table_fqn)

    # Query 1: schema
    with trace_span("sql.describe", route="profiling", metadata={"table": table_fqn}):
        _run_sql(cursor, f"DESCRIBE TABLE EXTENDED {ident}", warehouse_id)
        describe_rows = cursor.fetchall()

    columns = []
    for row in describe_rows:
        col_name = row[0]
        col_type = row[1]
        if not col_name or not col_name.strip() or col_name.strip().startswith("#"):
            break
        columns.append({"name": col_name.strip(), "type": col_type.strip()})

    if not columns:
        return {"table": table_fqn, "row_count": 0, "columns": [], "sample_rows": []}

    # Query 2: count + distinct + null% + sample values — single table scan
    with trace_span("sql.combined_stats", route="profiling", metadata={"table": table_fqn, "col_count": len(columns)}):
        parts = ["COUNT(*) AS `_row_count`"]
        for col in columns:
            cn = f"`{col['name']}`"
            safe = col["name"]
            parts.append(f"COUNT(DISTINCT {cn}) AS `distinct_{safe}`")
            parts.append(
                f"ROUND(100.0 * SUM(CASE WHEN {cn} IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS `null_pct_{safe}`"
            )
            parts.append(
                f"SLICE(COLLECT_SET(CAST({cn} AS STRING)), 1, 5) AS `sample_{safe}`"
            )
        sql_stmt = f"SELECT {', '.join(parts)} FROM {ident}"
        _run_sql(cursor, sql_stmt, warehouse_id)
        row = cursor.fetchone()
        cols = [d[0] for d in cursor.description]
        stats = dict(zip(cols, row))

    row_count = stats.get("_row_count", 0)
    for col in columns:
        safe = col["name"]
        col["distinct_count"] = stats.get(f"distinct_{safe}", 0)
        col["null_pct"] = stats.get(f"null_pct_{safe}", 0)
        raw_samples = stats.get(f"sample_{safe}")
        col["sample_values"] = [str(v) for v in raw_samples] if raw_samples is not None and len(raw_samples) > 0 else []

    # Query 3: sample rows
    with trace_span("sql.sample_rows", route="profiling", metadata={"table": table_fqn}):
        _run_sql(cursor, f"SELECT * FROM {ident} LIMIT 10", warehouse_id)
        sample_cols = [d[0] for d in cursor.description]
        sample_rows = []
        for r in cursor.fetchall():
            sample_rows.append({
                k: v.isoformat() if hasattr(v, "isoformat") else v
                for k, v in zip(sample_cols, r)
            })

    return {"table": table_fqn, "row_count": row_count, "columns": columns, "sample_rows": sample_rows}


@router.post("/profile")
def profile_tables(req: ProfileRequest, headers: Dependencies.Headers):
    from fastapi.responses import JSONResponse

    if not headers.token:
        return JSONResponse(status_code=401, content={"error": "No user token available"})

    logger.info(f"Profiling {len(req.tables)} table(s) on warehouse={req.warehouse_id} as user={headers.user_email}")
    try:
        with trace_span("sql.connect", route="profiling"):
            conn = get_user_sql_connection(req.warehouse_id, headers.token.get_secret_value())
    except Exception as e:
        logger.error(f"Failed to connect to warehouse {req.warehouse_id}: {e}")
        return JSONResponse(
            status_code=400,
            content={"error": f"Could not connect to warehouse: {e}"},
        )

    results = {}
    try:
        with conn.cursor() as cursor:
            for table in req.tables:
                try:
                    with trace_span("profile_table", route="profiling", metadata={"table": table}):
                        results[table] = _profile_table(cursor, table, req.warehouse_id)
                except Exception as e:
                    logger.warning(f"Failed to profile {table}: {e}")
                    results[table] = {"table": table, "error": str(e)}
    finally:
        conn.close()
    return results
