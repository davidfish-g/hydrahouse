#!/usr/bin/env bash
set -euo pipefail

# End-to-end test that exercises the full HydraHouse flow:
#   1. Create a head via the API
#   2. Wait for it to provision (Docker containers)
#   3. Watch the lifecycle progress
#   4. Verify the head opens
#
# Prerequisites:
#   - Docker running
#   - Postgres running (docker compose -f docker/docker-compose.yml up -d)
#   - API server running (cargo run -p hh-api)
#   - Seed script run (bash scripts/seed.sh)

API_URL="${HYDRAHOUSE_API_URL:-http://localhost:3000}"
API_KEY="${HYDRAHOUSE_API_KEY:-hh_sk_testkey_local_dev_001}"

auth_header="Authorization: Bearer $API_KEY"

echo "========================================="
echo " HydraHouse End-to-End Test"
echo "========================================="
echo ""

# Health check
echo "==> Health check..."
health=$(curl -sf "$API_URL/healthz" 2>/dev/null || echo "FAILED")
if echo "$health" | grep -q '"ok"'; then
    echo "    OK"
else
    echo "    FAILED - is the API server running?"
    echo "    Start with: cargo run -p hh-api"
    exit 1
fi

# Pull hydra-node image (if not already present)
echo ""
echo "==> Ensuring hydra-node image is available..."
docker pull ghcr.io/cardano-scaling/hydra-node:1.2.0 2>/dev/null || {
    echo "    Failed to pull image. Check your internet connection."
    exit 1
}

# Create a head
echo ""
echo "==> Creating a 2-participant head on preprod..."
create_resp=$(curl -sf "$API_URL/v1/heads" \
    -H "$auth_header" \
    -H "Content-Type: application/json" \
    -d '{
        "network": "preprod",
        "participants": 2,
        "config": { "contestation_period_secs": 60 }
    }')

head_id=$(echo "$create_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['head_id'])")
status=$(echo "$create_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
ws_url=$(echo "$create_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['ws_url'])")

echo "    Head ID: $head_id"
echo "    Status:  $status"
echo "    WS URL:  $ws_url"

# Poll until the head progresses past provisioning
echo ""
echo "==> Waiting for head to progress..."
for i in $(seq 1 30); do
    sleep 2
    get_resp=$(curl -sf "$API_URL/v1/heads/$head_id" -H "$auth_header" 2>/dev/null || echo '{"status":"unknown"}')
    current_status=$(echo "$get_resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))")
    echo "    [$i] Status: $current_status"

    if [ "$current_status" = "open" ]; then
        echo ""
        echo "========================================="
        echo " HEAD IS OPEN!"
        echo "========================================="
        echo ""
        echo "  Head ID: $head_id"
        echo "  WS URL:  $ws_url"
        echo ""
        echo "  You can connect with:"
        echo "    wscat -c $ws_url"
        echo ""

        # Show full head details
        echo "==> Head details:"
        curl -sf "$API_URL/v1/heads/$head_id" -H "$auth_header" | python3 -m json.tool
        echo ""
        echo "SUCCESS: Full lifecycle test passed!"
        exit 0
    fi

    if [ "$current_status" = "aborted" ] || [ "$current_status" = "unknown" ]; then
        echo ""
        echo "FAILED: Head entered '$current_status' state."
        echo ""
        echo "Check the API server logs for details."
        echo "Also check Docker containers:"
        echo "  docker ps -a --filter 'name=hh-'"
        echo "  docker logs hh-${head_id:0:8}-node-0"
        exit 1
    fi
done

echo ""
echo "TIMEOUT: Head did not open within 60 seconds."
echo "Current state: $current_status"
echo ""
echo "Debug:"
echo "  docker ps -a --filter 'name=hh-'"
echo "  docker logs hh-${head_id:0:8}-node-0"
exit 1
