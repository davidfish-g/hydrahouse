# HydraHouse

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/davidfish-g/hydrahouse/actions/workflows/ci.yml/badge.svg)](https://github.com/davidfish-g/hydrahouse/actions/workflows/ci.yml)

```bash
curl -X POST https://api.hydrahouse.xyz/v1/heads \
  -H "Authorization: Bearer hh_sk_..." \
  -d '{"network": "preprod", "participants": 2}'
```

## Features

- **One API call** to provision a fully configured Hydra head — no node setup, no config files
- **Auto lifecycle** — heads advance through Init, Commit, Open, Close, and Fanout automatically
- **Real-time WebSocket** streaming of head state and L2 transactions
- **Multi-party** — up to 10 participants with automatic peer discovery
- **Incremental deposits** — add or remove funds from an open head without closing it
- **Multi-network** — preprod, preview, and mainnet with the same API

## Self-hosting

```bash
docker compose -f docker/docker-compose.yml up -d
cp .env.example .env  # fill in your Blockfrost keys, etc.
cargo run -p hh-api
```
