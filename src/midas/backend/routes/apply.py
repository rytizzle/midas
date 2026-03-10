import logging
import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from ..config import get_sql_connection
from ..telemetry import trace_span

logger = logging.getLogger("midas.apply")
router = APIRouter(prefix="/apply", tags=["apply"])

_previous_state: dict = {}


def _escape_ident(name: str) -> str:
    return ".".join(f"`{part}`" for part in name.split("."))


def _escape_comment(text: str) -> str:
    return text.replace("\\", "\\\\").replace("'", "\\'")


class ApplyRequest(BaseModel):
    changes: dict
    current_metadata: dict
    warehouse_id: str


class UndoRequest(BaseModel):
    tables: list[str]
    warehouse_id: str


@router.post("/execute")
def apply_changes(req: ApplyRequest):
    global _previous_state
    _previous_state = req.current_metadata

    try:
        with trace_span("sql.connect", route="apply"):
            conn = get_sql_connection(req.warehouse_id)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"SQL connect failed: {e}"})

    results = []
    try:
        with conn.cursor() as cursor:
            for table_fqn, changes in req.changes.items():
                ident = _escape_ident(table_fqn)

                if changes.get("table_comment"):
                    comment = _escape_comment(changes["table_comment"])
                    stmt = f"COMMENT ON TABLE {ident} IS '{comment}'"
                    try:
                        with trace_span("sql.alter_table_comment", route="apply", metadata={"table": table_fqn}):
                            cursor.execute(stmt)
                        results.append({"table": table_fqn, "type": "table_comment", "status": "success"})
                    except Exception as e:
                        results.append({"table": table_fqn, "type": "table_comment", "status": "error", "error": str(e)})

                for col_name, col_data in changes.get("columns", {}).items():
                    desc = col_data.get("description", "")
                    if not desc:
                        continue
                    escaped_desc = _escape_comment(desc)
                    stmt = f"ALTER TABLE {ident} ALTER COLUMN `{col_name}` COMMENT '{escaped_desc}'"
                    try:
                        with trace_span("sql.alter_column_comment", route="apply", metadata={"table": table_fqn, "column": col_name}):
                            cursor.execute(stmt)
                        results.append({"table": table_fqn, "type": "column_comment", "column": col_name, "status": "success"})
                    except Exception as e:
                        results.append({"table": table_fqn, "type": "column_comment", "column": col_name, "status": "error", "error": str(e)})
    finally:
        conn.close()
    return results


@router.post("/undo")
def undo_changes(req: UndoRequest):
    global _previous_state
    if not _previous_state:
        return {"error": "No previous state to restore"}

    conn = get_sql_connection(req.warehouse_id)
    results = []
    try:
        with conn.cursor() as cursor:
            for table_fqn in req.tables:
                prev = _previous_state.get(table_fqn, {})
                ident = _escape_ident(table_fqn)

                prev_comment = prev.get("comment", "")
                escaped = _escape_comment(prev_comment)
                try:
                    cursor.execute(f"ALTER TABLE {ident} SET TBLPROPERTIES ('comment' = '{escaped}')")
                    results.append({"table": table_fqn, "type": "table_comment", "status": "restored"})
                except Exception as e:
                    results.append({"table": table_fqn, "type": "table_comment", "status": "error", "error": str(e)})

                for col_name, col_meta in prev.get("columns", {}).items():
                    prev_desc = col_meta.get("comment", "")
                    escaped_desc = _escape_comment(prev_desc)
                    try:
                        cursor.execute(f"ALTER TABLE {ident} ALTER COLUMN `{col_name}` COMMENT '{escaped_desc}'")
                        results.append({"table": table_fqn, "type": "column_comment", "column": col_name, "status": "restored"})
                    except Exception as e:
                        results.append({"table": table_fqn, "type": "column_comment", "column": col_name, "status": "error", "error": str(e)})
    finally:
        conn.close()

    _previous_state = {}
    return results
