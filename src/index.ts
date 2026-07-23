/**
 * Match Engine — Public API
 *
 * This is the single entry point for consuming the engine.
 * Pass a MatchConfig (with seed, home team, away team, pitch, referee)
 * and receive a deterministic MatchResult with events and stats.
 *
 * Example:
 * ```ts
 * import { MatchEngine, MatchConfig } from '@match-engine/core';
 *
 * const engine = new MatchEngine();
 * const result = engine.simulate(config);
 * console.log(`${result.homeScore} - ${result.awayScore}`);
 * ```
 */

// Engine
export { MatchEngine, MatchResult } from "./application/match/engine/MatchEngine";
export { MatchInitializer } from "./application/match/engine/MatchInitializer";
export { SimulationConfig } from "./application/match/engine/SimulationConfig";

// Domain
export {
  Player, PlayerProps, PlayerAttributes, MentalAttributes,
  PhysicalAttributes, TechnicalAttributes, GoalkeepingAttributes, HiddenAttributes,
  PlayerRole, PlayerPosition, PreferredFoot, PlayerPersonality, PlayerRelationship
} from "./domain/player";

export { Team } from "./domain/team";
export { Tactic, TacticProps, TacticalShape, TacticalShapeAssignment, TeamTacticalInstructions } from "./domain/tactics";
export { Pitch } from "./domain/pitch";
export { Referee } from "./domain/referee";
export { Match, MatchConfig, MatchScore } from "./domain/match";
export {
  MatchEvent, GoalEvent, ShotEvent, CardEvent,
  PeriodStartedEvent, PeriodEndedEvent, MatchPeriod, ShotResult, CardType
} from "./domain/match-events";
export { createAttributeValue, createVector2 } from "./domain/common";

// Core simulation state
export { MatchState } from "./core/movement/MatchState";
export { PlayerMatchState } from "./core/movement/PlayerMatchState";
export { BallMatchState, BallState } from "./core/movement/BallMatchState";
export { TeamMatchState } from "./core/movement/TeamMatchState";

// Geometry
export { Vector2 } from "./core/geometry/Vector2";

// Random
export { SeededRandom } from "./core/random/SeededRandom";
export { Random } from "./core/random/Random";
