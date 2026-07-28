# Match Engine

A deterministic football match simulation engine written in TypeScript. Implements player AI (perception → cognition → decision → action), physics, tactical behaviour, referee logic, event streaming, and match reporting — with no frontend dependency.

## Project Overview

The engine simulates a full 90-minute football match tick by tick. Each tick runs:
1. **Perception** — what each player can currently see
2. **Cognition** — noise/error applied to raw perception
3. **Awareness/Memory** — updating each player's mental model
4. **Decision** — utility + risk evaluation selects an action
5. **Action** — action executed and resolved
6. **Physics** — ball trajectory, bounce, friction
7. **Team Behaviour** — collective shape, marking, pressing
8. **Referee** — foul detection, cards, set-pieces
9. **Events** — serialisable event stream updated
10. **Match State** — world state advanced for next tick

## Stack

- **Language:** TypeScript 5
- **Runtime:** Node.js 20
- **Test framework:** Jest + ts-jest
- **Build:** `tsc`

## Commands

| Command | Purpose |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run all tests |
| `npm run test:watch` | Watch mode tests |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | Type-check without emitting |

## Directory Structure

```
src/
  core/
    geometry/       # Vector2, Distance, Angle, LineOfSight, etc.
    movement/       # MatchState, PlayerMatchState, BallMatchState, PossessionSystem
    pitch/          # PitchGrid, PitchZone, PositionZoneResolver
    random/         # SeededRandom (deterministic RNG)
  domain/           # Player, Team, Tactics, Referee, Match, Ball types
  application/
    match/
      perception/   # PerceptionSystem — raw visibility
      cognitive/    # NoiseSystem, CognitiveSystem — cognitive errors
      awareness/    # MemorySystem, MemoryDecay, PlayerAwareness
      decision/     # DecisionSystem, utility, risk, personality, evaluators
tests/
  unit/             # Unit tests per module
  integration/      # Cross-layer integration tests
  scenario/         # Scenario-based tests (player under pressure, etc.)
  determinism/      # Same seed → same result
  montecarlo/       # Statistical validation over many simulations
```

## Roadmap Status

- ✅ Phase 1: Domain (Player, Team, Attributes, Tactics)
- ✅ Phase 2: Geometry & Pitch
- ✅ Phase 3: Movement & Possession
- ✅ Phase 4: Perception & Cognition
- 🧠 Phase 5: Decision Layer (partial — personality & integration incomplete)
- ⬜ Phase 6: Action Layer
- ⬜ Phase 7: Ball Physics
- ⬜ Phase 8: Tactical Engine
- ⬜ Phase 9: Team Behaviour
- ⬜ Phase 10: Referee
- ⬜ Phase 11: Match Flow
- ⬜ Phase 12: Event Engine
- ⬜ Phase 13: Match Report
- ⬜ Phase 14: Simulation Polish
- ⬜ Phase 15: Engine Validation
- ⬜ Phase 16: Pre-Release Refinement

## User Preferences

- Work language: English; user may write in Portuguese.
- Scope is **engine only** — no frontend, no REST API, no database, no UI.
- Prefer correctness and architectural coherence over speed of implementation.
- Avoid arbitrary magic constants — use calibrated probability curves.
- Engine must be deterministic: same seed + same initial state = same match.
