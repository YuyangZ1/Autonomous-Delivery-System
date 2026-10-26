# Before/after comparison: fleet-vehicle query fix (commit `9c3eca5`)

Follow-up to the main load test (see `README.md`). The original single-sample
numbers quoted in the commit message (263ms → 23.7ms) accidentally compared two
*different* endpoints rather than the same endpoint before/after. This note
corrects that with a proper same-endpoint, repeated-sample comparison.

## What was wrong with the original "263ms → 23.7ms" number

- 263ms was `GET /api/v1/centers/{id}/vehicles` (the vehicle **listing** endpoint,
  used by the frontend's vehicle-selection page) — this endpoint's code was never
  changed by the fix.
- 23.7ms was `POST /api/v1/orders/{orderId}/pay` (the **payment** endpoint, which
  internally picks a vehicle) — this is the endpoint the fix actually changed.

So the original number compared an unfixed endpoint's "before" cost against a
fixed endpoint's "after" cost — not a valid before/after pair. This file redoes
it correctly: the *same* endpoint, pre-fix code vs post-fix code, each sampled
10 times instead of once.

## Method

**Isolating "before" code.** The working copy on disk is the fixed (current)
code — there's no way to run "the old version" from it directly. Used
`git worktree add /tmp/ddma-prefix-check 07a4078` (`07a4078` is the commit
immediately before the fix, `9c3eca5^`) to check out the pre-fix snapshot into a
separate directory without touching the main checkout at all.

**Isolating the database.** Each code version (old, new) got its own disposable
Postgres container on its own port (`5436` for old, `5437` for new) — never the
project's shared docker-compose DB, never a local Postgres install, never reused
between the two runs. Each was seeded fresh and discarded after.

**Keeping the "exam question" identical.** Both runs seeded the exact same
scenario: 1 login-capable test user, and an inflated fleet of 17,003 vehicles at
the SoMa center (8,500 per vehicle-type bucket) — the same artificial scale used
in the original test to make the query-cost difference visible.

**Measuring.** For each of the 4 conditions (old-code × list, old-code × pay,
new-code × list, new-code × pay), ran 10 single-request samples with `curl -w
"%{time_total}"` — curl's own end-to-end request timer, not a manually eyeballed
stopwatch. `GET /centers/{id}/vehicles` has no side effects, so it was just
called 10 times in a row. `POST /orders/{id}/pay` consumes a vehicle and changes
order state, so each of its 10 samples created a fresh order (create → add
parcel → pay) first, alternating `ROBOT`/`DRONE` so neither bucket's inventory
was a bottleneck. The actual sampling script is `measure10x.sh` in this
directory — see its header comment for prereqs and usage; it was run once
against the old-code backend and once against the new-code backend.

```bash
./measure10x.sh old_list_times.txt old_pay_times.txt   # against the 07a4078 worktree backend
./measure10x.sh new_list_times.txt new_pay_times.txt   # against the current code's backend
```

**Cleanup.** After each code version's 10×2 samples, killed the backend process,
removed its Postgres container, and (for the old-code run) removed the git
worktree — restoring everything to exactly how it was before the test.

## Results (10 samples each, single request, no concurrency)

| Condition | mean | median | min | max | stdev |
|---|---|---|---|---|---|
| 选车 `GET /centers/{id}/vehicles` — **old code** | 228.8ms | 224.2ms | 206.9ms | 269.3ms | 20.3ms |
| 选车 `GET /centers/{id}/vehicles` — **new code** | 260.0ms | 246.5ms | 208.7ms | 388.7ms | 54.4ms |
| 派车 `POST /orders/{id}/pay` — **old code** | 220.3ms | 220.1ms | 208.7ms | 236.5ms | 9.2ms |
| 派车 `POST /orders/{id}/pay` — **new code** | 20.4ms | 18.2ms | 10.8ms | 51.5ms | 11.5ms |

Raw samples (ms):

```
选车, old:  269.3, 229.3, 239.5, 243.0, 211.0, 219.2, 206.9, 246.2, 210.3, 213.5
选车, new:  277.7, 306.9, 388.7, 253.8, 221.5, 257.6, 239.2, 233.3, 208.7, 212.4
派车, old:  226.1, 211.3, 236.5, 208.7, 214.1, 220.6, 226.5, 229.1, 210.5, 219.7
派车, new:   51.5,  21.1,  20.7,  10.8,  18.7,  17.7,  17.5,  12.7,  19.9,  13.2
```

## Interpretation

- **选车 (listing endpoint): no real difference, as expected.** Old mean 228.8ms
  vs new mean 260.0ms — the ranges overlap heavily (old 206.9–269.3ms, new
  208.7–388.7ms) and the gap is well within normal run-to-run noise (JVM
  warm-up, OS/disk cache state). This is the expected outcome for an endpoint
  whose code was never touched by the fix — it's a sanity check, not a finding.

- **派车 (pay endpoint): a real, clean, non-overlapping difference.** Old mean
  220.3ms (range 208.7–236.5ms, tight — stdev 9.2ms) vs new mean 20.4ms (range
  10.8–51.5ms). The two ranges don't overlap at all (old minimum 208.7ms is
  higher than new maximum 51.5ms) — this is now a solid, same-endpoint,
  apples-to-apples result: **~10.8x faster on average**, not a single noisy
  sample.

This supersedes the single-sample "263ms → 23.7ms" claim in the original commit
message / README — that number's direction (big improvement) was directionally
right, but it compared the wrong pair of things. The number to actually cite is
**220.3ms → 20.4ms on `POST /orders/{id}/pay`, same endpoint, 10 samples each
side**.

## Caveats (same as the main test)

- Still single-machine, no concurrency — these are idle, one-request-at-a-time
  numbers, not a load-test throughput claim (see `README.md` for the 200-VU
  concurrent results, which are a separate, already-apples-to-apples
  comparison: pay_order p95 233ms → 103ms at realistic fleet scale).
- 10 samples is enough to see that the two distributions don't overlap, but it's
  still a small sample — treat the stdev figures as indicative, not rigorous
  statistical inference.
- `GET /centers/{id}/vehicles` remains unfixed in the current code (see
  `README.md`) — its numbers here are a control, not a result to report as an
  improvement.
