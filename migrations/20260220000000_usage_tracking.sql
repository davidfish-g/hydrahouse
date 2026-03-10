-- Usage tracking for billing and analytics.

CREATE TABLE usage_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID NOT NULL REFERENCES accounts(id),
    head_id     UUID REFERENCES heads(id),
    metric      TEXT NOT NULL,  -- 'head_hour', 'l2_tx', 'commit'
    quantity    BIGINT NOT NULL DEFAULT 1,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_account_id ON usage_records(account_id);
CREATE INDEX idx_usage_metric ON usage_records(metric);
CREATE INDEX idx_usage_recorded_at ON usage_records(recorded_at);
