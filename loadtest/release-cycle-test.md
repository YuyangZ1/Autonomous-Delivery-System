# Release-cycle concurrency test

Verifies the "release vehicle on delivery" fix (commit `9c3eca5`,
`FleetVehicleService.markAvailable()` called from `TrackingController` when an
order reaches `DELIVERED`) actually works under real concurrency — not just in
a single manually-walked order.

## Why this test exists

A second pair of eyes reviewing this project pointed out that `loadtest.js`'s
concurrent run (see `README.md`) never actually exercises this fix: it picks
pickup/dropoff randomly across all of San Francisco (usually several km apart),
and vehicles in this simulation move a fixed ~111m per `/tracking` call — not
by elapsed real time (`TrackingController`: `step = 0.001 / dist`, a constant
per-call displacement regardless of how much time passed between calls). Only
polling tracking 3 times per order (`loadtest.js`) gets nowhere close to
completing a multi-km delivery. So every number in `README.md` comes from runs
where essentially no order ever reaches `DELIVERED`, and the release code path
never actually ran under that load.

The original verification for this fix was a single order, walked manually:
pickup and dropoff set to the same point (distance 0, delivers on the first
poll), paid, polled once, then checked the database by hand. That confirms the
logic is *correct*, but says nothing about whether it holds up when many
orders are claiming and releasing vehicles from the same pool at the same time.
This test closes that gap.

## Method

- Deliberately small, fully-controlled vehicle pool: disabled every other
  `DRONE` vehicle in the database, then inserted exactly 5 fresh `DRONE`
  vehicles at Mission Hub (tagged `RELEASE-TEST-00`..`04`). A small, closed
  pool makes reuse observable and forces it to happen if the fix works, and
  makes a broken fix immediately obvious (pool exhausted after round 1).
- Pickup == dropoff (both set to Mission Hub's own coordinates), so
  `TrackingController`'s distance check (`dist < 0.002`) is satisfied
  immediately — every order delivers on its very first tracking poll, instead
  of needing dozens of polls like a random SF-wide pair would.
- 6 sequential **rounds**, each firing 5 **concurrent** full order lifecycles
  (login → create order → add parcel → pay → poll tracking once) — one
  lifecycle per pool vehicle per round. Rounds run one after another so a
  round's deliveries (and releases) complete before the next round starts;
  within a round, all 5 requests race each other concurrently, which also
  keeps exercising the atomic-claim fix (`9c3eca5`'s other half) under real
  contention.
- If release+reuse is broken: only round 1 should succeed (5/5), every round
  after that should fail outright (pool stays at 0 available forever).
- If release+reuse works: every round should succeed (5/5), reusing the same
  5 vehicle ids over and over.
- Script: `release_cycle_test.sh` in this directory. Prereqs and exact setup
  commands are in its header comment.

## Results

```
round 1: 5/5 paid successfully
round 2: 5/5 paid successfully
round 3: 5/5 paid successfully
round 4: 5/5 paid successfully
round 5: 5/5 paid successfully
round 6: 5/5 paid successfully

all 30 orders: DELIVERED on the first tracking poll
```

Checked directly against the database afterward:

- **Exactly 5 distinct `fleet_vehicle_id`s** were used across all 30 orders —
  not 30, not some larger number from a broken release path. Each of the 5
  vehicles was used **exactly 6 times** (one per round), confirming genuine
  reuse rather than coincidence.
- All 5 pool vehicles ended the test with `available = true` — nothing got
  stuck "lost" in an unavailable state.
- All 30 orders ended with `status = DELIVERED`.

30 orders served by a pool of 5 vehicles, under real concurrent contention
each round, with every single claim-release-reclaim cycle accounted for
correctly.

## Caveats

- Still a single machine, not production infrastructure — see `README.md`'s
  caveats, which apply here too.
- 6 rounds / 5-way concurrency is a small test by throughput-benchmark
  standards; it's sized to make reuse easy to verify by hand (distinct vehicle
  ids, reuse counts), not to produce a latency/throughput number. For that,
  `README.md`'s 200-VU k6 runs are the right reference — this test answers a
  different question ("does release-then-reuse work at all under
  concurrency"), not "how fast is it."
- Pickup == dropoff is an artificial shortcut to make delivery complete
  immediately; it isn't representative of real order distances. That's
  intentional here — this test isolates the release mechanism, not realistic
  delivery timing.
