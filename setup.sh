#!/usr/bin/env bash
# setup.sh — First-run setup for PSSCP.
# Generates .env with secure random secrets if it doesn't already exist,
# then starts the stack.
set -euo pipefail

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

if [ -f "$ENV_FILE" ]; then
  echo ".env already exists — skipping generation."
else
  echo "Generating $ENV_FILE from $ENV_EXAMPLE ..."

  # Require Python 3 for secret generation
  if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 is required to generate secrets. Install it and re-run."
    exit 1
  fi

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
  echo ""
  echo "  SECRET_KEY and ENCRYPTION_KEY have been auto-generated."
  echo "  Review .env before going to production."
  echo ""
fi

echo "Starting PSSCP stack..."
docker compose up -d "$@"

echo ""
echo "Done. Access the portal at http://localhost:80"
