#!/bin/bash
set -e

# ──────────────────────────────────────────────────────────────
# Midas Deploy Script
#
# Usage:
#   ./deploy.sh              # deploy the default target (dev)
#   ./deploy.sh prod         # deploy a specific target
#
# All config lives in databricks.yml under targets.
# ──────────────────────────────────────────────────────────────

TARGET="${1:-dev}"

# Read variables from the DAB target
get_var() {
    databricks bundle validate -t "$TARGET" --output json 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['variables']['$1']['value'])"
}

PROFILE=$(databricks bundle validate -t "$TARGET" --output json 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['workspace']['profile'])")
CATALOG=$(get_var catalog)
WAREHOUSE_ID=$(get_var warehouse_id)
SERVING_ENDPOINT=$(get_var serving_endpoint)
OTEL_ENABLED=$(get_var otel_enabled)
OTEL_CATALOG=$(get_var otel_catalog)
OTEL_RAW_SCHEMA=$(get_var otel_raw_schema)
OTEL_OBSERVABILITY_SCHEMA=$(get_var otel_observability_schema)
APP_NAME="midas"

DEPLOYER_EMAIL=$(databricks current-user me -p "$PROFILE" --output json \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['userName'])")
SOURCE_PATH="/Workspace/Users/${DEPLOYER_EMAIL}/.bundle/midas/${TARGET}/files/.build"

echo "==> Deploy target: $TARGET"
echo "    Profile:              $PROFILE"
echo "    Deployer:             $DEPLOYER_EMAIL"
echo "    Catalog:              $CATALOG"
echo "    Warehouse:            $WAREHOUSE_ID"
echo "    Serving Endpoint:     $SERVING_ENDPOINT"
echo "    OTel Enabled:         $OTEL_ENABLED"
echo "    OTel Catalog:         $OTEL_CATALOG"
echo "    OTel Raw Schema:      $OTEL_RAW_SCHEMA"
echo "    OTel Silver/Gold:     $OTEL_OBSERVABILITY_SCHEMA"
echo ""

# ── Inject runtime config into app.yml ──
cat > "$(dirname "$0")/app.yml" <<EOF
command: ["uvicorn", "midas.backend.app:app", "--workers", "2"]

env:
  - name: OTEL_ENABLED
    value: "${OTEL_ENABLED}"
  - name: OTEL_CATALOG
    value: "${OTEL_CATALOG}"
  - name: OTEL_SCHEMA
    value: "${OTEL_RAW_SCHEMA}"
  - name: OTEL_SERVICE_NAME
    value: "${APP_NAME}"
EOF

echo "==> Building..."
apx build

echo "==> Deploying bundle..."
databricks bundle deploy -t "$TARGET"

echo "==> Setting OBO scopes and resources..."
databricks api patch "/api/2.0/apps/${APP_NAME}" -p "$PROFILE" --json "{
  \"user_api_scopes\": [
    \"sql\",
    \"dashboards.genie\",
    \"catalog.catalogs:read\",
    \"catalog.schemas:read\",
    \"catalog.tables:read\"
  ],
  \"resources\": [
    {\"name\": \"sql-warehouse\", \"sql_warehouse\": {\"id\": \"${WAREHOUSE_ID}\", \"permission\": \"CAN_USE\"}},
    {\"name\": \"serving-endpoint\", \"serving_endpoint\": {\"name\": \"${SERVING_ENDPOINT}\", \"permission\": \"CAN_QUERY\"}}
  ]
}"

if [ "$OTEL_ENABLED" = "true" ]; then
    echo "==> Granting app SP permissions on OTel schemas..."
    SP_CLIENT_ID=$(databricks api get "/api/2.0/apps/${APP_NAME}" -p "$PROFILE" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['service_principal_client_id'])")
    echo "    SP Client ID: $SP_CLIENT_ID"
    run_sql() {
        local SQL_JSON
        SQL_JSON=$(python3 -c "import json; print(json.dumps({'warehouse_id': '${WAREHOUSE_ID}', 'statement': '$1'}))")
        databricks api post /api/2.0/sql/statements -p "$PROFILE" --json "$SQL_JSON" > /dev/null
    }
    run_sql "GRANT USE CATALOG ON CATALOG ${OTEL_CATALOG} TO \`${SP_CLIENT_ID}\`"
    run_sql "GRANT ALL PRIVILEGES ON SCHEMA ${OTEL_CATALOG}.${OTEL_RAW_SCHEMA} TO \`${SP_CLIENT_ID}\`"
    run_sql "GRANT ALL PRIVILEGES ON SCHEMA ${OTEL_CATALOG}.${OTEL_OBSERVABILITY_SCHEMA} TO \`${SP_CLIENT_ID}\`"
    echo "    Grants applied."
else
    echo "==> Skipping OTel grants (disabled)"
fi

echo "==> Deploying app code..."
databricks apps deploy "$APP_NAME" --source-code-path "$SOURCE_PATH" -p "$PROFILE"

echo "==> Done!"
