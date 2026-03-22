import logging
from .core import create_app
from .router import router

from .routes import catalog, profiling, metadata, apply, documents, genie

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("midas")

# Silence noisy Databricks SQL connector HTTP logs
logging.getLogger("databricks.sql").setLevel(logging.WARNING)

# Include Midas routes on the apx router (which already has prefix="/api")
# so they're registered before the static file mount in create_app
router.include_router(catalog.router)
router.include_router(profiling.router)
router.include_router(metadata.router)
router.include_router(apply.router)
router.include_router(documents.router)
router.include_router(genie.router)

app = create_app(routers=[router])
