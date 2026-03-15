#!/bin/sh
# Wrapper entrypoint for hydra-node on Railway.
# Writes env vars to files that hydra-node expects, then execs hydra-node.

set -eu

DATA_DIR="/data"
mkdir -p "$DATA_DIR/persistence"

# Write signing keys
printf '%s' "$CARDANO_SK" > "$DATA_DIR/cardano.sk"
printf '%s' "$HYDRA_SK"   > "$DATA_DIR/hydra.sk"

# Write Blockfrost project ID
printf '%s' "$BLOCKFROST_PROJECT_ID" > "$DATA_DIR/blockfrost.txt"

# Write protocol parameters
printf '%s' "$PROTOCOL_PARAMS" > "$DATA_DIR/protocol-parameters.json"

# Write peer verification keys from numbered env vars
i=0
while true; do
    eval "vk=\${CARDANO_PEER_VK_${i}:-}"
    if [ -z "$vk" ]; then break; fi
    printf '%s' "$vk" > "$DATA_DIR/cardano-peer-${i}.vk"
    i=$((i + 1))
done

i=0
while true; do
    eval "vk=\${HYDRA_PEER_VK_${i}:-}"
    if [ -z "$vk" ]; then break; fi
    printf '%s' "$vk" > "$DATA_DIR/hydra-peer-${i}.vk"
    i=$((i + 1))
done

# shellcheck disable=SC2086
exec hydra-node $HYDRA_NODE_ARGS
