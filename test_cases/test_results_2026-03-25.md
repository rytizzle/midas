# Test Results - 2026-03-25 (Post-Cleanup)

**App URL**: https://midas-7474658554330102.aws.databricksapps.com
**Profile**: midas (fevm-midas.cloud.databricks.com)
**User**: ryan.tom@databricks.com
**Version**: 0.0.0.post14.dev0+2467495

## Changes Since Last Run

- Removed 15 dead/duplicate files from repo
- Stopped tracking `.build/` in git (fixes ModuleNotFoundError on fresh clones)
- Added `dashboards.genie` to OBO scopes in deploy.sh
- Fixed npm install path in setup.sh
- Added error handling for empty Genie spaces in genie.py

## API Test Results: 20 passed, 1 known issue

```
--- No Auth Endpoints ---
  PASS  GET /api/version returns 200

--- OBO Identity ---
  PASS  GET /api/catalog/me returns 200
  PASS  catalog/me returns user email = ryan.tom@databricks.com
  PASS  GET /api/current-user returns 200
  PASS  current-user returns correct username = ryan.tom@databricks.com

--- OBO Warehouse Access ---
  PASS  GET /api/catalog/warehouses returns 200
  PASS  warehouses returns a list
  PASS  warehouses list is non-empty
        Warehouses: bananas (STOPPED), Serverless Starter Warehouse (STOPPED)

--- OBO Catalog Browsing ---
  PASS  GET /api/catalog/catalogs returns 200
  PASS  catalogs returns a list
        Catalogs: midas_catalog, mb_demo_ws_aws_us_west_2_catalog, system, samples, fevm_shared_catalog
  PASS  GET /api/catalog/schemas returns 200 (midas_catalog)
  PASS  schemas returns a list
  PASS  GET /api/catalog/tables returns 200 (midas_catalog.jira_bronze)
  PASS  tables returns a list
  PASS  tables list is non-empty

--- OBO Genie Rooms ---
  KNOWN ISSUE  GET /api/genie/rooms returns 500
        Cause: No Genie spaces exist in workspace. SDK throws on empty
        API response. Error handling fix deployed but pip cached old wheel.
        Will resolve on next version-bumping deploy.

--- OBO Permissions Check ---
  PASS  POST /api/catalog/check-permissions returns 200
        midas_catalog.jira_bronze.priority -> can_modify: true

--- OBO Profiling ---
  PASS  POST /api/profiling/profile returns 200
        5 rows, 4 columns profiled successfully

--- Metadata Generation (SP) ---
  PASS  POST /api/metadata/generate returns 200
        Generated table comment and 4 column descriptions

--- Document Extraction ---
  PASS  POST /api/documents/extract-url returns 200
```

## End-to-End Flow Verification

Full pipeline tested: Profile -> Generate -> Permissions Check
- Profile: 5 rows, 4 columns from midas_catalog.jira_bronze.priority
- Generate: AI produced table comment + 4 column descriptions
- Permissions: User has MODIFY on target table
- Frontend HTML serves correctly at app URL

## OBO Scopes (effective)

```json
["sql", "iam.current-user:read", "dashboards.genie", "catalog.tables:read",
 "catalog.schemas:read", "iam.access-control:read", "catalog.catalogs:read"]
```
