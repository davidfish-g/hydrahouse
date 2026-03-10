# @hydrahouse/sdk

TypeScript SDK for the HydraHouse API — manage Cardano Hydra heads.

Zero dependencies. Works with Node.js 18+ and modern browsers.

## Install

```bash
bun add @hydrahouse/sdk
# or
npm install @hydrahouse/sdk
```

## Quick Start

```typescript
import { HydraHouseClient } from "@hydrahouse/sdk";

const client = new HydraHouseClient({
  baseUrl: "http://localhost:3000",
  apiKey: "hh_sk_...",
});

// Create an account (no auth required)
const { account_id, api_key } = await client.createAccount();

// List heads
const { heads } = await client.listHeads();

// Create a new Hydra head
const head = await client.createHead({
  network: "preprod",
  participants: 2,
  config: { contestation_period_secs: 60 },
});

// Get head details
const detail = await client.getHead(head.head_id);

// Submit an L2 transaction
await client.submitTx(head.head_id, "84a400...");

// Get L2 UTxO snapshot
const { utxo } = await client.getSnapshot(head.head_id);

// Connect to the Hydra node via WebSocket
const ws = client.connectWebSocket(head.head_id);
ws.onmessage = (event) => console.log(JSON.parse(event.data));

// Close or abort a head
await client.closeHead(head.head_id);
await client.abortHead(head.head_id);
```

## Error Handling

All API methods throw `HydraHouseError` on non-2xx responses:

```typescript
import { HydraHouseError } from "@hydrahouse/sdk";

try {
  await client.getHead("nonexistent");
} catch (err) {
  if (err instanceof HydraHouseError) {
    console.error(err.status, err.body);
  }
}
```
