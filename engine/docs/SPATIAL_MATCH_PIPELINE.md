# Spatial match pipeline

## Diagnostic of the previous architecture

The old shot action decided `on target`, `saved` and `goal` when the player's action executed. The ball animation followed that result afterward, so the goalkeeper, posts, defenders and goal line were not causal participants. A goal also triggered the kickoff immediately. This produced visually contradictory outcomes and made replay or event-derived analytics unreliable.

The concrete causes were:

- binary shot resolution before spatial ball travel;
- goalkeeper probability instead of time-to-intercept and reach;
- two notions of ball position (logical outcome and visual animation);
- score/restart mutation inside the shooting action;
- incomplete event vocabulary for pass, shot, save, rebound and deflection;
- statistics incremented by subsystems instead of rebuilt from normalized events;
- no retained frames for replay;
- restarts split across action and physics code.

## Refactored causal flow

```text
Decision(SCORE_GOAL)
  -> ShotAction creates ShotExecution
  -> BallPhysicsSystem advances a 3D trajectory at fixed 0.05 s
  -> segment collision may block or deflect
  -> GoalkeeperSystem chooses position, reaction time and interception target
  -> physics resolves catch/parry only when the goalkeeper arrives in time
  -> posts/crossbar may change trajectory
  -> GOAL only after the complete ball crosses the goal plane
  -> score changes
  -> delayed centralized kickoff
```

`ShotExecution` retains origin, intended and actual targets, initial velocity, type, foot, pressure, posture, quality, curve, expected arrival, lifecycle and final outcome. `GoalFrame` represents the goal line, opening, crossbar, net depth and ball radius.

The authoritative ball is the only ball used by rules and snapshots. Rebounds and parries remain live. Replay records state frames and never reruns intelligence.

## Systems and ownership

- `ShotAction`: intent and initial physical conditions only.
- `BallPhysicsSystem`: ball travel, collision, goal plane and final shot outcome.
- `GoalkeeperSystem`: positioning and movement intention, not save probability.
- `RestartSystem`: authoritative facade for kickoff, throw-in, corner and goal-kick placement/restrictions.
- `KickoffSystem`: internal kickoff choreography used through `RestartSystem`.
- `MatchEventStore`: normalized event stream, possession intervals, timeline and reports.
- `GoalReplayRecorder`: five-second pre-roll and three-second post-roll at 1x.
- `MatchSession`: fixed-step public API; speed controls real-time scheduling only.

## Invariants

1. A shot starts as `IN_FLIGHT`; it cannot score in `ShotAction`.
2. A goal requires the complete ball to cross the goal line inside the frame.
3. Possession cannot move the ball to a player.
4. A parry or deflection leaves the ball active.
5. A restart taker cannot take a second touch before another player.
6. Simulation speed never changes the 0.05-second timestep.
7. Reports and timeline consume stored events rather than hidden counters.

## Migration status and known limitations

Completed in this refactor: spatial shots; frame/post/crossbar outcomes; defender blocks that remain physical threats; dynamic goalkeeper intent, aerial target, timed reach and recovery; catches/parries; live rebounds; continuous typed carries; all restarts behind one facade; normalized possession/duel event store; complete event-derived reports; timeline; recorded replay with camera and controls; configurable causal assists; explicit score/time-aware expected-value decision layer with rejected alternatives; one-two, third-man, overlap/underlap and box combinations; aerial/body/first-touch possession prediction; 50x scheduling contract; API report/replay integration and web replay integration.

Still deliberately open:

- airborne collision uses time-expanded, attribute-scaled 2D reach volumes. Articulated 3D limbs are intentionally outside this 2D engine's fidelity boundary;
- spin and aerodynamics are deterministic approximations, not fluid simulation;
- assist policy is configurable for age, defender deflection, goalkeeper parry and woodwork; it intentionally rejects intervening controlled possession;
- a future coach-authoring language may compose the implemented one-two, third-man, overlap, underlap and box-occupation primitives; it is not required for their runtime behaviour;
- collective probable-possession includes ETA, body orientation, incoming speed, first touch and aerial reach, but does not simulate articulated jumping contacts;
- goal-net deformation and replay camera direction are presentation concerns and are not simulated.

These limitations must not be hidden by visual animation or random score correction.
