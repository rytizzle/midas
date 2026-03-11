import logging
from fastapi import APIRouter
from pydantic import BaseModel
from ..config import get_sql_connection
from ..telemetry import trace_span

logger = logging.getLogger("midas.profiling")
router = APIRouter(prefix="/profiling", tags=["profiling"])


class ProfileRequest(BaseModel):
    tables: list[str]
    warehouse_id: str


def _escape_ident(name: str) -> str:
    return ".".join(f"`{part}`" for part in name.split("."))


def _profile_table(cursor, table_fqn: str) -> dict:
    ident = _escape_ident(table_fqn)

    with trace_span("sql.count", route="profiling", metadata={"table": table_fqn}):
        cursor.execute(f"SELECT COUNT(*) AS cnt FROM {ident}")
        row_count = cursor.fetchone()[0]

    with trace_span("sql.describe", route="profiling", metadata={"table": table_fqn}):
        cursor.execute(f"DESCRIBE TABLE EXTENDED {ident}")
        describe_rows = cursor.fetchall()

    columns = []
    for row in describe_rows:
        col_name = row[0]
        col_type = row[1]
        if not col_name or not col_name.strip() or col_name.strip().startswith("#"):
            break
        columns.append({"name": col_name.strip(), "type": col_type.strip()})

    if not columns:
        return {"table": table_fqn, "row_count": row_count, "columns": [], "sample_rows": []}

    with trace_span("sql.column_stats", route="profiling", metadata={"table": table_fqn, "col_count": len(columns)}):
        agg_parts = []
        for col in columns:
            cn = f"`{col['name']}`"
            agg_parts.append(f"COUNT(DISTINCT {cn}) AS `distinct_{col['name']}`")
            agg_parts.append(
                f"ROUND(100.0 * SUM(CASE WHEN {cn} IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS `null_pct_{col['name']}`"
            )
        if agg_parts:
            cursor.execute(f"SELECT {', '.join(agg_parts)} FROM {ident}")
            agg_row = cursor.fetchone()
            agg_cols = [d[0] for d in cursor.description]
            agg_dict = dict(zip(agg_cols, agg_row))
        else:
            agg_dict = {}

    with trace_span("sql.sample_values", route="profiling", metadata={"table": table_fqn, "col_count": len(columns)}):
        for col in columns:
            cn = f"`{col['name']}`"
            try:
                cursor.execute(f"SELECT DISTINCT CAST({cn} AS STRING) FROM {ident} WHERE {cn} IS NOT NULL LIMIT 5")
                col["sample_values"] = [r[0] for r in cursor.fetchall()]
            except Exception:
                col["sample_values"] = []
            col["distinct_count"] = agg_dict.get(f"distinct_{col['name']}", 0)
            col["null_pct"] = agg_dict.get(f"null_pct_{col['name']}", 0)

    with trace_span("sql.sample_rows", route="profiling", metadata={"table": table_fqn}):
        cursor.execute(f"SELECT * FROM {ident} LIMIT 10")
        sample_cols = [d[0] for d in cursor.description]
        sample_rows = []
        for row in cursor.fetchall():
            sample_rows.append({
                k: v.isoformat() if hasattr(v, "isoformat") else v
                for k, v in zip(sample_cols, row)
            })

    return {"table": table_fqn, "row_count": row_count, "columns": columns, "sample_rows": sample_rows}


@router.post("/profile")
def profile_tables(req: ProfileRequest):
    with trace_span("sql.connect", route="profiling"):
        conn = get_sql_connection(req.warehouse_id)

    results = {}
    try:
        with conn.cursor() as cursor:
            for table in req.tables:
                try:
                    with trace_span("profile_table", route="profiling", metadata={"table": table}):
                        results[table] = _profile_table(cursor, table)
                except Exception as e:
                    logger.warning(f"Failed to profile {table}: {e}")
                    results[table] = {"table": table, "error": str(e)}
    finally:
        conn.close()
    return results
