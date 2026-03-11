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
SOURCE_PATH="/Workspace/Users/${DEPLOYER_EMAIL}/.bundle/midas/${TARGET}/files/.build"

echo "==> Deploy target: $TARGET"
echo "    Profile:              $PROFILE"
echo "    Deployer:             $DEPLOYER_EMAIL"
echo "    OTel Warehouse:       $WAREHOUSE_ID"
echo "    Serving Endpoint:     $SERVING_ENDPOINT"
echo "    OTel Catalog:         $OTEL_CATALOG"
echo "    OTel Raw Schema:      $OTEL_RAW_SCHEMA"
echo "    OTel Silver/Gold:     $OTEL_OBSERVABILITY_SCHEMA"
echo ""

# ── Inject runtime config into .build/app.yml ──
cat > "$(dirname "$0")/.build/app.yaml" <<EOF
command: ["uvicorn", "midas.backend.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

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

# Build if apx is available, otherwise use pre-built .build/
if command -v apx &>/dev/null; then
    echo "==> Building..."
    apx build
else
    echo "==> Using pre-built .build/ (apx not installed)"
    if [ ! -d "$(dirname "$0")/.build" ]; then
        echo "ERROR: .build/ directory not found. Install apx (pip install databricks-apx) and run 'apx build', or use the pre-built .build/ from git."
        exit 1
    fi
fi

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

# Helper: run SQL via statement API (best-effort)
run_sql() {
    local SQL_JSON
    SQL_JSON=$(python3 -c "import json; print(json.dumps({'warehouse_id': '${WAREHOUSE_ID}', 'statement': '$1'}))")
    databricks api post /api/2.0/sql/statements -p "$PROFILE" --json "$SQL_JSON" > /dev/null
}

# ── Best-effort SP grants (deployer may not have CAN_MANAGE on warehouse) ──
GRANT_FAILED=false

# Grant SP CAN_USE on the OTel warehouse (direct permission, not an app resource)
if databricks api patch "/api/2.0/permissions/sql/warehouses/${WAREHOUSE_ID}" -p "$PROFILE" --json "{
  \"access_control_list\": [
    {\"service_principal_name\": \"${SP_CLIENT_ID}\", \"permission_level\": \"CAN_USE\"}
  ]
}" 2>/dev/null; then
    echo "    Warehouse CAN_USE granted."
else
    GRANT_FAILED=true
    echo ""
    echo "    WARNING: Could not grant SP warehouse access (requires CAN_MANAGE on the warehouse)."
fi

# Grant SP catalog/schema access for OTel writes
if run_sql "GRANT USE CATALOG ON CATALOG ${OTEL_CATALOG} TO \`${SP_CLIENT_ID}\`" 2>/dev/null \
   && run_sql "GRANT ALL PRIVILEGES ON SCHEMA ${OTEL_CATALOG}.${OTEL_RAW_SCHEMA} TO \`${SP_CLIENT_ID}\`" 2>/dev/null \
   && run_sql "GRANT ALL PRIVILEGES ON SCHEMA ${OTEL_CATALOG}.${OTEL_OBSERVABILITY_SCHEMA} TO \`${SP_CLIENT_ID}\`" 2>/dev/null; then
    echo "    Schema grants applied."
else
    GRANT_FAILED=true
    echo "    WARNING: Could not apply some schema grants (requires catalog/schema ownership)."
fi

if [ "$GRANT_FAILED" = true ]; then
    echo ""
    echo "    ┌─────────────────────────────────────────────────────────────────────┐"
    echo "    │  Some SP grants failed. Ask a workspace admin to run these:         │"
    echo "    │                                                                     │"
    echo "    │  1. Grant the SP CAN_USE on warehouse ${WAREHOUSE_ID}  │"
    echo "    │     (Compute > SQL Warehouses > Permissions)                        │"
    echo "    │                                                                     │"
    echo "    │  2. Run in a SQL editor:                                            │"
    echo "    │     GRANT USE CATALOG ON CATALOG ${OTEL_CATALOG}                    │"
    echo "    │       TO \`${SP_CLIENT_ID}\`;                                       │"
    echo "    │     GRANT ALL PRIVILEGES ON SCHEMA                                  │"
    echo "    │       ${OTEL_CATALOG}.${OTEL_RAW_SCHEMA}                            │"
    echo "    │       TO \`${SP_CLIENT_ID}\`;                                       │"
    echo "    │     GRANT ALL PRIVILEGES ON SCHEMA                                  │"
    echo "    │       ${OTEL_CATALOG}.${OTEL_OBSERVABILITY_SCHEMA}                  │"
    echo "    │       TO \`${SP_CLIENT_ID}\`;                                       │"
    echo "    │                                                                     │"
    echo "    │  OTel telemetry will be disabled until these grants are in place.    │"
    echo "    └─────────────────────────────────────────────────────────────────────┘"
    echo ""
fi

echo "==> Deploying app code..."
databricks apps deploy "$APP_NAME" --source-code-path "$SOURCE_PATH" -p "$PROFILE"

echo "==> Done!"
