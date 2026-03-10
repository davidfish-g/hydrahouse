-- Fast lookup column for API key authentication.
-- Stores a SHA-256 hex digest of the API key, replacing the full-table argon2 scan.
ALTER TABLE accounts ADD COLUMN api_key_id TEXT;
CREATE UNIQUE INDEX idx_accounts_api_key_id ON accounts (api_key_id) WHERE api_key_id IS NOT NULL;
