# Midas App Verification Findings

## Critical Issues

### 1. Genie Rooms Endpoint Returns 500 (CRITICAL)

**Endpoint**: `GET /api/genie/rooms`
**Error**: HTTP 500 - Internal Server Error
**Root Cause**: The `dashboards.genie` OBO scope is missing from the deployed app.

Current `user_api_scopes`:
```json
["sql", "catalog.catalogs:read", "catalog.schemas:read", "catalog.tables:read"]
```

Missing scope: `dashboards.genie`

The `deploy.sh` script (line 72-81) sets OBO scopes but does **not** include
`dashboards.genie`. The backend's `genie.py` calls `user_ws.genie.list_spaces()`
which requires this scope on the OBO token.

**Fix**: Add `dashboards.genie` to the `user_api_scopes` array in `deploy.sh`:
```json
"user_api_scopes": [
    "sql",
    "dashboards.genie",
    "catalog.catalogs:read",
    "catalog.schemas:read",
    "catalog.tables:read"
]
```

**Impact**: The entire "Genie Room" tab in the UI is broken. Users cannot import
tables from existing Genie spaces.

---

### 2. Genie Rooms Error Not Surfaced to User (MEDIUM)

**File**: `src/midas/ui/components/midas/TableSelector.tsx` line 63-64

When `api.getGenieRooms()` fails, the error is only logged to `console.error`.
The UI shows "Loading rooms..." briefly, then an empty dropdown with no error
message. Users have no idea why rooms aren't loading.

**Fix**: Add error state and display an inline error message when room loading fails.

---

### 3. `POST /api/genie/rooms/{id}/link` Has No Authentication (LOW)

**File**: `src/midas/backend/routes/genie.py` line 92-95

This endpoint writes to an in-memory dict (`_room_links`) without requiring any
authentication headers. Any caller who can reach the app can set room links.
Additionally, the state is shared across all users and lost on restart.

**Fix**: Add `Dependencies.Headers` or `Dependencies.UserClient` parameter to
require authentication. Consider persisting links to Lakebase if needed.

---

## OBO Compliance Assessment

### Correctly Using OBO (User Token)

| Endpoint | Auth Method | File |
|----------|-------------|------|
| `GET /api/catalog/me` | Headers (email/name) | catalog.py:13 |
| `GET /api/catalog/warehouses` | UserClient (OBO) | catalog.py:19 |
| `GET /api/catalog/catalogs` | UserClient (OBO) | catalog.py:32 |
| `GET /api/catalog/schemas` | UserClient (OBO) | catalog.py:41 |
| `GET /api/catalog/tables` | UserClient (OBO) | catalog.py:50 |
| `POST /api/catalog/check-permissions` | User SQL token | catalog.py:78 |
| `GET /api/genie/rooms` | UserClient (OBO) | genie.py:15 |
| `GET /api/genie/rooms/{id}/tables` | UserClient (OBO) | genie.py:32 |
| `POST /api/profiling/profile` | User SQL token | profiling.py:101 |
| `POST /api/apply/execute` | User SQL token | apply.py:44 |
| `POST /api/apply/undo` | User SQL token | apply.py:89 |

### Using Service Principal (By Design)

| Endpoint | Auth Method | Justification |
|----------|-------------|---------------|
| `POST /api/metadata/generate` | SP (app identity) | Foundation Model API access via serving endpoint resource |

This is acceptable because: (a) the serving endpoint is an app resource with
`CAN_QUERY` permission, (b) user data is only sent as prompt context (profiles),
and (c) the LLM doesn't need UC permissions.

### No Auth Required

| Endpoint | Notes |
|----------|-------|
| `GET /api/version` | Returns app version, no sensitive data |
| `POST /api/documents/extract-pdf` | Stateless file parsing |
| `POST /api/documents/extract-url` | SSRF risk (see below) |
| `POST /api/genie/rooms/{id}/link` | Missing auth (see issue #3) |

---

## UX Observations

### Warehouse Selector
- Shows `{name} ({state})` format which is clear
- Auto-selects RUNNING warehouse, falls back to first in list
- Both warehouses returned were STOPPED; user would need to start one
- Polls every 30s which is good for detecting state changes

### Table Selection Flow
- Catalog → Schema → Table cascade works well
- Search filter works on name and comment
- Permission check before proceeding is a nice touch
- Permission check is optional (user can skip) which is correct UX

### Error Handling Gaps
- `api.getMe()` failure is silently caught — email just doesn't appear
- `api.getCatalogs()` failure silently shows empty dropdown
- `api.getSchemas()` / `api.getTables()` failures silently show empty lists
- No toast or inline error for most API failures

---

## SSRF Concern

`POST /api/documents/extract-url` performs server-side HTTP requests to
arbitrary URLs without restrictions. In a deployed Databricks App, this could
potentially reach internal network resources.

**Recommendation**: Add URL validation to block private IP ranges and internal
hostnames, or use allowlisting for known documentation domains.

---

## Configuration Alignment

### databricks.yml vs deploy.sh

The current `databricks.yml` is minimal (no `user_api_scopes` or `resources`
in the bundle). The `deploy.sh` script handles OBO scopes and resources via
`databricks api patch` after bundle deploy. This is a valid pattern to work
around the Terraform provider bug with `user_api_scopes`.

### Missing from deploy.sh
- `dashboards.genie` scope (critical)
- No `iam.current-user:read` scope explicitly set (auto-added by platform)

### app.yml
Contains only: `command: ["uvicorn", "midas.backend.app:app", "--workers", "2"]`
The deploy.sh overwrites this in `.build/app.yml` with `--host 0.0.0.0 --port 8000`
which is correct for the deployed environment.
