#!/usr/bin/env bash
# Repeated single-request latency sampling for the "list vehicles" vs "pay order"
# endpoints, used to produce the numbers in before-after-comparison.md.
#
# Unlike loadtest.js (concurrent throughput under load), this measures one
# request at a time with no concurrency -- it answers "how fast is a single
# call" with enough repeats to see past normal run-to-run noise, not "how many
# can the system handle at once".
#
# Prereqs (see README.md "How to reproduce" for the full setup):
#   - A backend listening on localhost:8080 (or set BASE_URL)
#   - Seeded with: 1 user via `gen_seed.py --users 1 --vehicles-per-bucket 0`,
#     plus a large fleet at the SoMa center (c0000003-...-001), e.g.
#     `gen_seed.py --users 0 --vehicles-per-bucket 8500 --tag X`
#     (the point of the inflated fleet is to make the query-cost difference
#     visible -- see README.md's over-fetch bug writeup for why)
#
# Usage:
#   ./measure10x.sh list_times.txt pay_times.txt [N]
#
# Writes N raw timings in seconds, one per line, to each output file.
# To compare an old vs. new code version, run this once against each
# (e.g. a `git worktree` checkout of the pre-fix commit on its own port,
# then again against the current code on its own port -- see
# before-after-comparison.md "Method" for exactly how that was done).

set -e
BASE="${BASE_URL:-http://localhost:8080/api/v1}"
CENTER=c0000003-0000-0000-0000-000000000001
CENTER_LAT=37.7785
CENTER_LNG=-122.4056
LIST_OUT="$1"
PAY_OUT="$2"
N="${3:-10}"

TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"identifier":"loadtest_user_00001@example.com","password":"LoadTest123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

: > "$LIST_OUT"
: > "$PAY_OUT"

echo "--- list vehicles: GET /centers/{id}/vehicles x${N} ---"
for i in $(seq 1 "$N"); do
  t=$(curl -s -o /dev/null -w "%{time_total}" "$BASE/centers/$CENTER/vehicles" -H "Authorization: Bearer $TOKEN")
  echo "$t" | tee -a "$LIST_OUT"
done

echo "--- pay order: POST /orders/{id}/pay x${N} (fresh order each time) ---"
for i in $(seq 1 "$N"); do
  ORDER_ID=$(curl -s -X POST "$BASE/orders" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d "{\"center_id\":\"$CENTER\",\"pickup_address\":\"Pickup, SF\",\"pickup_lat\":$CENTER_LAT,\"pickup_lng\":$CENTER_LNG,\"dropoff_address\":\"Dropoff, SF\",\"dropoff_lat\":$CENTER_LAT,\"dropoff_lng\":$CENTER_LNG}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['order_id'])")

  curl -s -X POST "$BASE/orders/$ORDER_ID/parcels" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"size_tier":"S","weight_kg":0.5,"fragile":false}' > /dev/null

  # alternate vehicle type so a single bucket's inventory isn't the bottleneck
  if [ $((i % 2)) -eq 0 ]; then VT="DRONE"; else VT="ROBOT"; fi

  t=$(curl -s -o /dev/null -w "%{time_total}" -X POST "$BASE/orders/$ORDER_ID/pay" \
    -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d "{\"vehicle_type\":\"$VT\",\"price_usd\":10.0,\"eta_minutes\":5}")
  echo "$t" | tee -a "$PAY_OUT"
done
