# Midas Test Cases

Test results from API-level verification against the deployed app at:
`https://midas-7474658554330102.aws.databricksapps.com`

**Tested**: 2026-03-25
**Profile**: midas (fevm-midas workspace)
**User**: ryan.tom@databricks.com

## Quick Summary

| Test Area | Status | Notes |
|-----------|--------|-------|
| OBO Authentication | PASS | All catalog/warehouse/table endpoints use user token |
| Warehouse Selection | PASS | Returns only user-accessible warehouses |
| Catalog Browsing | PASS | Respects user Unity Catalog permissions |
| Genie Rooms | **FAIL** | 500 error - missing `dashboards.genie` OBO scope |
| Table Profiling | PASS | Uses user SQL connection via OBO token |
| Metadata Generation | PASS | Uses SP for LLM (by design) |
| Apply/Undo | PASS | Uses user SQL connection via OBO token |
| Document Extraction | PASS | No auth needed (stateless) |

## Issues Found

See `findings.md` for detailed issues and recommendations.
