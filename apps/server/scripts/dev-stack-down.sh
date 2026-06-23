#!/usr/bin/env bash
# Stop the local backend stack started by dev-stack.sh.
set -euo pipefail
cd "$(dirname "$0")/.." # -> apps/server

# Stop the host API (if running) and the docker services.
pkill -f "bun run --watch src/index.ts" 2>/dev/null || true
docker compose down
echo "✔ backend stopped (pg + zero-cache down, API killed). Volumes kept."
