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
 * console.log(result.metrics.totalxG);
 * ```
 */

// Engine
export { MatchEngine } from "./application/match/engine/MatchEngine";
export type { MatchResult } from "./application/match/engine/MatchEngine";
export { MatchSession } from "./application/match/engine/MatchSession";
export type {
  MatchSnapshot,
  PlayerSnapshot,
  BallSnapshot,
} from "./application/match/engine/MatchSession";
export { MatchInitializer } from "./application/match/engine/MatchInitializer";
export type { SimulationConfig } from "./application/match/engine/SimulationConfig";
export { BrowserAnimationScheduler, FixedTimestepLoop } from "./application/match/runtime";
export type {
  AnimationScheduler,
  FixedTimestepLoopOptions,
  RenderTiming,
} from "./application/match/runtime";
export { RoleBehaviourRegistry } from "./application/match/tactical/roles/RoleBehaviourRegistry";
export type { RoleBehaviour, RoleBehaviourResolver, RoleTargetContext } from "./application/match/tactical/roles/RoleBehaviour";

// Metrics (Phase 9)
export type { MatchMetrics } from "./application/match/metrics/MatchMetrics";
export type { TeamMatchMetrics } from "./application/match/metrics/TeamMatchMetrics";
export { MatchMetricsCollector } from "./application/match/metrics/MatchMetricsCollector";
export { TacticalDiagnosticsCollector } from "./application/match/diagnostics/TacticalDiagnosticsCollector";
export type { MatchTacticalDiagnostics, TeamTacticalDiagnostics, AverageRolePosition } from "./application/match/diagnostics/TacticalDiagnosticsCollector";
export { BallTeleportDetector } from "./application/match/diagnostics/BallTeleportDetector";
export type { BallTeleportViolation } from "./application/match/diagnostics/BallTeleportDetector";
export type { PassResolutionRecord, PendingPass, PossessionAcquisitionRecord, PossessionAcquisitionReason } from "./core/movement/BallMatchState";
export { OffensiveFunnelCollector } from "./application/match/diagnostics/OffensiveFunnelCollector";
export { CollectiveCoordinationSystem } from "./application/match/tactical/CollectiveCoordinationSystem";
export type { MatchOffensiveFunnel, TeamOffensiveFunnel, OffensiveFailureReason, GoalContext } from "./application/match/diagnostics/OffensiveFunnelCollector";

// Calibration (Phase 10)
export {
  CalibrationRunner,
  BRASILEIRAO_2025_TARGETS,
  buildCalibrationReport,
  formatCalibrationReport,
  DEFAULT_CALIBRATION_PARAMETERS,
  suggestAdjustments,
} from "./application/match/calibration";
export type {
  CalibrationReport,
  CalibrationRunOptions,
  CalibrationBatchResult,
  CalibrationParameters,
  MetricComparison,
} from "./application/match/calibration";

// Domain
export {
  Player,
} from "./domain/player";
export type {
  PlayerProps, PlayerAttributes, MentalAttributes, PhysicalAttributes,
  TechnicalAttributes, GoalkeepingAttributes, HiddenAttributes, PlayerRole,
  PlayerPosition, PreferredFoot, PlayerPersonality, PlayerRelationship,
} from "./domain/player";

export { Team } from "./domain/team";
export { Tactic } from "./domain/tactics";
export type {
  TacticProps, TacticalShape, TacticalShapeAssignment, TeamTacticalInstructions,
  InPossessionInstructions, OutOfPossessionInstructions, TransitionInstructions,
  OppositionInstructions, OppositionPlayerInstruction, TacticalTempo, TacticalWidth,
  PassingStyle, AttackFocus, DefensiveLineHeight, PressLineHeight, PressingIntensity,
  DefensiveBlock, PressingDirection, GoalkeeperDistribution, TacticalZone,
} from "./domain/tactics";
export { Pitch } from "./domain/pitch";
export { Referee } from "./domain/referee";
export { Match } from "./domain/match";
export type { MatchConfig, MatchScore } from "./domain/match";
export type {
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
export type { Random } from "./core/random/Random";
