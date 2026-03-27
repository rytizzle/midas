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

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
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

# ── Build if needed ──
NEEDS_BUILD=false
if [ ! -d "$SCRIPT_DIR/.build" ] || [ ! -f "$SCRIPT_DIR/.build/requirements.txt" ]; then
    NEEDS_BUILD=true
elif [ -n "$(find "$SCRIPT_DIR/src" "$SCRIPT_DIR/vite.config.ts" "$SCRIPT_DIR/package.json" -newer "$SCRIPT_DIR/.build/requirements.txt" 2>/dev/null | head -1)" ]; then
    NEEDS_BUILD=true
fi

if [ "$NEEDS_BUILD" = true ]; then
    echo "==> Building from source..."
    rm -rf "$SCRIPT_DIR/.build"
    mkdir -p "$SCRIPT_DIR/.build"

    if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
        echo "    Installing frontend dependencies..."
        npm install --prefix "$SCRIPT_DIR" --silent
    fi

    echo "    Building frontend..."
    npx vite build --config "$SCRIPT_DIR/vite.config.ts" 2>&1 | tail -3
    cp "$SCRIPT_DIR/src/midas/ui/public/logo.svg" "$SCRIPT_DIR/src/midas/__dist__/"

    echo "    Building wheel..."
    if command -v uv &>/dev/null; then
        if ! uv build --wheel --out-dir "$SCRIPT_DIR/.build/" &>/dev/null; then
            uv build --wheel --out-dir "$SCRIPT_DIR/.build/" --offline 2>&1 | tail -1
        fi
    else
        pip wheel "$SCRIPT_DIR" --no-deps -w "$SCRIPT_DIR/.build/" -q
    fi

    WHL_NAME=$(basename "$SCRIPT_DIR/.build/"*.whl)
    echo "$WHL_NAME" > "$SCRIPT_DIR/.build/requirements.txt"
    cp -r "$SCRIPT_DIR/src/midas/__dist__" "$SCRIPT_DIR/.build/static"

    cat > "$SCRIPT_DIR/.build/app.yml" <<'EOF'
command: ["uvicorn", "midas.backend.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
EOF

    echo "    Built: $WHL_NAME"
else
    echo "==> Using existing .build/ (no source changes detected)"
fi

# ── Helper to get app compute state ──
get_app_state() {
    databricks apps get "$APP_NAME" -p "$PROFILE" --output json 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('compute_status',{}).get('state','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN"
}

# ── Pre-create app if it doesn't exist (Terraform provider requires it) ──
APP_STATE=$(get_app_state)
if [ "$APP_STATE" = "DELETING" ]; then
    echo "==> App is being deleted — waiting..."
    while databricks apps get "$APP_NAME" -p "$PROFILE" &>/dev/null; do sleep 5; done
fi
if ! databricks apps get "$APP_NAME" -p "$PROFILE" &>/dev/null; then
    echo "==> App '$APP_NAME' not found — creating..."
    databricks apps create -p "$PROFILE" --json "{\"name\": \"$APP_NAME\", \"description\": \"Midas - AI Metadata Generator\"}" --no-wait
fi
APP_STATE=$(get_app_state)
if [ "$APP_STATE" != "ACTIVE" ] && [ "$APP_STATE" != "STOPPED" ]; then
    echo "==> Waiting for app compute to be ready (current: $APP_STATE)..."
    for i in $(seq 1 60); do
        APP_STATE=$(get_app_state)
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

echo "==> Syncing .build/ to workspace..."
databricks workspace import-dir "$SCRIPT_DIR/.build" "$SOURCE_PATH" -p "$PROFILE" --overwrite

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
