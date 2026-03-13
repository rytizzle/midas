# Midas

AI-powered metadata generator for Unity Catalog. Midas profiles your data, generates structured table and column descriptions using Foundation Models, and applies them back to Unity Catalog -- making your tables ready for Genie, discovery, and governance.

Built with [apx](https://github.com/databricks-solutions/apx) (FastAPI + React + shadcn/ui).

## What it does

1. **Browse** catalogs, schemas, and tables (including views and materialized views) -- or import from a Genie room
2. **Select a warehouse** from those you have access to (live status updates every 30s)
3. **Choose a description template** to control the structure and style of generated metadata
4. **Provide context** -- paste a business description, upload PDFs, or fetch URLs to give the AI domain knowledge
5. **Profile** tables to understand data distributions, value ranges, and patterns (optimized to 3 queries per table)
6. **Generate** table and column descriptions using an LLM (Foundation Model API), informed by profiling results and your context
7. **Review & edit** generated metadata -- expand/collapse tables, reject individual suggestions, or keep existing descriptions
8. **Apply** metadata back to Unity Catalog with a single click (with full undo support)

## Description templates

Templates control the structure and focus of generated metadata. Choose a preset or define your own.

### Preset templates

| Template | Best for | Table description structure | Column description style |
|----------|----------|----------------------------|--------------------------|
| **None** | Quick & simple | Free-form AI-generated descriptions | Free-form |
| **Genie-Optimized** | Databricks Genie / text-to-SQL | General Description, Business Value, Key Relationships, Filters & Segments | Definition with typical value ranges or categories |
| **Data Governance** | Compliance, lineage, data quality | General Description, Data Source, Update Frequency, Data Owner, Sensitivity | Business definition with data quality notes and sensitivity classification |
| **Business Glossary** | Non-technical stakeholders | What is this?, Business Value, Example Use Cases | Plain-language explanation, no technical jargon |

### Custom templates

Select **Custom** to define your own format. Both the table comment template and column description template start blank -- type your own structure and the AI will follow it for every table and column. Placeholder text shows example formats to guide you.

This is useful when your organization has specific documentation standards or when the presets don't match your use case.

## How metadata generation works

Midas doesn't just slap generic descriptions on your tables. The generation pipeline combines multiple signals:

1. **Schema analysis** -- column names, types, and existing comments
2. **Data profiling** -- row counts, null rates, distinct counts, min/max values, sample values, and value distributions
3. **Your context** -- business descriptions, uploaded PDFs, fetched URLs, and any additional documentation you provide
4. **Template structure** -- the selected template dictates the format and sections of each description

The LLM sees all of this together, so descriptions reflect what's actually in the data -- not just guesses from column names.

### What gets written to Unity Catalog

- **Table comments** via `COMMENT ON TABLE` (or `COMMENT ON VIEW` / materialized view)
- **Column descriptions** via `ALTER TABLE ... ALTER COLUMN ... COMMENT` (or `COMMENT ON COLUMN` for views/MVs)
- Every apply operation stores the previous state so you can **undo** back to the original metadata

## Architecture

```
Databricks App (FastAPI + React)
  |-- /api/catalog/*       Browse UC catalogs/schemas/tables, warehouse list (OBO auth)
  |-- /api/profiling/*     Profile table data via user-selected warehouse (3 queries/table)
  |-- /api/metadata/*      Generate descriptions via Foundation Model API
  |-- /api/apply/*         Write metadata back to UC (tables, views, MVs) via user warehouse
  |-- /api/genie/*         Browse and link Genie rooms
  +-- telemetry.py         OTel v2 span/log writer (optional, disabled by default)
```

All data operations run under the end user's identity via OBO (on-behalf-of) auth. The app never elevates privileges -- users can only modify tables they already have access to.

## Prerequisites

- [Databricks CLI](https://docs.databricks.com/dev-tools/cli/install.html) v0.229+
- Python 3 (for deploy script helpers)
- A Databricks workspace with:
  - Unity Catalog enabled
  - A SQL warehouse
  - Foundation Model API enabled (serving endpoint)

The repo includes a pre-built `.build/` directory so no additional build tools (Node.js, apx) are needed for deployment.

## Quick start

### 1. Authenticate

```bash
databricks auth login --host https://your-workspace.cloud.databricks.com --profile my-workspace
```

### 2. Configure your target

Edit `databricks.yml` and add a target under `targets:`:

```yaml
targets:
  my-env:
    workspace:
      profile: my-workspace
    variables:
      # serving_endpoint: databricks-gpt-5-4  # default
```

That's it for a basic deploy. The `otel_*` variables are only needed if you enable telemetry (see below).

### 3. Deploy

```bash
./deploy.sh my-env
```

This single command will:
- Build the frontend and Python wheel (if `apx` is installed, otherwise uses pre-built `.build/`)
- Deploy all DAB resources
- Configure OBO authentication scopes and serving endpoint resource
- Deploy the app code

## Configuration reference

All configuration lives in `databricks.yml` under `targets.<name>.variables`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `serving_endpoint` | no | `databricks-gpt-5-4` | Foundation Model serving endpoint |
| `otel_enabled` | no | `false` | Enable OTel telemetry (experimental) |
| `otel_warehouse_id` | if OTel on | -- | SQL warehouse ID for OTel telemetry writes (SP) |
| `otel_catalog` | if OTel on | -- | Catalog for OTel tables |
| `otel_raw_schema` | no | `otel_raw` | Schema for bronze OTel tables |
| `otel_observability_schema` | no | `otel_observability` | Schema for silver/gold DLT tables |

Users browse **all catalogs they have access to** via the app UI -- no catalog config needed.

## Deployer requirements

The person running `./deploy.sh` needs:
- Workspace admin or sufficient privileges to create apps

If `otel_enabled: "true"`, the deployer also needs:
- `CAN_MANAGE` on the OTel SQL warehouse (to grant SP `CAN_USE`)
- Ability to create schemas in the OTel catalog

## Local development

```bash
# Set your CLI profile
echo "DATABRICKS_CONFIG_PROFILE=my-workspace" > .env

# Start the app locally (hot-reload)
apx dev start

# View logs
apx dev logs -f

# Check status
apx dev status

# Stop
apx dev stop
```

The app runs at `http://localhost:8001`. It uses your CLI profile for authentication -- OBO is only active when deployed as a Databricks App.

## What `deploy.sh` does (and why)

The deploy script wraps `databricks bundle deploy` with additional steps that can't be handled by DAB today:

1. **OBO scopes** -- The Terraform provider wipes `user_api_scopes` on every deploy, so the script re-applies them via REST API
2. **SP warehouse grant** -- Grants the SP `CAN_USE` on the OTel warehouse via the permissions API (not visible as an app resource)
3. **SP schema grants** -- The auto-created service principal name contains a space, which Terraform can't resolve, so grants are applied via SQL

Without these issues, `databricks bundle deploy` alone would be sufficient.

## OTel observability (experimental)

OTel telemetry is disabled by default. To enable it, set `otel_enabled: "true"` in your target variables and provide `otel_warehouse_id` and `otel_catalog`. After deploying, run the bronze setup job once (**Workflows > midas-otel-setup-bronze > Run now**), then trigger the DLT pipeline (**Workflows > midas-otel-scheduled > Run now**).

## Project structure

```
midas/
├── databricks.yml              # DAB config -- targets, variables, resources
├── deploy.sh                   # One-command deploy wrapper
├── app.yml                     # App runtime config (generated by deploy.sh)
├── src/
│   ├── midas/
│   │   ├── backend/
│   │   │   ├── app.py          # FastAPI entry point
│   │   │   ├── config.py       # SDK config + SQL connection
│   │   │   ├── llm.py          # Foundation Model client
│   │   │   ├── telemetry.py    # OTel v2 span/log writer (optional)
│   │   │   └── routes/         # API routes
│   │   └── ui/                 # React frontend (TypeScript + Vite)
│   └── notebooks/
│       ├── setup_otel_v2.py    # Bronze table DDL (run once)
│       └── dlt_pipeline.py     # Silver + Gold DLT transformations
├── .build/                     # Pre-built app (checked into git)
└── setup.sh                    # Optional: install dev dependencies
```
