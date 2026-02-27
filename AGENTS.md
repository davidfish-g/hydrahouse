# AGENTS.md

## Cursor Cloud specific instructions

### Overview

HydraHouse is a managed Hydra Head orchestration platform for Cardano, structured as a Rust Cargo workspace with 6 crates plus a React/Vite frontend dashboard. See `README.md` for architecture and API reference.

### Services

| Service | Port | How to start |
|---------|------|-------------|
| PostgreSQL | 5432 | `sudo docker compose -f docker/docker-compose.yml up -d` |
| hh-api (backend) | 3000 | `DATABASE_URL=postgres://hydrahouse:hydrahouse@localhost:5432/hydrahouse cargo run -p hh-api` |
| Dashboard (frontend) | 5173 | `cd dashboard && bun run dev` |

### Key caveats

- **Docker daemon**: This environment requires manually starting Docker before using it: `sudo containerd & sleep 2 && sudo dockerd &`. There is no systemd.
- **Rust toolchain**: The project needs Rust stable >= 1.85 (for `edition2024` support in dependencies). The VM default may be older; run `rustup default stable` if `cargo build` fails with `edition2024` errors.
- **OpenSSL**: `libssl-dev` must be installed for the `openssl-sys` crate to compile. The update script handles this.
- **Environment variables**: The API requires `DATABASE_URL`. A `.env` file in the project root is loaded by `dotenvy` at startup. Minimum: `DATABASE_URL=postgres://hydrahouse:hydrahouse@localhost:5432/hydrahouse`.
- **Migrations**: Handled automatically by `hh-api` on startup (`hh_db::run_migrations`). No manual migration step needed.
- **Head lifecycle**: Creating a head via the API triggers Docker container provisioning for hydra-nodes. Without a real Docker socket or hydra-node image, heads will transition to "aborted" - this is expected in dev.

### Standard commands

Defined in `README.md` and CI (`.github/workflows/ci.yml`):
- **Lint**: `cargo clippy --workspace --all-targets`
- **Test**: `cargo test --workspace` (needs Postgres running)
- **Unit tests only**: `cargo test -p hh-core -p hh-keys` (no DB required)
- **Build**: `cargo build --workspace`
- **Frontend type-check**: `cd dashboard && npx tsc --noEmit`
- **Frontend dev**: `cd dashboard && bun run dev`
