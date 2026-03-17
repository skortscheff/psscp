#!/usr/bin/env bash
# update.sh — Pull latest changes and redeploy PSSCP with zero downtime.
set -euo pipefail

echo "==> Pulling latest changes..."
git pull

echo "==> Rebuilding images..."
docker compose build

echo "==> Restarting services..."
docker compose up -d

echo "==> Waiting for API to be healthy..."
MAX_WAIT=60
WAITED=0
until curl -sf http://localhost:8000/api/v1/system/health >/dev/null 2>&1; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: API did not become healthy after ${MAX_WAIT}s."
    echo "Run 'make logs-api' to investigate."
    exit 1
  fi
  printf "."
  sleep 2
  WAITED=$((WAITED + 2))
done

echo ""
echo "Done. PSSCP is running at http://localhost:80"
