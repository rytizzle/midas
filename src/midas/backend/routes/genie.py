import logging
import json
from fastapi import APIRouter
from pydantic import BaseModel
from databricks.sdk import WorkspaceClient
from ..core.dependencies import Dependencies
from ..telemetry import trace_span

logger = logging.getLogger("midas.genie")
router = APIRouter(prefix="/genie", tags=["genie"])

_room_links: dict[str, dict] = {}


@router.get("/rooms")
def list_rooms(user_ws: Dependencies.UserClient):
    with trace_span("sdk.genie.list_spaces", route="genie"):
        resp = user_ws.genie.list_spaces()
        rooms = []
        for s in (resp.spaces or []):
            link = _room_links.get(s.space_id)
            rooms.append({
                "space_id": s.space_id,
                "title": s.title or "Untitled",
                "description": s.description or "",
                "linked": link is not None,
                "catalog": link["catalog"] if link else None,
                "schema": link["schema"] if link else None,
            })
    return rooms


@router.get("/rooms/{space_id}/tables")
def get_room_tables(space_id: str, user_ws: Dependencies.UserClient):
    ws = user_ws

    with trace_span("sdk.genie.get_space", route="genie", metadata={"space_id": space_id}):
        space = ws.genie.get_space(space_id, include_serialized_space=True)

    table_names = []
    if space.serialized_space:
        try:
            parsed = json.loads(space.serialized_space)
            ds = parsed.get("data_sources") or parsed.get("dataSources") or {}
            for tbl in ds.get("tables", []):
                ident = tbl.get("identifier", "")
                if ident:
                    table_names.append(ident)
        except (json.JSONDecodeError, AttributeError):
            pass

    if not table_names:
        link = _room_links.get(space_id)
        if link:
            with trace_span("sdk.tables.list", route="genie", metadata={"catalog": link["catalog"], "schema": link["schema"]}):
                for t in ws.tables.list(catalog_name=link["catalog"], schema_name=link["schema"]):
                    if t.full_name:
                        table_names.append(t.full_name)

    tables = []
    with trace_span("sdk.tables.get_batch", route="genie"):
        for fqn in table_names:
            try:
                t = ws.tables.get(fqn)
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
            except Exception as e:
                logger.warning(f"Could not resolve table {fqn}: {e}")

    return {
        "space_id": space.space_id,
        "title": space.title or "Untitled",
        "description": space.description or "",
        "tables": tables,
    }


class LinkRequest(BaseModel):
    catalog: str
    schema_name: str


@router.post("/rooms/{space_id}/link")
def link_room(space_id: str, req: LinkRequest):
    _room_links[space_id] = {"catalog": req.catalog, "schema": req.schema_name}
    return {"status": "linked", "catalog": req.catalog, "schema": req.schema_name}
