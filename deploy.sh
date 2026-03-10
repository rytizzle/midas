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

# Read variables from the DAB target (handles both 'value' and 'default' keys across CLI versions)
get_var() {
    databricks bundle validate -t "$TARGET" --output json 2>/dev/null \
        | python3 -c "import sys,json; v=json.load(sys.stdin)['variables']['$1']; print(v.get('value', v.get('default', '')))"
}

PROFILE=$(databricks bundle validate -t "$TARGET" --output json 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['workspace']['profile'])")
WAREHOUSE_ID=$(get_var otel_warehouse_id)
SERVING_ENDPOINT=$(get_var serving_endpoint)
OTEL_CATALOG=$(get_var otel_catalog)
OTEL_RAW_SCHEMA=$(get_var otel_raw_schema)
OTEL_OBSERVABILITY_SCHEMA=$(get_var otel_observability_schema)
APP_NAME="midas"

DEPLOYER_EMAIL=$(databricks current-user me -p "$PROFILE" --output json \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['userName'])")
SOURCE_PATH="/Workspace/Users/${DEPLOYER_EMAIL}/.bundle/midas/${TARGET}/files/src"

echo "==> Deploy target: $TARGET"
echo "    Profile:              $PROFILE"
echo "    Deployer:             $DEPLOYER_EMAIL"
echo "    OTel Warehouse:       $WAREHOUSE_ID"
echo "    Serving Endpoint:     $SERVING_ENDPOINT"
echo "    OTel Catalog:         $OTEL_CATALOG"
echo "    OTel Raw Schema:      $OTEL_RAW_SCHEMA"
echo "    OTel Silver/Gold:     $OTEL_OBSERVABILITY_SCHEMA"
echo ""

# ── Inject runtime config into src/app.yml ──
cat > "$(dirname "$0")/src/app.yml" <<EOF
command: ["uvicorn", "midas.backend.app:app", "--workers", "2"]

env:
  - name: OTEL_CATALOG
    value: "${OTEL_CATALOG}"
  - name: OTEL_SCHEMA
    value: "${OTEL_RAW_SCHEMA}"
  - name: OTEL_WAREHOUSE_ID
    value: "${WAREHOUSE_ID}"
  - name: OTEL_SERVICE_NAME
    value: "${APP_NAME}"
EOF

echo "==> Deploying bundle..."
databricks bundle deploy -t "$TARGET"

echo "==> Setting OBO scopes and resources..."
databricks api patch "/api/2.0/apps/${APP_NAME}" -p "$PROFILE" --json "{
  \"user_api_scopes\": [
    \"sql\",
    \"sql.warehouses:read\",
    \"dashboards.genie\",
    \"catalog.catalogs:read\",
    \"catalog.schemas:read\",
    \"catalog.tables:read\"
  ],
  \"resources\": [
    {\"name\": \"serving-endpoint\", \"serving_endpoint\": {\"name\": \"${SERVING_ENDPOINT}\", \"permission\": \"CAN_QUERY\"}}
  ]
}"

echo "==> Granting app SP permissions for OTel..."
SP_CLIENT_ID=$(databricks api get "/api/2.0/apps/${APP_NAME}" -p "$PROFILE" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['service_principal_client_id'])")
echo "    SP Client ID: $SP_CLIENT_ID"

# Grant SP CAN_USE on the OTel warehouse (direct permission, not an app resource)
databricks api patch "/api/2.0/permissions/sql/warehouses/${WAREHOUSE_ID}" -p "$PROFILE" --json "{
  \"access_control_list\": [
    {\"service_principal_name\": \"${SP_CLIENT_ID}\", \"permission_level\": \"CAN_USE\"}
  ]
}"
echo "    Warehouse CAN_USE granted."

# Grant SP catalog/schema access for OTel writes
run_sql() {
    local SQL_JSON
    SQL_JSON=$(python3 -c "import json; print(json.dumps({'warehouse_id': '${WAREHOUSE_ID}', 'statement': '$1'}))")
    databricks api post /api/2.0/sql/statements -p "$PROFILE" --json "$SQL_JSON" > /dev/null
}
run_sql "GRANT USE CATALOG ON CATALOG ${OTEL_CATALOG} TO \`${SP_CLIENT_ID}\`"
run_sql "GRANT ALL PRIVILEGES ON SCHEMA ${OTEL_CATALOG}.${OTEL_RAW_SCHEMA} TO \`${SP_CLIENT_ID}\`"
run_sql "GRANT ALL PRIVILEGES ON SCHEMA ${OTEL_CATALOG}.${OTEL_OBSERVABILITY_SCHEMA} TO \`${SP_CLIENT_ID}\`"
echo "    Schema grants applied."

echo "==> Ensuring app is running..."
APP_STATE=$(databricks api get "/api/2.0/apps/${APP_NAME}" -p "$PROFILE" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('compute_status',{}).get('state','UNKNOWN'))")
if [ "$APP_STATE" != "RUNNING" ] && [ "$APP_STATE" != "ACTIVE" ]; then
    echo "    App compute is $APP_STATE — starting..."
    databricks apps start "$APP_NAME" -p "$PROFILE" --no-wait
    echo "    Waiting for app compute to start..."
    for i in $(seq 1 30); do
        sleep 10
        APP_STATE=$(databricks api get "/api/2.0/apps/${APP_NAME}" -p "$PROFILE" \
            | python3 -c "import sys,json; print(json.load(sys.stdin).get('compute_status',{}).get('state','UNKNOWN'))")
        echo "    [$i/30] State: $APP_STATE"
        if [ "$APP_STATE" = "RUNNING" ] || [ "$APP_STATE" = "ACTIVE" ]; then
            break
        fi
    done
    if [ "$APP_STATE" != "RUNNING" ] && [ "$APP_STATE" != "ACTIVE" ]; then
        echo "    WARNING: App not ready after 5 min (state: $APP_STATE). Attempting deploy anyway..."
    fi
else
    echo "    App compute is $APP_STATE — ready."
fi

echo "==> Deploying app code..."
databricks apps deploy "$APP_NAME" --source-code-path "$SOURCE_PATH" -p "$PROFILE"

APP_URL=$(databricks api get "/api/2.0/apps/${APP_NAME}" -p "$PROFILE" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || echo "unknown")

echo "==> Done!"
echo "    App URL: $APP_URL"
