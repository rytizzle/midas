#!/bin/bash
set -e

# ──────────────────────────────────────────────────────────────
# Midas Deploy Script
#
# Usage:
#   ./deploy.sh              # deploy using default profile
#   ./deploy.sh dev myprof   # deploy using CLI profile "myprof"
#
# Prereqs: databricks CLI, apx (pip install databricks-apx)
# ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-dev}"
PROFILE_OVERRIDE="${2:-}"

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

# ── Step 1: Build (only if source changed) ──
if [ ! -f "$SCRIPT_DIR/.build/requirements.txt" ] || \
   [ -n "$(find "$SCRIPT_DIR/src" "$SCRIPT_DIR/package.json" -newer "$SCRIPT_DIR/.build/requirements.txt" 2>/dev/null | head -1)" ]; then
    echo "==> Building..."
    apx build
else
    echo "==> Using existing .build/ (no source changes)"
fi

# ── Step 2: Ensure app exists ──
get_app_state() {
    databricks apps get "$APP_NAME" -p "$PROFILE" --output json 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('compute_status',{}).get('state','UNKNOWN'))" 2>/dev/null || echo "NONE"
}

APP_STATE=$(get_app_state)
if [ "$APP_STATE" = "DELETING" ]; then
    echo "==> Waiting for old app to finish deleting..."
    while databricks apps get "$APP_NAME" -p "$PROFILE" &>/dev/null; do sleep 5; done
    APP_STATE="NONE"
fi

if [ "$APP_STATE" = "NONE" ]; then
    echo "==> Creating app..."
    databricks apps create -p "$PROFILE" --json "{\"name\": \"$APP_NAME\", \"description\": \"Midas - AI Metadata Generator\"}" --no-wait
fi

APP_STATE=$(get_app_state)
if [ "$APP_STATE" != "ACTIVE" ] && [ "$APP_STATE" != "STOPPED" ]; then
    echo "==> Waiting for compute (current: $APP_STATE)..."
    for i in $(seq 1 60); do
        APP_STATE=$(get_app_state)
        [ "$APP_STATE" = "ACTIVE" ] || [ "$APP_STATE" = "STOPPED" ] && break
        sleep 10
    done
fi

# ── Step 3: Deploy bundle (Terraform for app resource) ──
echo "==> Deploying bundle..."
bundle_cmd bundle deploy -t "$TARGET"

# ── Step 4: Upload .build/ (DAB doesn't sync dotfile dirs) ──
echo "==> Uploading .build/..."
databricks workspace import-dir "$SCRIPT_DIR/.build" "$SOURCE_PATH" -p "$PROFILE" --overwrite

# ── Step 5: Set OBO scopes and resources ──
echo "==> Setting scopes and resources..."
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
}" > /dev/null

# ── Step 6: Ensure compute is active ──
APP_STATE=$(get_app_state)
if [ "$APP_STATE" = "STOPPED" ]; then
    echo "==> Starting compute..."
    databricks apps start "$APP_NAME" -p "$PROFILE" --no-wait
    APP_STATE="STARTING"
fi
if [ "$APP_STATE" != "ACTIVE" ]; then
    echo "==> Waiting for compute..."
    for i in $(seq 1 60); do
        APP_STATE=$(get_app_state)
        [ "$APP_STATE" = "ACTIVE" ] && break
        sleep 10
    done
fi

# ── Step 7: Deploy app code ──
echo "==> Deploying app code..."
databricks apps deploy "$APP_NAME" --source-code-path "$SOURCE_PATH" -p "$PROFILE"

echo "==> Done!"
