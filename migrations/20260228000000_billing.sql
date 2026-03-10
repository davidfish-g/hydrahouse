-- Billing: Stripe customer, plan status, and subscription tracking.
-- Usage is reported via Stripe Meter Events API (no subscription item IDs needed).

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_stripe_customer_id ON accounts(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
