#!/bin/bash
set -e

# ──────────────────────────────────────────────────────────────
# Midas Setup Script
#
# Installs all local prerequisites needed to build and deploy Midas.
# Run this once on a new machine before ./deploy.sh
# ──────────────────────────────────────────────────────────────

echo "==> Checking prerequisites..."

# Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found. Install Python 3.11+ first."
    exit 1
fi
echo "    python3: $(python3 --version)"

# Node.js
if ! command -v node &>/dev/null; then
    echo "ERROR: node not found. Install Node.js 18+ first."
    echo "       https://nodejs.org/ or: brew install node"
    exit 1
fi
echo "    node:    $(node --version)"

# Databricks CLI
if ! command -v databricks &>/dev/null; then
    echo "==> Installing Databricks CLI..."
    brew tap databricks/tap && brew install databricks
else
    echo "    databricks: $(databricks --version)"
fi

# apx CLI
if ! command -v apx &>/dev/null; then
    echo "==> Installing apx CLI..."
    pip install databricks-apx
else
    echo "    apx:    $(apx --version 2>&1 | head -1)"
fi

# npm dependencies (for frontend build)
if [ -d "src/midas/ui" ] && [ -f "src/midas/ui/package.json" ]; then
    echo "==> Installing frontend dependencies..."
    cd src/midas/ui && npm install && cd - > /dev/null
fi

echo ""
echo "==> Setup complete! Next steps:"
echo "    1. Authenticate:  databricks auth login --host <url> --profile <name>"
echo "    2. Configure:     Edit targets in databricks.yml"
echo "    3. Deploy:        ./deploy.sh <target>"
