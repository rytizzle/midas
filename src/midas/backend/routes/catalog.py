import logging
from fastapi import APIRouter, Query
from pydantic import BaseModel
from databricks.sdk import WorkspaceClient
from ..core.dependencies import Dependencies
from ..config import get_sql_connection
from ..telemetry import trace_span

logger = logging.getLogger("midas.catalog")
router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/me")
def get_current_user(headers: Dependencies.Headers):
    """Return current user info from Databricks Apps headers (no extra OAuth scope needed)."""
    return {"email": headers.user_email or "", "name": headers.user_name or ""}


@router.get("/warehouses")
def list_warehouses(user_ws: Dependencies.UserClient):
    with trace_span("sdk.warehouses.list", route="catalog"):
        warehouses = []
        for wh in user_ws.warehouses.list():
            warehouses.append({
                "id": wh.id,
                "name": wh.name,
                "state": wh.state.value if wh.state else "UNKNOWN",
                "size": wh.cluster_size or "",
            })
    return warehouses


@router.get("/catalogs")
def list_catalogs(user_ws: Dependencies.UserClient):
    with trace_span("sdk.catalogs.list", route="catalog"):
        catalogs = []
        for c in user_ws.catalogs.list():
            if c.name and not c.name.startswith("__"):
                catalogs.append({"name": c.name, "comment": c.comment or ""})
    return catalogs


@router.get("/schemas")
def list_schemas(user_ws: Dependencies.UserClient, catalog: str = Query(...)):
    with trace_span("sdk.schemas.list", route="catalog", metadata={"catalog": catalog}):
        schemas = []
        for s in user_ws.schemas.list(catalog_name=catalog):
            if s.name and s.name not in ("information_schema",):
                schemas.append({"name": s.name, "comment": s.comment or ""})
    return schemas


@router.get("/tables")
def list_tables(user_ws: Dependencies.UserClient, catalog: str = Query(...), schema: str = Query(...)):
    with trace_span("sdk.tables.list", route="catalog", metadata={"catalog": catalog, "schema": schema}):
        tables = []
        for t in user_ws.tables.list(catalog_name=catalog, schema_name=schema):
            columns = []
            if t.columns:
                for col in t.columns:
                    columns.append({
                        "name": col.name,
                        "type": col.type_text or str(col.type_name or ""),
                        "comment": col.comment or "",
                    })
            tables.append({
                "name": t.name,
                "full_name": t.full_name,
                "table_type": (t.table_type.value if t.table_type else "TABLE"),
                "comment": t.comment or "",
                "columns": columns,
                "column_count": len(columns),
            })
    return tables


class PermissionCheckRequest(BaseModel):
    tables: list[str]
    warehouse_id: str


@router.post("/check-permissions")
def check_permissions(req: PermissionCheckRequest):
    results = {}
    with trace_span("sql.check_permissions", route="catalog"):
        conn = get_sql_connection(req.warehouse_id)
        try:
            cursor = conn.cursor()
            for fqn in req.tables:
                try:
                    cursor.execute(f"SHOW GRANTS ON TABLE {fqn}")
                    grants = cursor.fetchall()
                    has_modify = any(
                        "MODIFY" in str(row) or "ALL_PRIVILEGES" in str(row) or "ALL PRIVILEGES" in str(row)
                        for row in grants
                    )
                    results[fqn] = {"can_modify": has_modify}
                except Exception as e:
                    results[fqn] = {"can_modify": False, "error": str(e)}
            cursor.close()
        finally:
            conn.close()
    return results
