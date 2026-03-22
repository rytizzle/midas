"""Databricks SDK config and SQL warehouse connection for Midas."""

import os
import logging
from databricks.sdk.core import Config
from databricks import sql

logger = logging.getLogger("midas.config")

_cfg = None


def get_config() -> Config:
    global _cfg
    if _cfg is None:
        profile = os.environ.get("DATABRICKS_CONFIG_PROFILE")
        _cfg = Config(profile=profile) if profile else Config()
    return _cfg


def get_sql_connection(warehouse_id: str):
    """Create a SQL connection using the app SP credentials."""
    cfg = get_config()
    return sql.connect(
        server_hostname=cfg.host.replace("https://", ""),
        http_path=f"/sql/1.0/warehouses/{warehouse_id}",
        credentials_provider=lambda: cfg.authenticate,
    )


def get_user_sql_connection(warehouse_id: str, access_token: str):
    """Create a SQL connection using the user's OBO token."""
    cfg = get_config()
    return sql.connect(
        server_hostname=cfg.host.replace("https://", ""),
        http_path=f"/sql/1.0/warehouses/{warehouse_id}",
        access_token=access_token,
    )
