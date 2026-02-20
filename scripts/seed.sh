#!/usr/bin/env bash
set -euo pipefail

# Seed the database with a test account and API key.
# Requires Postgres to be running.

DB_URL="${DATABASE_URL:-postgres://hydrahouse:hydrahouse@localhost:5432/hydrahouse}"
API_KEY="hh_sk_testkey_local_dev_001"

echo "==> Seeding database at $DB_URL"

# Compute the same hex hash as Rust's hash_api_key()
KEY_HASH=$(printf '%s' "$API_KEY" | od -A n -t x1 | tr -d ' \n')

echo "==> Creating test account (hash: ${KEY_HASH:0:20}...)"
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
