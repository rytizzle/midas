import logging
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from ..config import get_user_sql_connection
from ..core.dependencies import Dependencies
from ..telemetry import trace_span

logger = logging.getLogger("midas.apply")
router = APIRouter(prefix="/apply", tags=["apply"])

def _escape_ident(name: str) -> str:
    return ".".join(f"`{part}`" for part in name.split("."))


def _escape_comment(text: str) -> str:
    return text.replace("\\", "\\\\").replace("'", "\\'")


def _is_view(table_type: str) -> bool:
    """Check if the entity is a view or materialized view (not a regular table)."""
    t = table_type.upper()
    return "VIEW" in t



class ApplyRequest(BaseModel):
    changes: dict
    current_metadata: dict
    warehouse_id: str


class UndoRequest(BaseModel):
    previous_state: dict
    warehouse_id: str


@router.post("/execute")
def apply_changes(req: ApplyRequest, headers: Dependencies.Headers):
    if not headers.token:
        return JSONResponse(status_code=401, content={"error": "No user token available"})

    try:
        with trace_span("sql.connect", route="apply"):
            conn = get_user_sql_connection(req.warehouse_id, headers.token.get_secret_value())
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"SQL connect failed: {e}"})

    results = []
    try:
        with conn.cursor() as cursor:
            for table_fqn, changes in req.changes.items():
                ident = _escape_ident(table_fqn)
                table_type = changes.get("table_type", "TABLE")
                kind = "VIEW" if _is_view(table_type) else "TABLE"
                logger.info(f"Applying to {table_fqn}: table_type={table_type}, kind={kind}")

                if changes.get("table_comment"):
                    comment = _escape_comment(changes["table_comment"])
                    stmt = f"COMMENT ON {kind} {ident} IS '{comment}'"
                    try:
                        with trace_span("sql.alter_table_comment", route="apply", metadata={"table": table_fqn, "kind": kind}):
                            cursor.execute(stmt)
                        results.append({"table": table_fqn, "type": "table_comment", "status": "success"})
                    except Exception as e:
                        results.append({"table": table_fqn, "type": "table_comment", "status": "error", "error": str(e)})

                for col_name, col_data in changes.get("columns", {}).items():
                    desc = col_data.get("description", "")
                    if not desc:
                        continue
                    escaped_desc = _escape_comment(desc)
                    if kind == "VIEW":
                        stmt = f"COMMENT ON COLUMN {ident}.`{col_name}` IS '{escaped_desc}'"
                    else:
                        stmt = f"ALTER TABLE {ident} ALTER COLUMN `{col_name}` COMMENT '{escaped_desc}'"
                    try:
                        with trace_span("sql.alter_column_comment", route="apply", metadata={"table": table_fqn, "column": col_name, "kind": kind}):
                            cursor.execute(stmt)
                        results.append({"table": table_fqn, "type": "column_comment", "column": col_name, "status": "success"})
                    except Exception as e:
                        results.append({"table": table_fqn, "type": "column_comment", "column": col_name, "status": "error", "error": str(e)})
    finally:
        conn.close()
    return results


@router.post("/undo")
def undo_changes(req: UndoRequest, headers: Dependencies.Headers):
    if not req.previous_state:
        return {"error": "No previous state to restore"}

    if not headers.token:
        return JSONResponse(status_code=401, content={"error": "No user token available"})

    conn = get_user_sql_connection(req.warehouse_id, headers.token.get_secret_value())
    results = []
    try:
        with conn.cursor() as cursor:
            for table_fqn, prev in req.previous_state.items():
                ident = _escape_ident(table_fqn)
                table_type = prev.get("table_type", "TABLE")
                kind = "VIEW" if _is_view(table_type) else "TABLE"

                prev_comment = prev.get("comment", "")
                escaped = _escape_comment(prev_comment)
                try:
                    cursor.execute(f"COMMENT ON {kind} {ident} IS '{escaped}'")
                    results.append({"table": table_fqn, "type": "table_comment", "status": "restored"})
                except Exception as e:
                    results.append({"table": table_fqn, "type": "table_comment", "status": "error", "error": str(e)})

                for col_name, col_meta in prev.get("columns", {}).items():
                    prev_desc = col_meta.get("comment", "")
                    escaped_desc = _escape_comment(prev_desc)
                    if kind == "VIEW":
                        stmt = f"COMMENT ON COLUMN {ident}.`{col_name}` IS '{escaped_desc}'"
                    else:
                        stmt = f"ALTER TABLE {ident} ALTER COLUMN `{col_name}` COMMENT '{escaped_desc}'"
                    try:
                        cursor.execute(stmt)
                        results.append({"table": table_fqn, "type": "column_comment", "column": col_name, "status": "restored"})
                    except Exception as e:
                        results.append({"table": table_fqn, "type": "column_comment", "column": col_name, "status": "error", "error": str(e)})
    finally:
        conn.close()

    return results
