-- Separate API keys from accounts table; add session-based auth for dashboard.

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX idx_api_keys_account_id ON api_keys(account_id);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_id TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Migrate existing keys from accounts
INSERT INTO api_keys (account_id, name, key_hash, key_id, created_at)
SELECT id, 'default', api_key_hash, api_key_id, created_at
FROM accounts WHERE api_key_id IS NOT NULL;

-- Make legacy columns nullable
ALTER TABLE accounts ALTER COLUMN api_key_hash DROP NOT NULL;
