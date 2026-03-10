#!/bin/bash
set -e

PROFILE="${1:-midas}"
CATALOG="${2:-midas_catalog}"
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

echo "==> Granting app SP permissions on OTel schemas..."
SP_CLIENT_ID=$(databricks api get /api/2.0/apps/midas -p "$PROFILE" | python3 -c "import sys,json; print(json.load(sys.stdin)['service_principal_client_id'])")
echo "    SP Client ID: $SP_CLIENT_ID"
databricks api post /api/2.0/sql/statements -p "$PROFILE" --json "{
  \"warehouse_id\": \"a6505a9626cf9ca7\",
  \"statement\": \"GRANT ALL PRIVILEGES ON SCHEMA ${CATALOG}.otel_raw TO \`${SP_CLIENT_ID}\`; GRANT ALL PRIVILEGES ON SCHEMA ${CATALOG}.otel_observability TO \`${SP_CLIENT_ID}\`\"
}"

echo "==> Deploying app code..."
databricks apps deploy midas --source-code-path "$SOURCE_PATH" -p "$PROFILE"

echo "==> Done!"
