# Performance report

Environment: Node 22 Alpine containers on the local Docker Desktop host. Measurements are development-mode observations, not a hardware-neutral benchmark.

## 2026-07-29 validation

- Full unit suite: 45 suites / 219 tests in 64.994 s (Jest reported time).
- MatchSession integration: 5 passed, 1 intentionally skipped in 47.807 s.
- Browser/server 50x smoke: simulated clock advanced from 00:19.7 to 16:32.9 in about 19.5 real seconds, approximately 50.9 simulated seconds per real second.
- WebSocket remained at the configured snapshot publication rate; the server performed extra fixed 0.05-second updates internally.
- Same-seed speed equivalence is covered for 1x, 2x, 4x, 8x and 50x.
- Official-tick seed-1 calibration after the first spatial migration took 263.9 s and produced 24 shots, 1 on target and 0 goals. After correcting goal-frame aim margin and physical block radius it took 214.5 s and produced 17 shots, 3 on target and 0 goals. This is a recorded calibration regression; a multi-seed retune remains required and must not be hidden by binary outcome probabilities.

The combined `MatchEngine.test.ts` plus `MatchSession.test.ts` command exceeded an external 300-second command limit. Running `MatchSession.test.ts` alone passed. This is recorded as a test-suite throughput issue; it is not reported as a passing integration run.

The optional 108,000-update regulation-match assertion remains behind `RUN_SLOW_SESSION_TESTS=1` and was not run in this validation. Use:

```bash
docker compose run --rm -e RUN_SLOW_SESSION_TESTS=1 engine npm test -- --runInBand tests/integration/MatchSession.test.ts
```

Do not increase the timestep to improve benchmark numbers. Production speed changes update count per real-time interval, never simulation delta.
