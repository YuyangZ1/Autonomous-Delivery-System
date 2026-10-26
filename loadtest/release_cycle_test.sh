#!/usr/bin/env bash
# Concurrent verification that the "release vehicle on delivery" fix
# (commit 9c3eca5, TrackingController -> FleetVehicleService.markAvailable)
# actually lets a small fleet be reused across many orders, under real
# concurrency -- not just a single manually-walked order.
#
# Unlike loadtest.js, this deliberately sets pickup == dropoff so the first
# tracking poll immediately triggers DELIVERED (see
# TrackingController.getTracking(): dist < 0.002 degrees -> DELIVERED).
# loadtest.js uses random SF-wide pickup/dropoff pairs and only polls
# tracking 3 times, which (at a fixed ~111m-per-poll step) essentially
# never reaches DELIVERED for multi-km pairs -- so it never exercised this
# code path. See release-cycle-test.md for the full writeup.
#
# Design: a deliberately small, fully-controlled vehicle pool (POOL_SIZE).
# Runs ROUNDS sequential rounds of POOL_SIZE *concurrent* full order
# lifecycles each (create -> parcel -> pay -> poll-to-delivery). If release
# works, every round should succeed using the same POOL_SIZE vehicle ids
# recycled each time. If release is broken, only round 1 succeeds and every
# later round fails with 409 (pool stays exhausted).
#
# Prereqs: a backend on localhost:8080 seeded with the base dev seed data
# (alice@example.com / AlicePass123!) plus a clean POOL_SIZE-vehicle DRONE
# pool at Mission Hub -- see release-cycle-test.md "How to reproduce".
#
# Usage: ./release_cycle_test.sh [rounds] [pool_size]

set -e
BASE="${BASE_URL:-http://localhost:8080/api/v1}"
MISSION=c0000003-0000-0000-0000-000000000002
MISSION_LAT=37.7599
MISSION_LNG=-122.4148
ROUNDS="${1:-6}"
POOL_SIZE="${2:-5}"

OUT_DIR="$(mktemp -d)"
echo "raw per-order results -> $OUT_DIR/orders.tsv"
: > "$OUT_DIR/orders.tsv"

TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"identifier":"alice@example.com","password":"AlicePass123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

run_one_order() {
  local round="$1"
  local order_json create_err order_id pay_code track_status

  order_json=$(curl -s -X POST "$BASE/orders" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d "{\"center_id\":\"$MISSION\",\"pickup_address\":\"Mission Hub\",\"pickup_lat\":$MISSION_LAT,\"pickup_lng\":$MISSION_LNG,\"dropoff_address\":\"Mission Hub\",\"dropoff_lat\":$MISSION_LAT,\"dropoff_lng\":$MISSION_LNG}")
  order_id=$(echo "$order_json" | python3 -c "import sys,json;print(json.load(sys.stdin).get('order_id',''))" 2>/dev/null)
  if [ -z "$order_id" ]; then
    echo -e "${round}\tNO_ORDER_ID\t-\t-" >> "$OUT_DIR/orders.tsv"
    return
  fi

  curl -s -X POST "$BASE/orders/$order_id/parcels" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"size_tier":"S","weight_kg":0.5,"fragile":false}' > /dev/null

  pay_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/orders/$order_id/pay" \
    -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"vehicle_type":"DRONE","price_usd":10.0,"eta_minutes":5}')

  track_status="-"
  if [ "$pay_code" = "200" ]; then
    # pickup == dropoff -> dist == 0 -> DELIVERED on the very first poll
    track_status=$(curl -s "$BASE/orders/$order_id/tracking" -H "Authorization: Bearer $TOKEN" \
      | python3 -c "import sys,json;print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
  fi

  echo -e "${round}\t${order_id}\t${pay_code}\t${track_status}" >> "$OUT_DIR/orders.tsv"
}

for round in $(seq 1 "$ROUNDS"); do
  echo "--- round $round: $POOL_SIZE concurrent orders against a $POOL_SIZE-vehicle pool ---"
  for i in $(seq 1 "$POOL_SIZE"); do
    run_one_order "$round" &
  done
  wait
done

echo ""
echo "=== per-round pay success count (expect $POOL_SIZE every round if release+reuse works) ==="
awk -F'\t' '{print $1}' "$OUT_DIR/orders.tsv" | sort -n | uniq -c | while read -r cnt round; do
  succ=$(awk -F'\t' -v r="$round" '$1==r && $3=="200"' "$OUT_DIR/orders.tsv" | wc -l | tr -d ' ')
  echo "round $round: $succ/$cnt paid successfully"
done

echo ""
echo "=== all DELIVERED on first poll? ==="
awk -F'\t' '$3=="200"' "$OUT_DIR/orders.tsv" | awk -F'\t' '{print $4}' | sort | uniq -c

echo ""
echo "results file: $OUT_DIR/orders.tsv"
