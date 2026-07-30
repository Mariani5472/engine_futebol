# Tactical intelligence audit and architecture

## Scope and conclusion

The previous engine contained useful tactical subsystems, but not one tactical
reasoning pipeline. Decisions were locally plausible and collectively fragile.
This refactor introduces a deterministic shared tactical frame without machine
learning or action-specific hard-coded commands.

## Architecture before the refactor

1. `PerceptionSystem` sampled visible entities.
2. `CognitiveSystem` updated decaying memory and a one-step linear prediction.
3. `WorldAwarenessSystem` rebuilt immediate pressure, current passing lanes,
   distance, angle and free space independently for each deciding player.
4. Action evaluators generated scores with their own scales and assumptions.
5. Role, instruction, personality, expected-value and risk modifiers were
   applied sequentially.
6. `CollectiveCoordinationSystem`, `TacticalEngine` and
   `TeamBehaviourSystem` changed movement targets after decisions.

This made the data flow mostly one-way and allowed a movement target chosen by
one subsystem to overwrite a different tactical intention in the same tick.

## Concrete problems found

- `WorldAwarenessSystem.buildPassingLanes()` used the receiver's live current
  position and a static 1.2 m corridor. It did not ask who would arrive first
  when the ball reached the receiver.
- `PredictionSystem` projected one cognitive delta only. It had no common
  0.5/1/2/3 second horizons, acceleration history or reachable area.
- `PassEvaluator`, `DribbleEvaluator` and `ShotEvaluator` used unrelated score
  scales. A pass could win because it accumulated technique, clearance and
  progress bonuses, even when a clear shot had much greater goal value.
- Phase state and physical possession were separate, but the last passer
  fallback could still mask a genuinely contested ball.
- One-two and third-man relationships existed as special nullable fields. They
  were not represented as a general persistent player intent and were not
  visible in the decision report.
- Target deconfliction used only the target's spatial band. It did not respect
  the commitment or priority of the runner already using that space.
- `TeamBehaviourSystem` and `CollectiveCoordinationSystem` could overwrite a
  post-pass run because intention was not re-enforced after collective target
  updates.
- Expected value exposed goal probability, future possession and defensive
  exposure, but did not explicitly simulate arrival margin, receiver pressure,
  lines broken, shot creation or resulting counterattack risk.
- Off-ball decision logging used a different debug sink, so carrier decisions
  were considerably more observable than collective movement.

## Architecture after the refactor

```mermaid
flowchart LR
    P["Perception and memory"] --> S["SpatioTemporalSystem"]
    B["Ball physics and ETA possession"] --> T["TacticalIntelligenceSystem"]
    S --> T
    T --> X["SpaceAnalysisSystem"]
    T --> C["Team tactical context"]
    X --> C
    C --> G["Candidate generation"]
    G --> F["ShortHorizonPredictionSystem"]
    F --> U["TacticalUtilityModel"]
    U --> R["Risk-adjusted selector"]
    R --> I["Persistent player intent"]
    I --> M["Collective reservations and movement"]
    R --> D["Explainable decision report"]
```

Every player deciding in the same cognitive cycle receives the same immutable
`TacticalIntelligenceSnapshot`. It contains:

- position, velocity, acceleration, recent path and 0.5/1/2/3 s predictions;
- time-dependent reachable areas;
- physical/probable/contested possession evidence;
- stable tactical phase with hysteresis;
- current, emerging and closing spaces;
- pass and run lanes with arrival margin;
- overloads, vulnerabilities, rest defence and defensive cover;
- deterministic tactical pattern detections;
- player intentions and collective spatial reservations;
- possible one-twos, third-man connections and triangulations.

## Decision flow

1. Evaluators generate at least one plausible candidate per action family.
2. Cognitive capability controls search depth and bounded deterministic
   evaluation error. It never removes football's basic logic.
3. Each candidate is projected at 0.5, 1, 2 and 3 seconds.
4. The projection estimates execution, possession, territorial gain, lines
   broken, shot creation, goal threat, turnover and counterattack risk.
5. Tactical utility values scoring, chance creation, progression, possession,
   space creation and defensive security.
6. Role, tactical instructions, score, match time, physical condition and
   attributes modify this general utility.
7. The risk selector chooses one candidate.
8. The selected action creates or preserves a causal intention.
9. Collective coordination reserves the intended zone and bends a lower
   priority run away from conflicts.
10. Debug output retains all evaluated candidates, rejected candidates,
    predicted outcomes, utility components and selection reason.

## Old rules adapted

- The last passer no longer overrides an explicit `contested` ETA prediction.
- `controllerId === null` never starts defence by itself.
- Current pass-lane clearance is supplemented by future arrival margin.
- One-two bonuses require a return lane that remains open at arrival.
- Third-man and triangulation opportunities are detected rather than executed
  as guaranteed scripts.
- Post-pass movement is a persistent intent with causal cancellation.
- Continuous carries have an explicit purpose and survive more than one tick.
- Clear shots impose an opportunity cost on unjustified backward recycling;
  a clearly better teammate can still make the pass superior.

## Determinism and human error

Perception horizon, search depth, tactical awareness and evaluation noise are
derived from mental attributes. Evaluation noise is bounded and generated from
player id, tick, action and target, making it reproducible. Lower attributes can
rank two reasonable actions incorrectly; they do not make a player unable to
recognise an open goal.

## Quality metrics

`DecisionQualityMetrics` reports:

- candidate diversity;
- clear-opportunity shot rate;
- progressive-action rate;
- high-risk turnover selection rate;
- explained-selection rate;
- intent-continuity rate;
- phase changes per hundred decisions.

These metrics are included in the final `MatchResult` and complement outcome
calibration. A statistically realistic score line is not proof of intelligent
decisions by itself.

## Remaining modelling limits

- The space field is intentionally coarse (6 by 4) and refreshed at 2.5 Hz;
  perception remains at 5 Hz and physics/locomotion at 20 Hz.
- Future simulation is kinematic and probabilistic; it is not a cloned branch
  of the complete physics engine.
- Body orientation is represented in 2D and aerial duels remain simplified.
- Tactical patterns enrich context; they do not directly command an action.
- Longer multi-pass plans are limited to one-two, third-man and triangle
  horizons. They are re-evaluated continuously rather than guaranteed.
