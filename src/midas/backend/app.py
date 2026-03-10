import uuid
import logging
from fastapi import Request

from .core import create_app
from .router import router
from .telemetry import trace_span, init_telemetry_tables, _trace_ctx

from .routes import catalog, profiling, metadata, apply, documents, genie

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("midas")

app = create_app(routers=[router])

# Include Midas route routers under /api prefix
app.include_router(catalog.router, prefix="/api")
app.include_router(profiling.router, prefix="/api")
app.include_router(metadata.router, prefix="/api")
app.include_router(apply.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(genie.router, prefix="/api")


@app.on_event("startup")
def startup():
    init_telemetry_tables()


@app.middleware("http")
async def telemetry_middleware(request: Request, call_next):
    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    _trace_ctx.trace_id = uuid.uuid4().hex[:32]
    _trace_ctx.span_id = None

    route = f"{request.method} {request.url.path}"
    with trace_span("http.request", route=route, metadata={"query": str(request.url.query)}):
        response = await call_next(request)
        return response
