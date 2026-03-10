-- Add index on sessions.account_id for faster lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON sessions(account_id);
