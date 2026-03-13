# Midas

AI-powered metadata generator for Unity Catalog tables and Genie rooms. Midas profiles your data, generates descriptions using Foundation Models, and applies them back to Unity Catalog. Optional OTel v2 observability can be enabled for full telemetry.

Built with [apx](https://github.com/databricks-solutions/apx) (FastAPI + React + shadcn/ui).

## What it does

1. **Browse** catalogs, schemas, and tables (including views and materialized views) -- or import from a Genie room
2. **Select a warehouse** from those you have access to (live status updates every 30s)
3. **Choose a description template** -- presets for Genie, governance, or business glossary, or define your own custom format
4. **Profile** tables to understand data distributions and patterns (optimized to 3 queries per table)
5. **Generate** table and column descriptions using an LLM (Foundation Model API)
6. **Review & edit** generated metadata -- expand/collapse tables, reject individual suggestions, or keep existing descriptions
7. **Apply** metadata back to Unity Catalog (with undo support, works on tables, views, and materialized views)
8. **Observe** (optional) every operation via OTel v2 telemetry -- disabled by default, enable with `otel_enabled: "true"`

## Architecture

```
Databricks App (FastAPI + React)
  |-- /api/catalog/*       Browse UC catalogs/schemas/tables, warehouse list (OBO auth)
  |-- /api/profiling/*     Profile table data via user-selected warehouse (3 queries/table)
  |-- /api/metadata/*      Generate descriptions via Foundation Model API
  |-- /api/apply/*         Write metadata back to UC (tables, views, MVs) via user warehouse
  |-- /api/genie/*         Browse and link Genie rooms
  +-- telemetry.py         Async OTel v2 span/log writer -> Delta tables (optional, SP warehouse)

OTel Pipeline (DLT Serverless) -- only deployed when otel_enabled: "true"
  Bronze: spans, logs, metrics     <- written by app SP at runtime
  Silver: parsed, cleaned, enriched
  Gold:   service health, operation perf, error analysis, LLM usage
```

### Two-warehouse pattern

| Warehouse | Identity | How it's set | Purpose |
|-----------|----------|--------------|---------|
| **OTel warehouse** | Service principal | `otel_warehouse_id` in config | Telemetry writes (behind the scenes) |
| **User warehouse** | End user (OBO) | UI dropdown selection | Profiling, apply, permission checks |

Users select their own warehouse from the dropdown. The SP writes telemetry to a predefined warehouse that users never see.

## Tables created

### Bronze (`{otel_catalog}.{otel_raw_schema}`)

| Table | Written by | Content |
|-------|-----------|---------|
| `spans` | App SP at runtime | Traced API calls -- route, duration, status, parent/child spans |
| `logs` | App SP at runtime | Explicit log entries -- errors, warnings, info |
| `metrics` | (placeholder) | Reserved for Spark compute metrics |

### Silver + Gold (`{otel_catalog}.{otel_observability_schema}`)

| Table | Source | Content |
|-------|--------|---------|
| `silver_spans` | spans | Duration, error flags, operation categories, LLM/Spark attributes |
| `silver_logs` | logs | Parsed severity, error classification |
| `silver_metrics` | metrics | Extracted gauge/sum values |
| `gold_service_health` | silver_spans | Hourly request volume, error rate, latency percentiles |
| `gold_operation_performance` | silver_spans | Latency stats per operation |
| `gold_error_analysis` | silver_spans | Error trends by service and operation |
| `gold_cluster_resources` | silver_metrics | CPU/memory/disk utilization per cluster |
| `gold_log_severity_trends` | silver_logs | Hourly log volume by severity |
| `gold_top_errors` | silver_logs | Most frequent error types |
| `gold_llm_usage` | silver_spans | LLM call volume, latency, cost indicators |

## Prerequisites

- [Databricks CLI](https://docs.databricks.com/dev-tools/cli/install.html) v0.229+
- Python 3 (for deploy script helpers)
- A Databricks workspace with:
  - Unity Catalog enabled
  - A SQL warehouse
  - Foundation Model API enabled (serving endpoint)

The repo includes a pre-built `.build/` directory so no additional build tools (Node.js, apx) are needed for deployment.

> **Note:** If OTel is disabled (the default), the deployer only needs basic workspace permissions. The `CAN_MANAGE` warehouse requirement only applies when `otel_enabled: "true"` (to grant the SP `CAN_USE` on the OTel warehouse).

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
      otel_warehouse_id: abc123def456    # SQL warehouse ID for OTel (SP access)
      otel_catalog: my_catalog           # catalog for OTel tables
      # serving_endpoint: databricks-gpt-5-4      # default
      # otel_raw_schema: otel_raw                  # default
      # otel_observability_schema: otel_observability  # default
```

If OTel is disabled (default), only `serving_endpoint` matters (and it has a default). The `otel_*` variables are only required when `otel_enabled: "true"`.

### 3. Deploy

```bash
./deploy.sh my-env
```

This single command will:
- Build the frontend and Python wheel (if `apx` is installed, otherwise uses pre-built `.build/`)
- Deploy all DAB resources (app, schemas, DLT pipeline, jobs)
- Configure OBO authentication scopes and serving endpoint resource
- Grant the app's service principal `CAN_USE` on the OTel warehouse
- Grant the app's service principal access to OTel catalog and schemas
- Deploy the app code

### 4. (Optional) Set up OTel telemetry

If you set `otel_enabled: "true"`, run the bronze table setup job once after the first deploy:

**Workflows > midas-otel-setup-bronze > Run now**

Then trigger the DLT pipeline manually the first time, or wait for the hourly schedule:

**Workflows > midas-otel-scheduled > Run now**

If OTel is disabled (the default), skip this step -- the app works without telemetry.

## Configuration reference

All configuration lives in `databricks.yml` under `targets.<name>.variables`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `otel_enabled` | no | `false` | Enable OTel telemetry collection |
| `otel_warehouse_id` | if OTel on | -- | SQL warehouse ID for OTel telemetry writes (SP) |
| `otel_catalog` | if OTel on | -- | Catalog for OTel tables |
| `serving_endpoint` | no | `databricks-gpt-5-4` | Foundation Model serving endpoint |
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
│   │   │   ├── telemetry.py    # OTel v2 span/log writer (always-on)
│   │   │   └── routes/         # API routes
│   │   └── ui/                 # React frontend (TypeScript + Vite)
│   └── notebooks/
│       ├── setup_otel_v2.py    # Bronze table DDL (run once)
│       └── dlt_pipeline.py     # Silver + Gold DLT transformations
├── .build/                     # Pre-built app (checked into git)
└── setup.sh                    # Optional: install dev dependencies
```
