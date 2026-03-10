ALTER TABLE accounts ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email) WHERE email IS NOT NULL;
