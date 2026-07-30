# Tactical intelligence acceptance matrix

| Area | Deterministic coverage |
|---|---|
| Collective possession | Safe pass remains `offensiveBallFlight`; physical interception evidence starts `defensiveTransition` |
| Phase stability | A transient contested frame is absorbed by 0.25 s hysteresis |
| Space-time | Recent trajectories, 0.5/1/2/3 s projection, reachable areas and future spaces are asserted |
| Goal orientation | A free carrier facing goal recognises the opportunity and normally selects `SHOT` |
| Intent | Intention survives ordinary ticks and cancels on confirmed possession change |
| Coordination | Existing press/cover/shadow, rest-defence and channel deconfliction suites remain active; reservations now use commitment priority |
| Combination play | One-two return requires a future-clear lane; third-man and triangulation detectors expose completion probability |
| Explainability | Candidate utility, prediction, rejection reason, phase, intent and selection reason are retained |
| Human variation | Cognitive search depth and deterministic bounded error derive from mental attributes |
| Reproducibility | Existing seed determinism and batch/incremental equivalence suites remain mandatory |

## Validation commands

```bash
npm run typecheck
npm test -- --runInBand tests/unit/tactical tests/unit/decision tests/unit/action
npm test -- --runInBand tests/determinism/MatchDeterminism.test.ts
npm run calibrate -- --matches 20 --tick 0.05
```

## Latest calibration evidence

The first complete post-refactor 20-seed run completed in 1,247 seconds:

- goals: 2.70;
- shots: 18.45;
- shots on target: 8.70;
- corners: 7.80;
- fouls: 24.00;
- yellow cards: 4.00;
- red cards: 0.15;
- xG: 1.69;
- average shot distance: 14.69 m;
- unresolved shots: 0.

Eight of nine metrics passed. Shots missed the accepted lower boundary by 0.30
per match (18.45 versus 18.75). A minimal cooldown change from 110 to 105
seconds was then applied. A new 20-seed run exceeded the execution timeout,
exposing a performance regression that must be profiled separately; it did not
produce a statistical report and is not presented as successful evidence.
