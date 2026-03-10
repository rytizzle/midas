"""Databricks SDK config and SQL warehouse connection for Midas."""

import os
import logging
from databricks.sdk.core import Config
from databricks.sdk import WorkspaceClient
from databricks import sql

logger = logging.getLogger("midas.config")

_cfg = None
_warehouse_id = None


def get_config() -> Config:
    global _cfg
    if _cfg is None:
        _cfg = Config()
    return _cfg


def _resolve_warehouse_id() -> str:
    global _warehouse_id
    if _warehouse_id is None:
        cfg = get_config()
        ws = WorkspaceClient(config=cfg)
        for wh in ws.warehouses.list():
            _warehouse_id = wh.id
            break
        if not _warehouse_id:
            raise RuntimeError("No SQL warehouse found in workspace")
    return _warehouse_id


def get_sql_connection():
    cfg = get_config()
    wh_id = _resolve_warehouse_id()
    return sql.connect(
        server_hostname=cfg.host,
        http_path=f"/sql/1.0/warehouses/{wh_id}",
        credentials_provider=lambda: cfg.authenticate,
    )
