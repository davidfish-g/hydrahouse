# HydraHouse

Managed Hydra Head orchestration platform for Cardano. Create and manage Hydra L2 heads via a simple REST/WebSocket API.

Blockfrost solved L1 connectivity. HydraHouse solves everything else -- node provisioning, key generation, peer networking, lifecycle management, and teardown.

## How it works

```
POST /v1/heads { "network": "preprod", "participants": 2 }

  1. API creates DB records, transitions head to "provisioning"
  2. Orchestrator generates Cardano + Hydra key pairs per participant
  3. Keys stored as Kubernetes Secrets, Blockfrost creds mounted
  4. hydra-node pods created with peer networking via K8s DNS
  5. Lifecycle worker connects to hydra-node WebSocket
  6. Sends Init -> auto-commits -> head opens
  7. Developer connects via WebSocket proxy, submits L2 transactions
  8. On close: contestation period -> auto-fanout -> teardown
```

## Architecture

```
Developer -> REST/WebSocket API (Rust/axum)
                    |
             Control Plane
             /      |      \
     Orchestrator  Keys  Lifecycle Worker
          |          |         |
     Kubernetes  Ed25519   hydra-node WS
          |                    |
     hydra-node pods -----> Blockfrost (L1)
```

### Crate structure

| Crate | Purpose |
|-------|---------|
| `hh-core` | Domain types, head lifecycle state machine, config, errors |
| `hh-api` | axum HTTP/WebSocket server, auth middleware, lifecycle worker |
| `hh-db` | PostgreSQL repository layer (SQLx) |
| `hh-orchestrator` | K8s pod/service/secret provisioning for hydra-nodes |
| `hh-keys` | Ed25519 key generation (Cardano + Hydra envelope formats) |
| `hh-cli` | Developer CLI (`hydrahouse create/list/get/close/abort`) |

## Local development

### Prerequisites

- Rust (stable)
- Docker & Docker Compose
- A Kubernetes cluster (for orchestration; API starts without it for DB-only testing)

### Start the database

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Configure

```bash
cp .env.example .env
# Edit .env with your Blockfrost project ID, etc.
source .env
```

### Run the API server

```bash
cargo run -p hh-api
```

The server starts on `http://localhost:3000`.

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/api-docs  # OpenAPI spec
```

### Run the CLI

```bash
export HYDRAHOUSE_API_KEY="hh_sk_your_key"

cargo run -p hh-cli -- create --network preprod --participants 2
cargo run -p hh-cli -- list
cargo run -p hh-cli -- get <head-id>
cargo run -p hh-cli -- close <head-id>
```

### Run tests

```bash
# Unit tests (no DB required)
cargo test -p hh-core -p hh-keys

# All tests (integration tests need Postgres running)
cargo test --workspace
```

### Build Docker image

```bash
docker build -f docker/Dockerfile.api -t hydrahouse-api .
```

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/healthz` | No | Health check |
| GET | `/api-docs` | No | OpenAPI 3.0 spec |
| POST | `/v1/heads` | Yes | Create a new Hydra head (triggers provisioning) |
| GET | `/v1/heads` | Yes | List your heads |
| GET | `/v1/heads/:id` | Yes | Get head details + participants |
| POST | `/v1/heads/:id/close` | Yes | Close an open head |
| DELETE | `/v1/heads/:id` | Yes | Abort a head |
| GET | `/v1/heads/:id/ws` | No* | WebSocket proxy to hydra-node |

Auth uses `Authorization: Bearer hh_sk_...` API keys.

## Head lifecycle

```
Requested -> Provisioning -> Initializing -> Committing -> Open -> Closing -> Closed -> FannedOut
                                  |                                  |
                                  +---------> Aborted <--------------+
```

The lifecycle worker automatically advances the state by monitoring hydra-node WebSocket events:
- `HeadIsInitializing` -> auto-commit empty for all participants
- `HeadIsOpen` -> head ready for L2 transactions
- `HeadIsClosed` -> waiting for contestation period
- `ReadyToFanout` -> auto-fanout
- `HeadIsFinalized` -> teardown K8s resources

## License

MIT
