# Match event contract

Every normalized stored event contains `id`, `matchId`, `timestamp`, `matchMinute`, `type`, optional team/player/position fields, and `metadata`. IDs are deterministic within the event sequence.

Events caused by an accepted physical action also contain `actionId`. One action may produce several events, but an event belongs to at most one action. Period, clock and other system events intentionally have no `actionId`.

`MatchEventStore` is the authoritative journal and enforces idempotency by event ID:

- appending the same event again is a no-op;
- reusing an ID with different content is an invariant violation;
- sequence numbers are assigned only to accepted unique events.

All public football counts in `MatchResult.metrics` and `MatchResult.analytics` are projections of this journal. `MatchMetricsCollector` is retained only as a deprecated compatibility class and is not used by `MatchEngine` as a parallel source of statistics. Tactical spatial diagnostics remain sampled separately because they describe continuous state rather than count football events.

Core causal events:

| Event | Meaning |
|---|---|
| `PASS_ATTEMPTED` | Ball was kicked toward an intended receiver. |
| `PASS_COMPLETED` | Intended receiver obtained physical control. |
| `PASS_INTERCEPTED` | Another player obtained physical control. |
| `CARRY_STARTED` | Controlled ball movement began. |
| `CARRY_ENDED` | Continuous carry reached its target or was interrupted, with origin and terminal reason. |
| `POSSESSION_CHANGED` | Physical control changed, including previous player, reason, ball speed and contact position. |
| `TACKLE` | A real tackle duel occurred; `successful` states whether control was won. |
| `SHOT_STARTED` / `SHOT_TAKEN` | A spatial shot execution was created. |
| `SHOT_ON_TARGET` | Trajectory reached the goal opening before final resolution. |
| `SHOT_OFF_TARGET` | Ball crossed outside the goal frame or left through touch before reaching it. |
| `SHOT_BLOCKED` | Defender collided with the travelled segment. |
| `WOODWORK` | Post or crossbar changed the trajectory. |
| `GOALKEEPER_SAVE` | Goalkeeper physically caught or parried the ball. |
| `REBOUND` | Ball remains live after an incomplete intervention. |
| `BALL_DEFLECTION` | Contact changed ball direction. |
| `GOAL` | Complete ball crossed the goal plane inside the frame. |
| `THROW_IN`, `CORNER`, `GOAL_KICK` | Centralized restart was awarded. |
| `SHOT_RESOLVED` | Terminal, joinable shot diagnostic with intent, execution error, goalkeeper reaction/interception and final outcome. |

Possession intervals are derived from physical ownership changes and closed by player change, team change, contested ball, or period end. Team and player reports aggregate only the stored event stream plus sampled travelled distance. Reports include period and zone splits, progressive/final-third/box passes, chances, xG, shot distance, assists, saves, restarts, discipline, tackles, interceptions, recoveries, possession losses and duels.

The timeline is a presentation projection for goals, cards, saves, periods, substitutions, penalties and disallowed goals. Goal entries set `replayAvailable=true` only when a recorded replay exists; clicking a replay must request `/matches/:id/replays/:goalEventId`. The complete final archive is available from `GET /matches/:id/report`.

Assist attribution is performed by `AssistPolicy`. The policy has a maximum pass age and independent switches for defender deflections, goalkeeper parries and woodwork rebounds. Any intervening controlled possession invalidates the previous pass.

The normative counting rules and invariants are documented in [MatchStatisticsDefinitions.md](./MatchStatisticsDefinitions.md).
