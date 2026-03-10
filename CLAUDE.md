# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is HydraHouse

Managed Hydra Head orchestration platform for Cardano. Developers create L2 Hydra heads via a REST/WebSocket API; the platform handles node provisioning, key generation, peer networking, lifecycle management, and teardown. Think "Blockfrost for Hydra."

## Build & Development Commands

```bash
# Start Postgres (required for integration tests and running the API)
docker compose -f docker/docker-compose.yml up -d

# Build everything
cargo build --workspace

# Run API server (reads DATABASE_URL from env or .env file)
cargo run -p hh-api

# Run CLI
cargo run -p hh-cli -- <subcommand>

# Run all tests (needs Postgres running)
cargo test --workspace

# Run unit tests only (no DB)
cargo test -p hh-core -p hh-keys

# Run a single test
cargo test -p hh-core -- tests::valid_transitions

# Integration tests (need Postgres)
cargo test -p hh-api --test api_test

# Clippy (CI runs with -Dwarnings, so all warnings are errors)
cargo clippy --workspace --all-targets

# Dashboard (React/Vite/Tailwind 4)
cd dashboard && bun run dev
```

## CI

CI (`RUSTFLAGS="-Dwarnings"`) runs: `cargo check`, `cargo clippy`, `cargo test --workspace`, and `cargo build --release -p hh-api -p hh-cli`. All clippy warnings fail the build.

## Architecture

Rust workspace with 6 crates. The dependency flow is strictly:

```
hh-api (axum server + CLI entry) → hh-orchestrator → hh-keys
    ↓                                    ↓
  hh-db (SQLx/Postgres)             hh-core (domain types, no IO)
```

### Crate roles

- **hh-core**: Pure domain types (no IO). `HeadStatus` state machine, `Network` enum, `AppConfig` (env-based), error types. All other crates depend on this.
- **hh-api**: axum HTTP/WS server. Modules: `handlers/` (REST endpoints), `auth` (API key middleware), `lifecycle` (background WS monitor that auto-advances head state), `ws` (WebSocket proxy to hydra-nodes), `billing` (Stripe integration), `ratelimit`.
- **hh-db**: PostgreSQL repository layer via SQLx. Sub-modules: `accounts`, `heads`, `participants`, `head_events`, `usage`. Migrations live in `/migrations/*.sql` and run automatically on startup.
- **hh-orchestrator**: Provisions hydra-node containers. Two backends behind the `Orchestrator` trait: `DockerOrchestrator` (local dev) and `K8sOrchestrator` (production). Also handles key encryption (`encrypt`) and node auto-funding (`funding`).
- **hh-keys**: Ed25519 key generation for Cardano and Hydra envelope formats, bech32 encoding, transaction building (`tx`).
- **hh-cli**: clap-based CLI binary (`hydrahouse`). Subcommands: create, list, get, close, abort.

### Key patterns

- **Head lifecycle state machine**: `HeadStatus` in `hh-core/src/head.rs` defines valid transitions via `can_transition_to()`. The lifecycle worker in `hh-api/src/lifecycle.rs` connects to hydra-node WebSocket and auto-advances states (Init → Commit → Open, Close → Fanout → teardown).
- **Orchestrator trait**: `hh-orchestrator/src/manager.rs` defines the `Orchestrator` trait. Tests use `MockOrchestrator` (see `hh-api/tests/api_test.rs`).
- **Config from env**: `AppConfig::from_env()` reads env vars (`DATABASE_URL`, `HH_MODE`, `HH_BLOCKFROST_PROJECT_ID`, etc.). `HH_MODE=docker|kubernetes` selects orchestrator backend.
- **Auth**: Bearer token auth with `hh_sk_` prefixed API keys, argon2 hashed. Middleware in `hh-api/src/auth.rs`.
- **OpenAPI**: Generated via utoipa, served at `/api-docs`.

### Other directories

- `sdk/` -- TypeScript SDK for the API (work in progress)
- `deploy/` -- Kubernetes deployment manifests and Helm charts
- `scripts/` -- Utility scripts (seed.sh, e2e-test.sh)

### Dashboard

React 19 + Vite + Tailwind CSS v4 + React Router v7 app in `dashboard/`. Talks to the API server. Pages: Login, HeadsList, HeadDetail, Billing, Docs.

### Database

PostgreSQL 16. Connection string via `DATABASE_URL`. Migrations in `/migrations/` are embedded and run automatically via `hh_db::run_migrations()` on API startup.
