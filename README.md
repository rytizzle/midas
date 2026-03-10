# Midas

AI-powered metadata generator for Unity Catalog tables and Genie rooms. Midas profiles your data, generates descriptions using Foundation Models, and applies them back to Unity Catalog -- with full OTel v2 observability built in.

Built with [apx](https://github.com/databricks-solutions/apx) (FastAPI + React + shadcn/ui).

## What it does

1. **Browse** catalogs, schemas, and tables via Unity Catalog
2. **Profile** tables to understand data distributions and patterns
3. **Generate** table and column descriptions using an LLM (Claude via Foundation Model API)
4. **Apply** generated metadata back to Unity Catalog
5. **Observe** every operation via OTel v2 telemetry written to Delta tables and processed through a DLT pipeline

## Architecture

```
Databricks App (FastAPI + React)
  |-- /api/catalog/*       Browse UC catalogs/schemas/tables (OBO auth)
  |-- /api/profiling/*     Profile table data via SQL warehouse
  |-- /api/metadata/*      Generate descriptions via Foundation Model API
  |-- /api/apply/*         Write metadata back to UC
  |-- /api/genie/*         Browse and link Genie rooms
  +-- telemetry.py         Async OTel v2 span/log writer -> Delta tables

OTel Pipeline (DLT Serverless)
  Bronze: spans, logs, metrics     <- written by app at runtime
  Silver: parsed, cleaned, enriched
  Gold:   service health, operation perf, error analysis, LLM usage
```

## Tables created

### Bronze (`{otel_catalog}.{otel_raw_schema}`)

| Table | Written by | Content |
|-------|-----------|---------|
| `spans` | App at runtime | Traced API calls -- route, duration, status, parent/child spans |
| `logs` | App at runtime | Explicit log entries -- errors, warnings, info |
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
  - Foundation Model API enabled (serving endpoint, e.g. `databricks-claude-sonnet-4-5`)

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
      catalog: my_catalog              # catalog the app browses
      warehouse_id: abc123def456       # SQL warehouse ID
      # serving_endpoint: databricks-claude-sonnet-4-5  # default
      # otel_enabled: "true"                            # default
      # otel_catalog: my_catalog                        # defaults to catalog
      # otel_raw_schema: otel_raw                       # default
      # otel_observability_schema: otel_observability   # default
```

Only `catalog` and `warehouse_id` are required. Everything else has defaults.

### 3. Deploy

```bash
./deploy.sh my-env
```

This single command will:
- Build the frontend and Python wheel (`apx build`)
- Deploy all DAB resources (app, schemas, DLT pipeline, jobs)
- Configure OBO authentication scopes and app resources (SQL warehouse, serving endpoint)
- Grant the app's service principal permissions on OTel schemas
- Deploy the app code

### 4. Run the OTel setup job

After the first deploy, run the bronze table setup job once from the Databricks UI:

**Workflows > midas-otel-setup-bronze > Run now**

This creates the empty bronze tables. After that, the app writes telemetry automatically.

### 5. Run the DLT pipeline

Trigger the pipeline manually the first time, or wait for the hourly schedule:

**Workflows > midas-otel-scheduled > Run now**

## Configuration reference

All configuration lives in `databricks.yml` under `targets.<name>.variables`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `catalog` | yes | `midas_catalog` | Unity Catalog catalog the app browses |
| `warehouse_id` | yes | -- | SQL warehouse ID for queries and telemetry |
| `serving_endpoint` | no | `databricks-claude-sonnet-4-5` | Foundation Model serving endpoint |
| `otel_enabled` | no | `true` | Enable/disable OTel telemetry writes |
| `otel_catalog` | no | same as `catalog` | Catalog for OTel tables |
| `otel_raw_schema` | no | `otel_raw` | Schema for bronze OTel tables |
| `otel_observability_schema` | no | `otel_observability` | Schema for silver/gold DLT tables |

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

The deploy script wraps `databricks bundle deploy` with two additional steps that can't be handled by DAB today:

1. **OBO scopes** -- The Terraform provider wipes `user_api_scopes` on every deploy, so the script re-applies them via REST API
2. **SP grants** -- The auto-created service principal name contains a space, which Terraform can't resolve, so grants are applied via SQL

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
│   │   │   ├── telemetry.py    # OTel v2 span/log writer
│   │   │   └── routes/         # API routes
│   │   └── ui/                 # React frontend (TypeScript + Vite)
│   └── notebooks/
│       ├── setup_otel_v2.py    # Bronze table DDL (run once)
│       └── dlt_pipeline.py     # Silver + Gold DLT transformations
└── .build/                     # Generated by apx build (gitignored)
```
