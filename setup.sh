#!/usr/bin/env bash
# setup.sh — First-run setup for PSSCP.
# Generates .env with secure random secrets if it doesn't already exist,
# then starts the stack and waits for it to be ready.
set -euo pipefail

# --- Preflight checks ---
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: '$1' is required but not installed."
    exit 1
  fi
}

check_cmd docker
check_cmd python3

if ! docker compose version &>/dev/null; then
  echo "ERROR: 'docker compose' (v2) is required. Update Docker Desktop or install the compose plugin."
  exit 1
fi

# --- Generate .env if missing ---
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

if [ -f "$ENV_FILE" ]; then
  echo ".env already exists — skipping generation."
else
  echo "Generating $ENV_FILE from $ENV_EXAMPLE ..."

  SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || \
    python3 -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")
  DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(16))")

  sed \
    -e "s|change-me-generate-a-random-64-char-hex-string|${SECRET_KEY}|" \
    -e "s|change-me-generate-with-fernet|${ENCRYPTION_KEY}|" \
    -e "s|POSTGRES_PASSWORD=psscp|POSTGRES_PASSWORD=${DB_PASSWORD}|" \
    "$ENV_EXAMPLE" > "$ENV_FILE"

  echo ".env created with generated secrets."
fi

# --- Start the stack ---
echo ""
echo "Starting PSSCP stack..."
docker compose up -d

# --- Wait for API health ---
echo "Waiting for API to be ready..."
MAX_WAIT=90
WAITED=0
until curl -sf http://localhost:8000/api/v1/system/health >/dev/null 2>&1; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo ""
    echo "ERROR: API did not become healthy after ${MAX_WAIT}s."
    echo "Run 'make logs-api' or 'docker compose logs api' to investigate."
    exit 1
  fi
  printf "."
  sleep 2
  WAITED=$((WAITED + 2))
done

echo ""
echo "PSSCP is ready at http://localhost"
echo "Open the URL above and follow the setup wizard to connect your Proxmox cluster."
