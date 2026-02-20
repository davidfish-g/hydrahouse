#!/usr/bin/env bash
set -euo pipefail

# Seed the database with a test account and API key.
# Requires Postgres to be running.
# Requires the argon2 CLI tool: brew install argon2 / apt install argon2

DB_URL="${DATABASE_URL:-postgres://hydrahouse:hydrahouse@localhost:5432/hydrahouse}"
API_KEY="hh_sk_testkey_local_dev_001"

echo "==> Seeding database at $DB_URL"

# Generate Argon2id hash of the API key.
# If the argon2 CLI is available, use it; otherwise fall back to legacy hex.
if command -v argon2 &>/dev/null; then
    SALT=$(openssl rand -base64 16 | tr -d '=+/' | head -c 16)
    KEY_HASH=$(printf '%s' "$API_KEY" | argon2 "$SALT" -id -e -t 3 -m 16 -p 4)
    echo "==> Using Argon2id hash"
else
    echo "==> WARNING: argon2 CLI not found, falling back to legacy hex hash"
    echo "    Install with: brew install argon2"
    KEY_HASH=$(printf '%s' "$API_KEY" | od -A n -t x1 | tr -d ' \n')
fi

echo "==> Creating test account (hash prefix: ${KEY_HASH:0:24}...)"
psql "$DB_URL" -c "
INSERT INTO accounts (id, email, api_key_hash, plan, created_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'dev@hydrahouse.io',
    '$KEY_HASH',
    'free',
    NOW()
)
ON CONFLICT (api_key_hash) DO NOTHING;
" 2>&1 | grep -v "^$" || true

echo ""
echo "==> Done. Use this API key:"
echo ""
echo "    export HYDRAHOUSE_API_KEY=$API_KEY"
echo ""
