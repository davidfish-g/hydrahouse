-- Passkey credentials (one account can have multiple passkeys)
CREATE TABLE passkey_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    credential_id BYTEA NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL DEFAULT 'Passkey',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_passkey_account ON passkey_credentials(account_id);

-- Wallet links (one account can have multiple wallets across chains)
CREATE TABLE wallet_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    chain TEXT NOT NULL,          -- 'evm', 'cardano', 'solana'
    address TEXT NOT NULL,        -- normalized address
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(chain, address)
);
CREATE INDEX idx_wallet_account ON wallet_links(account_id);

-- Temp challenge storage for passkeys and wallet auth (cleaned up on expiry)
CREATE TABLE auth_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge TEXT NOT NULL UNIQUE,
    state JSONB NOT NULL,         -- webauthn state or wallet metadata
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
