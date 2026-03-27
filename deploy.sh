#!/bin/bash
set -e

# ──────────────────────────────────────────────────────────────
# Midas Deploy Script
#
# Usage:
#   ./deploy.sh              # deploy the default target (dev), profile from databricks.yml
#   ./deploy.sh prod         # deploy a specific target
#   ./deploy.sh dev myprof   # deploy dev target using CLI profile "myprof"
#
# All config lives in databricks.yml under targets.
# ──────────────────────────────────────────────────────────────

TARGET="${1:-dev}"
PROFILE_OVERRIDE="${2:-}"

# Read variables from the DAB target (handles both 'value' and 'default' keys across CLI versions)
bundle_cmd() {
    if [ -n "$PROFILE_OVERRIDE" ]; then
        DATABRICKS_CONFIG_PROFILE="$PROFILE_OVERRIDE" databricks "$@"
    else
        databricks "$@"
    fi
}

get_var() {
    bundle_cmd bundle validate -t "$TARGET" --output json 2>/dev/null \
        | python3 -c "import sys,json; v=json.load(sys.stdin)['variables']['$1']; print(v.get('value', v.get('default', '')))"
}

if [ -n "$PROFILE_OVERRIDE" ]; then
    PROFILE="$PROFILE_OVERRIDE"
else
    PROFILE=$(bundle_cmd bundle validate -t "$TARGET" --output json 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['workspace']['profile'])")
fi
SERVING_ENDPOINT=$(get_var serving_endpoint)
APP_NAME="midas"

DEPLOYER_EMAIL=$(databricks current-user me -p "$PROFILE" --output json \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['userName'])")
SOURCE_PATH="/Workspace/Users/${DEPLOYER_EMAIL}/.bundle/midas/${TARGET}/files/.build"

echo "==> Deploy target: $TARGET"
echo "    Profile:              $PROFILE"
echo "    Deployer:             $DEPLOYER_EMAIL"
echo "    Serving Endpoint:     $SERVING_ENDPOINT"
echo ""

# Use pre-built .build/ if it exists, otherwise build with apx
if [ -d "$(dirname "$0")/.build" ]; then
    echo "==> Using pre-built .build/"
elif command -v apx &>/dev/null; then
    echo "==> .build/ not found, building with apx..."
    apx build
else
    echo "ERROR: .build/ directory not found and apx is not installed. Either pull .build/ from git or install apx (pip install databricks-apx)."
    exit 1
fi

# ── Inject runtime config into .build/app.yml ──
cat > "$(dirname "$0")/.build/app.yml" <<EOF
command: ["uvicorn", "midas.backend.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
EOF

# ── Pre-create app if it doesn't exist (Terraform provider requires it) ──
if ! databricks apps get "$APP_NAME" -p "$PROFILE" &>/dev/null; then
    echo "==> App '$APP_NAME' not found — creating..."
    databricks apps create -p "$PROFILE" --json "{\"name\": \"$APP_NAME\", \"description\": \"Midas - AI Metadata Generator\"}" --no-wait
fi

# ── Wait for compute to be ACTIVE or STOPPED before bundle deploy ──
APP_STATE=$(databricks apps get "$APP_NAME" -p "$PROFILE" --output json 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('compute_status',{}).get('state','UNKNOWN'))")
if [ "$APP_STATE" != "ACTIVE" ] && [ "$APP_STATE" != "STOPPED" ]; then
    echo "==> Waiting for app compute to be ready (current: $APP_STATE)..."
    for i in $(seq 1 60); do
        APP_STATE=$(databricks apps get "$APP_NAME" -p "$PROFILE" --output json 2>/dev/null \
            | python3 -c "import sys,json; print(json.load(sys.stdin).get('compute_status',{}).get('state','UNKNOWN'))")
        [ "$APP_STATE" = "ACTIVE" ] || [ "$APP_STATE" = "STOPPED" ] && break
        sleep 10
    done
    if [ "$APP_STATE" != "ACTIVE" ] && [ "$APP_STATE" != "STOPPED" ]; then
        echo "ERROR: App compute did not become ready (current: $APP_STATE). Aborting."
        exit 1
    fi
fi

echo "==> Deploying bundle..."
bundle_cmd bundle deploy -t "$TARGET"

# ── Clean up old wheels from workspace ──
CURRENT_WHL=$(basename .build/*.whl)
for OLD_WHL in $(databricks workspace list "${SOURCE_PATH}" -p "$PROFILE" --output json 2>/dev/null \
    | python3 -c "
import sys,json
current='$CURRENT_WHL'
for f in json.load(sys.stdin):
    p = f.get('path','')
    if p.endswith('.whl') and not p.endswith(current):
        print(p)
" 2>/dev/null); do
    echo "    Removing old wheel: $(basename "$OLD_WHL")"
    databricks workspace delete "$OLD_WHL" -p "$PROFILE" 2>/dev/null
done

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
    {\"name\": \"serving-endpoint\", \"serving_endpoint\": {\"name\": \"${SERVING_ENDPOINT}\", \"permission\": \"CAN_QUERY\"}}
  ]
}"

# ── Ensure compute is running before code deploy ──
APP_STATE=$(databricks apps get "$APP_NAME" -p "$PROFILE" --output json 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('compute_status',{}).get('state','UNKNOWN'))")

if [ "$APP_STATE" = "STOPPED" ]; then
    echo "==> App compute is stopped — starting..."
    databricks apps start "$APP_NAME" -p "$PROFILE" --no-wait
    APP_STATE="STARTING"
fi

if [ "$APP_STATE" != "ACTIVE" ]; then
    echo "==> Waiting for compute to become active (current: $APP_STATE)..."
    for i in $(seq 1 30); do
        APP_STATE=$(databricks apps get "$APP_NAME" -p "$PROFILE" --output json 2>/dev/null \
            | python3 -c "import sys,json; print(json.load(sys.stdin).get('compute_status',{}).get('state','UNKNOWN'))")
        [ "$APP_STATE" = "ACTIVE" ] && break
        sleep 10
    done
fi

if [ "$APP_STATE" != "ACTIVE" ]; then
    echo "ERROR: App compute did not reach ACTIVE state (current: $APP_STATE). Aborting."
    exit 1
fi

echo "==> Deploying app code..."
databricks apps deploy "$APP_NAME" --source-code-path "$SOURCE_PATH" -p "$PROFILE"

echo "==> Done!"
