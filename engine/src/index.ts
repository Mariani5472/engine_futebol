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
export { RestartSystem } from "./application/match/engine/RestartSystem";
export { GoalkeeperSystem } from "./application/match/goalkeeper/GoalkeeperSystem";
export { MatchEventStore } from "./application/match/analytics/MatchEventStore";
export type { StoredMatchEvent, PossessionInterval, MatchTimelineEntry, EventDerivedTeamReport, EventDerivedPlayerReport, EventDerivedMatchReport } from "./application/match/analytics/MatchEventStore";
export { GoalReplayRecorder } from "./application/match/replay/GoalReplayRecorder";
export type { GoalReplay, ReplayFrame } from "./application/match/replay/GoalReplayRecorder";
export { AssistPolicy } from "./application/match/analytics/AssistPolicy";
export type { AssistPolicyConfig, AssistIntervention } from "./application/match/analytics/AssistPolicy";
export type { SimulationConfig } from "./application/match/engine/SimulationConfig";
export { ENVIRONMENT_VERSIONS, buildExecutionManifest, buildSportingResultHash, verifyExecutionManifest } from "./application/match/engine/ExecutionManifest";
export type { EnvironmentVersions, ExecutionManifest, SportingResultFingerprintInput } from "./application/match/engine/ExecutionManifest";
export type { PlayerActionCommand, PlayerPolicy, PlayerPolicyInput, PlayerPolicyProposal, PlayerPolicyResult, PlayerPolicyWait, PolicyFallback } from "./application/match/policy/PlayerPolicy";
export { HeuristicPlayerPolicy, ScriptedPlayerPolicy, RandomValidPlayerPolicy, ExternalPlayerPolicy, DecisionGatePlayerPolicy } from "./application/match/policy/PlayerPolicies";
export { PlayerPolicyController } from "./application/match/policy/PlayerPolicyController";
export type { PolicyDecisionRecord } from "./application/match/policy/PlayerPolicyController";
export { PLAYER_ACTION_IDS, PLAYER_ACTION_SPACE, PLAYER_ACTION_SPACE_VERSION, PlayerActionSpace } from "./application/match/policy/PlayerActionSpace";
export type { ActionMaskBit, DiscretePlayerAction, PlayerActionId, PlayerActionMask, PlayerActionMaskEntry } from "./application/match/policy/PlayerActionSpace";
export { ACTOR_OBSERVATION_VERSION, PRIVILEGED_CRITIC_OBSERVATION_VERSION, DEBUG_OBSERVATION_VERSION, ACTOR_OBSERVATION_VECTOR_SIZE, PRIVILEGED_CRITIC_VECTOR_SIZE, OBSERVATION_SPACE, ObservationSpace } from "./application/match/observation/ObservationSpace";
export type { ActorEntityObservation, ActorObservation, PrivilegedCriticObservation, DebugObservation } from "./application/match/observation/ObservationSpace";
export { PURE_MATCH_ENVIRONMENT_VERSION, PureMatchEnvironment } from "./application/match/environment/PureMatchEnvironment";
export type { PureMatchEnvironmentOptions, EnvironmentResetResult, EnvironmentStepResult, EnvironmentTransitionInfo } from "./application/match/environment/PureMatchEnvironment";
export { ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION } from "./application/match/scenario/MatchScenario";
export type { MatchScenarioConfig, AttackerVsGoalkeeperScenarioConfig, ScenarioPoint } from "./application/match/scenario/MatchScenario";
export { AttackerVsGoalkeeperEnvironment } from "./application/match/scenario/AttackerVsGoalkeeperEnvironment";
export type { AttackerVsGoalkeeperEnvironmentOptions, AttackerVsGoalkeeperOutcome, AttackerVsGoalkeeperResetResult, AttackerVsGoalkeeperStepResult } from "./application/match/scenario/AttackerVsGoalkeeperEnvironment";
export { DecisionType } from "./application/match/decision/DecisionType";
export { Decision } from "./application/match/decision/Decision";
export { instrumentationProfile, resolveInstrumentation } from "./application/match/instrumentation/TrainingInstrumentation";
export type { InstrumentationProfile, InstrumentationSelection, ResolvedInstrumentation, TrainingInstrumentationConfig } from "./application/match/instrumentation/TrainingInstrumentation";
export { BrowserAnimationScheduler, FixedTimestepLoop } from "./application/match/runtime";
export type {
  AnimationScheduler,
  FixedTimestepLoopOptions,
  RenderTiming,
} from "./application/match/runtime";
export { RoleBehaviourRegistry } from "./application/match/tactical/roles/RoleBehaviourRegistry";
export type { RoleBehaviour, RoleBehaviourResolver, RoleTargetContext } from "./application/match/tactical/roles/RoleBehaviour";
export { TacticalObjective, objectiveForDecision } from "./application/match/decision/TacticalObjective";

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
export { PossessionPredictionSystem } from "./application/match/tactical/PossessionPredictionSystem";
export { ExpectedValueModel } from "./application/match/decision/ExpectedValueModel";
export type { DecisionExpectedValue } from "./application/match/decision/ExpectedValueModel";
export { ShortHorizonPredictionSystem } from "./application/match/decision/ShortHorizonPredictionSystem";
export { TacticalUtilityModel } from "./application/match/decision/TacticalUtilityModel";
export { GoalOpportunityAnalyzer } from "./application/match/decision/GoalOpportunityAnalyzer";
export type { GoalOpportunity } from "./application/match/decision/GoalOpportunityAnalyzer";
export { CognitiveCapabilityResolver } from "./application/match/decision/CognitiveCapabilities";
export type { CognitiveCapabilities } from "./application/match/decision/CognitiveCapabilities";
export { DecisionQualityMetrics } from "./application/match/decision/DecisionQualityMetrics";
export type { DecisionQualityReport } from "./application/match/decision/DecisionQualityMetrics";
export { TacticalIntelligenceSystem } from "./application/match/tactical/intelligence/TacticalIntelligenceSystem";
export { SpatioTemporalSystem } from "./application/match/tactical/intelligence/SpatioTemporalSystem";
export { SpaceAnalysisSystem } from "./application/match/tactical/intelligence/SpaceAnalysisSystem";
export { PlayerIntentSystem } from "./application/match/tactical/intelligence/PlayerIntentSystem";
export { CombinationPlaySystem } from "./application/match/tactical/intelligence/CombinationPlaySystem";
export type {
  DecisionTacticalPhase, PlayerIntent, PlayerIntentType, PlayerSpatioTemporalState,
  ReachableArea, SpaceOpportunity, SpaceKind, TeamTacticalContext,
  TacticalIntelligenceSnapshot, TacticalPattern, TacticalPatternDetection,
  TacticalReservation, TacticalLane, CombinationPlayContext,
  PredictedActionOutcome, TacticalUtility,
} from "./application/match/tactical/intelligence/TacticalIntelligenceTypes";
export type { PossessionPrediction, TeamPossessionState } from "./core/movement/PossessionPrediction";
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
export type { ActionId } from "./domain/common";
export { createGoalFrame } from "./domain/shooting";
export type { ShotExecution, ShotType, ShotLifecycle, ShotFinalOutcome, GoalFrame } from "./domain/shooting";

// Core simulation state
export { MatchState } from "./core/movement/MatchState";
export { PlayerMatchState } from "./core/movement/PlayerMatchState";
export { BallMatchState, BallState } from "./core/movement/BallMatchState";
export { TeamMatchState } from "./core/movement/TeamMatchState";

// Geometry
export { Vector2 } from "./core/geometry/Vector2";
export { Vector3 } from "./core/geometry/Vector3";

// Random
export { SeededRandom } from "./core/random/SeededRandom";
export type { Random } from "./core/random/Random";

// Internal learning baselines and paired evaluation (Phase 8)
export * from "./application/match/evaluation";

// Explainable, reconstructible rewards (Phase 9)
export * from "./application/match/reward";

// Versioned TypeScript-Python training protocol (Phase 10)
export * from "./application/match/protocol";

// Training throughput profiling and scale decisions (Phase 12)
export * from "./application/match/performance";
export { MULTI_AGENT_MATCH_ENVIRONMENT_VERSION, MultiAgentMatchEnvironment } from "./application/match/environment/MultiAgentMatchEnvironment";
export type { MultiAgentBoundary, MultiAgentMatchEnvironmentOptions, MultiAgentRewardComponent, MultiAgentTransitionInfo } from "./application/match/environment/MultiAgentMatchEnvironment";

// Versioned curriculum, promotion gates and deterministic self-play matchmaking (Phase 13)
export * from "./application/match/curriculum";
export { CURRICULUM_SCENARIO_VERSION, createCurriculumScenarioPreset } from "./application/match/scenario/MatchScenario";
export type { CurriculumGoalkeeperMode, CurriculumObjective, CurriculumScenarioConfig, CurriculumScenarioStage } from "./application/match/scenario/MatchScenario";
