# DDMA Load Test

Scripts and results from an end-to-end k6 load test against the order/fleet/tracking
flow, run to get real evidence behind an "at scale" claim (the project's default seed
data is 4 orders / 9 vehicles, which is not enough to say anything about scale).

This is independent of the team's Sprint backlog — it was not assigned or reviewed by
the team, just documented here for reproducibility.

## What's here

- `gen_seed.py` — generates bulk seed SQL (load-test users + fleet vehicles) matching
  the app's schema and password hash format (`PasswordHashService`).
- `loadtest.js` — k6 script simulating the real user flow: login → list center
  vehicles → create order → add parcel → pay (assigns a vehicle) → poll tracking 3x
  at 1s intervals (mirrors the frontend's real 3s polling in `TrackingPage.tsx`).

## How to reproduce

Run against an **isolated** test database, not your real dev DB or the shared
docker-compose stack — this test data (2000 users, thousands of vehicles) pollutes
whatever DB it's pointed at and there's no cleanup script.

```bash
# 1. Isolated Postgres on a port that won't collide with a local Postgres install
#    or the project's own docker-compose db (5432)
docker run -d --name ddma-loadtest-db \
  -e POSTGRES_DB=ddma -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=secret \
  -p 5433:5432 postgres:15.2-alpine

# 2. Run the backend locally against it (dev profile re-seeds the base schema/demo
#    data on every start — see root README.md)
cd backend/DeliveryManagement
DATABASE_URL=localhost DATABASE_PORT=5433 DATABASE_USERNAME=postgres DATABASE_PASSWORD=secret \
  ./gradlew bootRun --args="--spring.profiles.active=dev"

# 3. In another terminal: seed bulk load-test data
cd loadtest
python3 gen_seed.py --vehicles-per-bucket 500          # realistic fleet scale
docker exec -i ddma-loadtest-db psql -U postgres -d ddma < loadtest_seed.sql

# 4. Run the load test
k6 run loadtest.js
# or, to save a machine-readable summary:
k6 run --summary-export=results.json loadtest.js

# 5. Clean up when done
docker rm -f ddma-loadtest-db
```

To reproduce the over-fetch finding specifically, generate an inflated fleet on top
(different --tag so device IDs don't collide) and re-run:

```bash
python3 gen_seed.py --users 0 --vehicles-per-bucket 8000 --tag LOADTEST2 --out extra_vehicles.sql
docker exec -i ddma-loadtest-db psql -U postgres -d ddma < extra_vehicles.sql
```

## Methodology

- k6, `ramping-vus` executor: 0→50 VUs (30s) → 50→200 VUs (30s) → hold 200 VUs (1m) →
  ramp down (20s). ~2.5 min per run.
- Each iteration runs the full business flow end-to-end (not isolated endpoint
  hammering), with realistic think-time (`sleep()` between steps, 1s between tracking
  polls to match the real frontend's polling interval).
- 2000 pre-seeded users so concurrent VUs don't collide on the same login.
- Backend run with default (untuned) Spring Boot config — default HikariCP pool,
  default Tomcat thread pool. No JVM/DB tuning was applied.
- Environment: local machine, backend run via `gradlew bootRun` (not the Docker
  image, for faster iteration), against an isolated single-instance Postgres
  container. **This is local single-machine capacity, not production
  infrastructure** — treat the numbers below as "the app can sustain X under this
  local setup," not as a cloud capacity claim.

## Results

### Run 1 — baseline, realistic fleet (500 vehicles per center/type, 3000 total)

| Endpoint | p95 latency |
|---|---|
| login | 64.6 ms |
| create_order | 128.0 ms |
| pay_order | 233.2 ms |
| tracking poll | 12.2 ms |

Throughput: ~52 complete flows/sec, 333 req/s, 7346 iterations completed.

**8.37% of requests failed**, all clustered on `pay_order` returning `409
NO_VEHICLE_AVAILABLE`.

### Bug found #1: fleet vehicles never returned to the pool

`FleetVehicleService.markUnavailable()` is called on payment, but nothing in the
codebase ever marked a vehicle available again after its order was delivered — the
fleet drains monotonically. Invisible with the 9-vehicle demo seed (nobody manually
runs enough orders to notice); surfaces immediately under sustained order volume.

### Run 2 — inflated fleet (17,003 vehicles at one center), to isolate raw capacity

Re-seeded with a much larger fleet specifically to remove "vehicle pool exhaustion"
as a confound and measure pure system capacity. Latency got *worse*, not better:

- p95 jumped to 6–9.6s across endpoints
- throughput collapsed from 52/s to 7.4/s

### Bug found #2: unfiltered fleet fetch

`FleetVehicleRepository.findByCenterId()` has no SQL-level filter on `vehicle_type`
or `available` — it returns the entire vehicle roster for a center, which
`OrderController.payOrder()` then filtered in the JVM with a Java stream just to pick
one row. Confirmed independently with a single idle request (no concurrent load):

```
GET /api/v1/centers/{id}/vehicles   (center with 17,003 vehicles)
HTTP 200   time_total=0.263s   size_download=3,111,621 bytes
```

263ms and 3.1MB to answer "is there an available vehicle" — this is also exactly the
query `payOrder()` ran internally on every payment. Under 200 concurrent VUs, this
compounded into the Run 2 latency collapse.

### Fix

Commit `9c3eca5` (`fix(fleet): release vehicle on delivery, filter vehicle
availability query in SQL`):

- Added `FleetVehicleService.markAvailable()`; `TrackingController` calls it the
  instant an order transitions to `DELIVERED`.
- Added `FleetVehicleRepository.findFirstByCenterIdAndVehicleTypeAndAvailableTrue()`
  (SQL-level filter + `LIMIT 1`) and switched `payOrder()`'s vehicle selection to use
  it instead of fetching the whole fleet.

**Deliberately not changed:** the public `GET /centers/{id}/vehicles` listing
endpoint still returns the full unfiltered roster. Fixing that would change the
response shape (pagination/filtering), which affects the OpenAPI contract and the
frontend (`RecommendationsPage.tsx`) — judged out of scope for a bug-fix pass. It
remains an O(fleet-size) endpoint; fine at realistic fleet sizes, would need
revisiting if the fleet ever actually grew into the thousands per hub.

### Verification after the fix

Single idle request against the same 17,003-vehicle center:

```
before: 263ms / 3.1MB
after:   23.7ms          (10x+ improvement — SQL does the filtering now)
```

Re-ran Run 1's exact scenario (realistic fleet, 200 VUs) for an apples-to-apples
comparison:

| Endpoint | before | after |
|---|---|---|
| pay_order p95 | 233ms | 103ms |
| throughput | 52/s | 60/s |

Existing unit tests: 6 total, 5 passed. The 1 failure (`contextLoads()`) needs a live
Postgres on the default port (5432) with the hardcoded dev credentials — a
pre-existing environment dependency of that test, unrelated to this change.

### A third finding (not "fixed" — a real constraint, not a bug)

Re-running the fixed backend at realistic fleet scale showed a *slightly higher*
failure rate than the original baseline (10.34% vs 8.37%). Not a regression: the
system got faster, so more payment attempts landed in the same 2.5-minute window
(8394 vs 7346 iterations) against the same fixed 3000-vehicle pool, exhausting it
sooner. Once the software-side inefficiency was fixed, the real limiting factor
became fleet turnover: simulated vehicle speeds (15–40 km/h) can't physically keep up
with ~60 orders/sec of demand. That's a legitimate fleet-sizing/business constraint,
not something a query fix or index addresses — left as-is.

## Caveats

- Local single-machine numbers, not a production/cloud capacity claim.
- The inflated 17,003-vehicles-per-center scenario is an artificial stress case to
  surface the query problem, not a realistic fleet size for a real delivery company.
- `GET /centers/{id}/vehicles` remains unfixed by design (see above) — if fleet size
  or request volume against that endpoint grows, it's the next thing to revisit.
