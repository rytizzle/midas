#!/bin/bash
set -e

PROFILE="${1:-midas}"
SOURCE_PATH="/Workspace/Users/ryan.tom@databricks.com/.bundle/midas/dev/files/.build"

echo "==> Building..."
apx build

echo "==> Deploying bundle..."
databricks bundle deploy -p "$PROFILE"

echo "==> Setting OBO scopes and resources..."
databricks api patch /api/2.0/apps/midas -p "$PROFILE" --json '{
  "user_api_scopes": [
    "sql",
    "dashboards.genie",
    "catalog.catalogs:read",
    "catalog.schemas:read",
    "catalog.tables:read"
  ],
  "resources": [
    {"name": "sql-warehouse", "sql_warehouse": {"id": "a6505a9626cf9ca7", "permission": "CAN_USE"}},
    {"name": "serving-endpoint", "serving_endpoint": {"name": "databricks-claude-sonnet-4-5", "permission": "CAN_QUERY"}}
  ]
}'

echo "==> Deploying app code..."
databricks apps deploy midas --source-code-path "$SOURCE_PATH" -p "$PROFILE"

echo "==> Done!"
