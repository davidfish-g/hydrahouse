-- Prepaid balance model: accounts have a balance_cents that gets debited on usage.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance_cents BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS balance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    amount_cents BIGINT NOT NULL,  -- positive = credit, negative = debit
    balance_after BIGINT NOT NULL,
    description TEXT NOT NULL,
    stripe_session_id TEXT,
    head_id UUID REFERENCES heads(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_tx_account ON balance_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_balance_tx_created ON balance_transactions(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_tx_stripe_session ON balance_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
