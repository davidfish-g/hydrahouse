CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE accounts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT,
    api_key_hash TEXT NOT NULL UNIQUE,
    plan        TEXT NOT NULL DEFAULT 'free',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE heads (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id        UUID NOT NULL REFERENCES accounts(id),
    network           TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'requested',
    participant_count INTEGER NOT NULL,
    config_json       JSONB NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at         TIMESTAMPTZ
);

CREATE INDEX idx_heads_account_id ON heads(account_id);
CREATE INDEX idx_heads_status ON heads(status);

CREATE TABLE participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    head_id         UUID NOT NULL REFERENCES heads(id) ON DELETE CASCADE,
    slot_index      INTEGER NOT NULL,
    cardano_address TEXT,
    keys_secret_ref TEXT,
    commit_status   TEXT NOT NULL DEFAULT 'pending',
    UNIQUE(head_id, slot_index)
);

CREATE INDEX idx_participants_head_id ON participants(head_id);

CREATE TABLE head_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    head_id      UUID NOT NULL REFERENCES heads(id) ON DELETE CASCADE,
    event_type   TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_head_events_head_id ON head_events(head_id);
CREATE INDEX idx_head_events_created_at ON head_events(created_at);
