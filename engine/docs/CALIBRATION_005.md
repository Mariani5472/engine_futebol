# Official 0.05-second calibration

Reference command:

```bash
npm run calibrate -- --matches 20 --seed 1 --tick 0.05
```

Final deterministic batch (seeds 1–20, 2026-07-29):

| Metric | Target | Observed |
|---|---:|---:|
| Goals | 2.50 | 2.80 |
| Shots | 25.00 | 21.45 |
| Shots on target | 8.80 | 8.10 |
| Corners | 10.50 | 7.00 |
| Fouls | 28.00 | 27.60 |
| Yellow cards | 4.60 | 4.30 |
| Red cards | 0.22 | 0.10 |
| xG | 2.50 | 2.40 |
| Average shot distance | 16.00 m | 12.52 m |

Convergence: **100%** under the declared target tolerances.

Spatial terminal outcomes per match: 0.45 blocked, 11.55 off target, 1.35 woodwork, 5.30 parried, 2.80 goals and **0 unresolved**. Goal distribution: p10 0.9, median 2.5, p90 5.1; zero-goal rate 10%; median shots/on-target 21.5/8.0.

Goalkeeper interventions are counted as saves/on-target only when the projected trajectory intersects the valid goal opening. A defender deflection stays live and may subsequently be saved, miss, strike the frame or score.

The calibration changes continuous spatial parameters (aim dispersion, collision reach, reaction and deflection geometry). It never selects goal/save/on-target as an outcome before ball travel.
