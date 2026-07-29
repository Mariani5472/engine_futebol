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
- `RestartSystem`: throw-in, corner and goal-kick placement/restrictions.
- `KickoffSystem`: kickoff/half-time kickoff constraints.
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

Completed in this refactor: spatial shots; frame/post/crossbar outcomes; defender blocks; dynamic goalkeeper intent and reaction; catches/parries; live rebounds; centralized non-kickoff restarts; normalized event store; event-derived reports; timeline; recorded replay; 50x scheduling contract; API and web replay integration.

Still deliberately open:

- airborne collision volumes use simplified player capsules;
- spin and aerodynamics are deterministic approximations, not fluid simulation;
- assists use the latest physically completed pass to the scorer inside a 10-second window; competition-specific attribution rules remain configurable future work;
- one-two state is intentionally short-lived and currently recognizes short progressive pass-and-move combinations; more complex third-man patterns remain future work;
- collective probable-possession exposes receiver/defender arrival estimates, confidence and interception risk, but aerial-duel quality is still a simplified extension point;
- goal-net deformation and replay camera direction are presentation concerns and are not simulated.

These limitations must not be hidden by visual animation or random score correction.
