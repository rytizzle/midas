import logging
import traceback
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from ..llm import generate_table_metadata

logger = logging.getLogger("midas.metadata")
router = APIRouter(prefix="/metadata", tags=["metadata"])


class GenerateRequest(BaseModel):
    tables: dict
    context: dict


@router.post("/generate")
def generate_metadata(req: GenerateRequest):
    try:
        user_context = req.context.get("blurb", "")
        if req.context.get("docs"):
            user_context += f"\n\nAdditional docs: {req.context['docs']}"
        table_template = req.context.get("tableTemplate", "")
        column_template = req.context.get("columnTemplate", "")

        results = {}
        for table_fqn, profile in req.tables.items():
            result = generate_table_metadata(
                table_name=table_fqn,
                columns=profile.get("columns", []),
                sample_rows=profile.get("sample_rows", []),
                column_stats=profile.get("columns", []),
                row_count=profile.get("row_count", 0),
                user_context=user_context,
                table_template=table_template,
                column_template=column_template,
            )
            results[table_fqn] = result
        return results
    except Exception as e:
        logger.error(f"Metadata generation failed: {e}\n{traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": str(e)})
