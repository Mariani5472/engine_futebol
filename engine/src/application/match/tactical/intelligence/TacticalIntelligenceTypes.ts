import type { Vector2 } from "../../../../core/geometry/Vector2";
import type { DecisionType } from "../../decision/DecisionType";

export type DecisionTacticalPhase =
  | "establishedAttack"
  | "offensiveBallFlight"
  | "attackingTransition"
  | "contestedBall"
  | "defensiveTransition"
  | "establishedDefense"
  | "restart";

export type PlayerIntentType =
  | "continueCarry"
  | "completeOneTwo"
  | "attackSpace"
  | "supportCarrier"
  | "overlap"
  | "underlap"
  | "provideWidth"
  | "thirdManRun"
  | "attackFarPost"
  | "counterpress"
  | "protectZone"
  | "receiveBall";

export type IntentCancelCondition =
  | "possessionChanged"
  | "opportunityGone"
  | "spaceOccupied"
  | "ballTrajectoryChanged"
  | "higherPriorityThreat"
  | "riskIncreased"
  | "expired";

export interface PlayerIntent {
  readonly type: PlayerIntentType;
  readonly targetPlayerId?: string;
  readonly targetPosition?: Vector2;
  readonly startedAt: number;
  readonly expiresAt: number;
  readonly confidence: number;
  readonly commitment: number;
  readonly possessionTeamId?: string;
  readonly ballMotionId?: string;
  readonly cancelConditions: readonly IntentCancelCondition[];
  readonly reason: string;
}

export interface ReachableArea {
  readonly center: Vector2;
  readonly radiusAtHalfSecond: number;
  readonly radiusAtOneSecond: number;
  readonly radiusAtTwoSeconds: number;
  readonly radiusAtThreeSeconds: number;
}

export interface PlayerSpatioTemporalState {
  readonly playerId: string;
  readonly teamId: string;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly acceleration: Vector2;
  readonly bodyOrientation: number;
  readonly recentTrajectory: readonly Vector2[];
  readonly predictedTrajectory: Readonly<Record<"0.5" | "1" | "2" | "3", Vector2>>;
  readonly tacticalRole: string;
  readonly currentIntent?: PlayerIntent;
  readonly estimatedReachableArea: ReachableArea;
}

export type SpaceKind =
  | "currentlyFree"
  | "emerging"
  | "closing"
  | "progressionLane"
  | "betweenLines"
  | "behindDefence"
  | "weakSide"
  | "shootingZone"
  | "crossingZone"
  | "turnoverDanger"
  | "secondBall";

export interface SpaceOpportunity {
  readonly id: string;
  readonly kind: SpaceKind;
  readonly center: Vector2;
  readonly radius: number;
  readonly availableFrom: number;
  readonly availableUntil: number;
  readonly occupationRisk: number;
  readonly defensivePressure: number;
  readonly progressionValue: number;
  readonly shotCreationValue: number;
  readonly possessionValue: number;
  readonly reachablePlayers: readonly string[];
}

export type TacticalPattern =
  | "highPress"
  | "counterpress"
  | "lowBlock"
  | "midBlock"
  | "counterAttack"
  | "patientBuildUp"
  | "directAttack"
  | "wideOverload"
  | "centralOverload"
  | "switchOpportunity"
  | "overlap"
  | "underlap"
  | "thirdManRun"
  | "restDefense";

export interface TacticalPatternDetection {
  readonly pattern: TacticalPattern;
  readonly confidence: number;
  readonly involvedPlayers: readonly string[];
  readonly affectedZone: string;
  readonly evidence: readonly string[];
}

export interface TacticalReservation {
  readonly playerId: string;
  readonly type: "occupyZone" | "attackSpace" | "provideWidth" | "pressTarget" | "coverZone";
  readonly target: Vector2;
  readonly priority: number;
  readonly expiresAt: number;
}

export interface CombinationPlayContext {
  readonly type: "oneTwo" | "thirdMan" | "triangulation";
  readonly initiatorId: string;
  readonly receiverId: string;
  readonly thirdPlayerId?: string;
  readonly availableReturnLane: boolean;
  readonly defenderDisplaced: boolean;
  readonly progressionGain: number;
  readonly completionProbability: number;
  readonly expiresAt: number;
}

export interface TacticalLane {
  readonly fromPlayerId: string;
  readonly toPlayerId?: string;
  readonly target: Vector2;
  readonly arrivalMargin: number;
  readonly progression: number;
  readonly clearAtArrival: boolean;
}

export interface TeamTacticalContext {
  readonly teamId: string;
  readonly currentPhase: DecisionTacticalPhase;
  readonly possessionState: string;
  readonly possessionConfidence: number;
  readonly occupiedZones: Readonly<Record<string, number>>;
  readonly overloadedZones: readonly string[];
  readonly vulnerableZones: readonly string[];
  readonly spaces: readonly SpaceOpportunity[];
  readonly passingLanes: readonly TacticalLane[];
  readonly runningLanes: readonly TacticalLane[];
  readonly progressionRoutes: readonly TacticalLane[];
  readonly defensiveCover: { readonly playersBehindBall: number; readonly compactness: number };
  readonly restDefense: { readonly protected: boolean; readonly coveringPlayerIds: readonly string[] };
  readonly activeTacticalPatterns: readonly TacticalPatternDetection[];
  readonly reservations: readonly TacticalReservation[];
  readonly combinations: readonly CombinationPlayContext[];
}

export interface TacticalIntelligenceSnapshot {
  readonly generatedAt: number;
  readonly players: ReadonlyMap<string, PlayerSpatioTemporalState>;
  readonly teams: ReadonlyMap<string, TeamTacticalContext>;
}

export interface PredictedActionOutcome {
  readonly actionType: DecisionType;
  readonly targetId?: string;
  readonly horizons: readonly number[];
  readonly possessionProbability: number;
  readonly successfulExecutionProbability: number;
  readonly territorialProgression: number;
  readonly defensiveLinesBroken: number;
  readonly shotCreationProbability: number;
  readonly expectedGoalThreat: number;
  readonly turnoverProbability: number;
  readonly counterattackRisk: number;
  readonly receiverPressure?: number;
  readonly receiverBodyOrientation?: number;
  readonly spaceCreationValue: number;
  readonly explanation: readonly string[];
}

export interface TacticalUtility {
  readonly goalValue: number;
  readonly chanceCreationValue: number;
  readonly progressionValue: number;
  readonly possessionValue: number;
  readonly spaceCreationValue: number;
  readonly defensiveSecurityValue: number;
  readonly turnoverRisk: number;
  readonly counterattackRisk: number;
  readonly executionRisk: number;
  readonly total: number;
}
