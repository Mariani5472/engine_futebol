# Performance report

Environment: Node 22 Alpine containers on the local Docker Desktop host. Measurements are development-mode observations, not a hardware-neutral benchmark.

## 2026-07-29 final validation

- Full unit suite after completion work: 49 suites / 231 tests in 42.088 s (Jest reported time).
- Isolated `MatchEngine.test.ts`: 7/7 passed in 171.528 s at its diagnostic 2-second tick.
- Full `MatchSession.test.ts`, including the optional regulation assertion: 6/6 passed in 275.154 s. Exactly 108,000 calls to `advance(0.05)` produced 5,400 simulated seconds and sequence 108,000.
- Browser/server 50x smoke: simulated clock advanced from 00:19.7 to 16:32.9 in about 19.5 real seconds, approximately 50.9 simulated seconds per real second.
- WebSocket remained at the configured snapshot publication rate; the server performed extra fixed 0.05-second updates internally.
- Same-seed speed equivalence is covered for 1x, 2x, 4x, 8x and 50x.
- The final official-tick batch of 20 matches took 738.5 s and converged 100%. A single match in the same `tsx` calibration runtime takes roughly 40–65 seconds on this host, down from 214–264 seconds during the first spatial migration.
- Perception/cognition runs at 5 Hz while physics, locomotion and control remain at 20 Hz. Decisions still occur on their one/two-second cadence.
- `MatchSession.advance()` avoids materializing discarded snapshots. The API performs multiple fixed advances for speed and serializes only the 20 Hz network frame.
- Timeline entries are indexed when events are appended rather than rescanning the complete event store every tick.

## Tactical-intelligence refactor

- The first complete 20-seed run with the shared space-time context took
  1,247 seconds.
- A later repeat exceeded the external execution timeout and returned no
  statistical report. It is treated as a performance regression, not as a
  successful calibration run.
- Perception remains at 5 Hz, the shared 6x4 tactical field runs at 2.5 Hz and
  physics/locomotion remain at 20 Hz.
- The next optimization target is profiling lane/combination construction,
  followed by incremental spatial indexing and dirty-zone recomputation.

The optional assertion remains behind `RUN_SLOW_SESSION_TESTS=1` because `ts-jest` instrumentation took about 307 seconds for the regulation match even though the production `tsx` runtime is substantially faster. Use:

```bash
docker compose run --rm -e RUN_SLOW_SESSION_TESTS=1 engine npm test -- --runInBand tests/integration/MatchSession.test.ts
```

Do not increase the timestep to improve benchmark numbers. Production speed changes update count per real-time interval, never simulation delta.
