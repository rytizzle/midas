#!/bin/bash
# Midas API Test Suite
# Run against the deployed app to verify OBO compliance and functionality.
#
# Usage:
#   ./test_cases/api_tests.sh [profile] [app_url]
#
# Defaults:
#   profile = midas
#   app_url = https://midas-7474658554330102.aws.databricksapps.com

set -euo pipefail

PROFILE="${1:-midas}"
APP_URL="${2:-https://midas-7474658554330102.aws.databricksapps.com}"
PASS=0
FAIL=0
SKIP=0

get_token() {
    databricks auth token --profile "$PROFILE" 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
}

TOKEN=$(get_token)

run_test() {
    local name="$1"
    local expected_status="$2"
    local method="$3"
    local path="$4"
    local body="${5:-}"

    local curl_args=(-s -o /tmp/midas_test_response -w "%{http_code}" -H "Authorization: Bearer $TOKEN")

    if [ "$method" = "POST" ]; then
        curl_args+=(-X POST -H "Content-Type: application/json")
        if [ -n "$body" ]; then
            curl_args+=(-d "$body")
        fi
    fi

    local status
    status=$(curl "${curl_args[@]}" "${APP_URL}${path}")
    local response
    response=$(cat /tmp/midas_test_response)

    if [ "$status" = "$expected_status" ]; then
        echo "  PASS  $name (HTTP $status)"
        PASS=$((PASS + 1))
    else
        echo "  FAIL  $name (expected $expected_status, got $status)"
        echo "        Response: $(echo "$response" | head -c 200)"
        FAIL=$((FAIL + 1))
    fi
}

validate_json_field() {
    local name="$1"
    local jq_expr="$2"
    local expected="$3"

    local actual
    actual=$(python3 -c "
import json
with open('/tmp/midas_test_response') as f:
    d = json.load(f)
    val = $jq_expr
    print(val)
" 2>/dev/null || echo "PARSE_ERROR")

    if [ "$actual" = "$expected" ]; then
        echo "  PASS  $name (value=$actual)"
        PASS=$((PASS + 1))
    else
        echo "  FAIL  $name (expected=$expected, got=$actual)"
        FAIL=$((FAIL + 1))
    fi
}

echo "========================================="
echo "Midas API Test Suite"
echo "Profile: $PROFILE"
echo "App URL: $APP_URL"
echo "========================================="
echo ""

# --- Section 1: No Auth Endpoints ---
echo "--- No Auth Endpoints ---"
run_test "GET /api/version returns 200" "200" "GET" "/api/version"

# --- Section 2: OBO Identity ---
echo ""
echo "--- OBO Identity ---"
run_test "GET /api/catalog/me returns 200" "200" "GET" "/api/catalog/me"
validate_json_field "catalog/me returns user email" "d.get('email','')" "ryan.tom@databricks.com"

run_test "GET /api/current-user returns 200" "200" "GET" "/api/current-user"
validate_json_field "current-user returns correct username" "d.get('user_name','')" "ryan.tom@databricks.com"

# --- Section 3: OBO Warehouse Access ---
echo ""
echo "--- OBO Warehouse Access ---"
run_test "GET /api/catalog/warehouses returns 200" "200" "GET" "/api/catalog/warehouses"
validate_json_field "warehouses returns a list" "type(d).__name__" "list"
validate_json_field "warehouses list is non-empty" "len(d) > 0" "True"

# --- Section 4: OBO Catalog Browsing ---
echo ""
echo "--- OBO Catalog Browsing ---"
run_test "GET /api/catalog/catalogs returns 200" "200" "GET" "/api/catalog/catalogs"
validate_json_field "catalogs returns a list" "type(d).__name__" "list"

run_test "GET /api/catalog/schemas returns 200" "200" "GET" "/api/catalog/schemas?catalog=midas_catalog"
validate_json_field "schemas returns a list" "type(d).__name__" "list"

run_test "GET /api/catalog/tables returns 200" "200" "GET" "/api/catalog/tables?catalog=midas_catalog&schema=jira_bronze"
validate_json_field "tables returns a list" "type(d).__name__" "list"
validate_json_field "tables list is non-empty" "len(d) > 0" "True"

# --- Section 5: OBO Genie Rooms ---
echo ""
echo "--- OBO Genie Rooms ---"
run_test "GET /api/genie/rooms returns 200 (KNOWN FAIL: missing scope)" "200" "GET" "/api/genie/rooms"

# --- Section 6: OBO Permissions Check ---
echo ""
echo "--- OBO Permissions Check ---"
WH_ID="a6505a9626cf9ca7"
run_test "POST /api/catalog/check-permissions returns 200" "200" "POST" "/api/catalog/check-permissions" \
    "{\"tables\": [\"midas_catalog.jira_bronze.priority\"], \"warehouse_id\": \"$WH_ID\"}"

# --- Section 7: OBO Profiling ---
echo ""
echo "--- OBO Profiling ---"
run_test "POST /api/profiling/profile returns 200" "200" "POST" "/api/profiling/profile" \
    "{\"tables\": [\"midas_catalog.jira_bronze.priority\"], \"warehouse_id\": \"$WH_ID\"}"
validate_json_field "profile returns table data" "'row_count' in d.get('midas_catalog.jira_bronze.priority', {})" "True"

# --- Section 8: Metadata Generation (SP) ---
echo ""
echo "--- Metadata Generation (SP - by design) ---"
run_test "POST /api/metadata/generate returns 200" "200" "POST" "/api/metadata/generate" \
    '{"tables":{"test.table":{"columns":[{"name":"id","type":"int","distinct_count":10,"null_pct":0,"sample_values":["1","2"]}],"sample_rows":[],"row_count":10}},"context":{"blurb":"test data","docs":"","tableTemplate":"","columnTemplate":""}}'

# --- Section 9: Document Extraction ---
echo ""
echo "--- Document Extraction ---"
run_test "POST /api/documents/extract-url returns 200" "200" "POST" "/api/documents/extract-url" \
    '{"url": "https://docs.databricks.com/en/introduction/index.html"}'

# --- Summary ---
echo ""
echo "========================================="
echo "Results: $PASS passed, $FAIL failed, $SKIP skipped"
echo "========================================="

rm -f /tmp/midas_test_response
exit $FAIL
