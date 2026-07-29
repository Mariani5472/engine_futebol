# Match event contract

Every normalized stored event contains `id`, `matchId`, `timestamp`, `matchMinute`, `type`, optional team/player/position fields, and `metadata`. IDs are deterministic within the event sequence.

Core causal events:

| Event | Meaning |
|---|---|
| `PASS_ATTEMPTED` | Ball was kicked toward an intended receiver. |
| `PASS_COMPLETED` | Intended receiver obtained physical control. |
| `PASS_INTERCEPTED` | Another player obtained physical control. |
| `CARRY_STARTED` | Controlled ball movement began. |
| `SHOT_STARTED` / `SHOT_TAKEN` | A spatial shot execution was created. |
| `SHOT_ON_TARGET` | Trajectory reached the goal opening before final resolution. |
| `SHOT_OFF_TARGET` | Ball crossed outside the goal frame. |
| `SHOT_BLOCKED` | Defender collided with the travelled segment. |
| `WOODWORK` | Post or crossbar changed the trajectory. |
| `GOALKEEPER_SAVE` | Goalkeeper physically caught or parried the ball. |
| `REBOUND` | Ball remains live after an incomplete intervention. |
| `BALL_DEFLECTION` | Contact changed ball direction. |
| `GOAL` | Complete ball crossed the goal plane inside the frame. |
| `THROW_IN`, `CORNER`, `GOAL_KICK` | Centralized restart was awarded. |

Possession intervals are derived from physical ownership changes and closed by player change, team change, contested ball, or period end. Team and player reports aggregate only the stored event stream plus sampled travelled distance.

The timeline is a presentation projection. Goal entries set `replayAvailable=true` only when a recorded replay exists; clicking a replay must request `/matches/:id/replays/:goalEventId`.

