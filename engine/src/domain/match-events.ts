import { Milliseconds, PlayerId, TeamId } from "./common";

export type MatchPeriod = "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "FINISHED";

export type ShotResult = "IN_FLIGHT" | "OFF_TARGET" | "BLOCKED" | "SAVED" | "GOAL";

export type CardType = "YELLOW" | "RED";

export interface BaseMatchEvent {
  readonly id: string;
  readonly timestamp: Milliseconds;
  readonly period: MatchPeriod;
}

export interface PeriodStartedEvent extends BaseMatchEvent {
  readonly type: "PERIOD_STARTED";
  readonly periodName: "FIRST_HALF" | "SECOND_HALF";
}

export interface PeriodEndedEvent extends BaseMatchEvent {
  readonly type: "PERIOD_ENDED";
  readonly periodName: "FIRST_HALF" | "SECOND_HALF";
}

export interface ShotEvent extends BaseMatchEvent {
  readonly type: "SHOT";
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly result: ShotResult;
  readonly targetX: number;
  readonly targetY: number;
}

export interface CardEvent extends BaseMatchEvent {
  readonly type: "CARD";
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly cardType: CardType;
  readonly reason: string;
}

export interface GoalEvent extends BaseMatchEvent {
  readonly type: "GOAL";
  readonly teamId: TeamId;
  readonly scorerId: PlayerId;
  readonly assistId: PlayerId | null;
}

/** Awarded to the attacking team when the ball goes out for a corner. */
export interface CornerEvent extends BaseMatchEvent {
  readonly type: "CORNER";
  readonly teamId: TeamId;
}

/** Soft or hard foul by the offending team (with or without a card). */
export interface FoulEvent extends BaseMatchEvent {
  readonly type: "FOUL";
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
}

export interface ShotStartedEvent extends BaseMatchEvent {
  readonly type: "SHOT_STARTED";
  readonly shotId: string;
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly originX: number;
  readonly originY: number;
  readonly intendedTargetY: number;
  readonly intendedTargetZ: number;
  readonly shotType: string;
}

export interface ShotTakenEvent extends BaseMatchEvent {
  readonly type: "SHOT_TAKEN";
  readonly shotId: string;
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly actualTargetY: number;
  readonly actualTargetZ: number;
  readonly initialSpeed: number;
  readonly executionQuality: number;
  readonly pressureLevel: number;
}

export interface ShotOutcomeEvent extends BaseMatchEvent {
  readonly type: "SHOT_ON_TARGET" | "SHOT_OFF_TARGET" | "SHOT_BLOCKED" | "WOODWORK";
  readonly shotId: string;
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly positionX: number;
  readonly positionY: number;
  readonly height: number;
  readonly outcome: string;
}

export interface ShotResolvedEvent extends BaseMatchEvent {
  readonly type:"SHOT_RESOLVED";
  readonly shotId:string;
  readonly teamId:TeamId;
  readonly playerId:PlayerId;
  readonly originX:number; readonly originY:number;
  readonly intendedTargetY:number; readonly intendedTargetZ:number;
  readonly actualTargetY:number; readonly actualTargetZ:number;
  readonly initialSpeed:number; readonly executionError:number;
  readonly goalkeeperId:PlayerId|null;
  readonly goalkeeperInitialX:number|null; readonly goalkeeperInitialY:number|null;
  readonly goalkeeperDecision:string|null; readonly goalkeeperReactionTime:number|null;
  readonly interceptionX:number|null; readonly interceptionY:number|null; readonly interceptionHeight:number|null;
  readonly finalOutcome:string;
}

export interface GoalkeeperSaveEvent extends BaseMatchEvent {
  readonly type: "GOALKEEPER_SAVE";
  readonly shotId: string;
  readonly teamId: TeamId;
  readonly goalkeeperId: PlayerId;
  readonly shooterId: PlayerId;
  readonly caught: boolean;
  readonly interceptionX: number;
  readonly interceptionY: number;
  readonly interceptionHeight: number;
}

export interface ReboundEvent extends BaseMatchEvent {
  readonly type: "REBOUND";
  readonly shotId: string;
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly positionX: number;
  readonly positionY: number;
  readonly source: "GOALKEEPER" | "DEFENDER" | "WOODWORK";
}

export interface BallDeflectionEvent extends BaseMatchEvent {
  readonly type: "BALL_DEFLECTION";
  readonly shotId: string;
  readonly deflectorId: PlayerId | null;
  readonly contactX: number;
  readonly contactY: number;
  readonly contactHeight: number;
  readonly previousTargetX: number;
  readonly previousTargetY: number;
  readonly newTargetX: number;
  readonly newTargetY: number;
}

export interface PassAttemptedEvent extends BaseMatchEvent {
  readonly type: "PASS_ATTEMPTED";
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly receiverId: PlayerId;
  readonly originX: number;
  readonly originY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly passKind: "PASS" | "CROSS" | "GOALKEEPER_DISTRIBUTION";
}

export interface PassCompletedEvent extends BaseMatchEvent {
  readonly type: "PASS_COMPLETED" | "PASS_INTERCEPTED";
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly receiverId: PlayerId;
  readonly controllingPlayerId: PlayerId;
  readonly forwardGain: number;
}

export interface CarryStartedEvent extends BaseMatchEvent {
  readonly type: "CARRY_STARTED";
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly originX: number;
  readonly originY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly desiredSpeed: number;
  readonly controlMode: "CLOSE" | "NORMAL" | "SPRINT";
  readonly purpose: "PROGRESS" | "ESCAPE_PRESSURE" | "CREATE_ANGLE" | "ATTACK_SPACE" | "PROTECT_POSSESSION";
}

export interface CarryEndedEvent extends BaseMatchEvent {
  readonly type: "CARRY_ENDED";
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly originX: number;
  readonly originY: number;
  readonly positionX: number;
  readonly positionY: number;
  readonly reason: "TARGET_REACHED" | "ACTION_CHANGED" | "POSSESSION_LOST";
}

export interface PossessionChangedEvent extends BaseMatchEvent {
  readonly type: "POSSESSION_CHANGED";
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly previousPlayerId: PlayerId | null;
  readonly reason: string;
  readonly positionX: number;
  readonly positionY: number;
  readonly ballSpeed: number;
}

export interface TackleEvent extends BaseMatchEvent {
  readonly type: "TACKLE";
  readonly teamId: TeamId;
  readonly playerId: PlayerId;
  readonly opponentId: PlayerId;
  readonly successful: boolean;
}

/** Optional competition events are part of the normalized contract even when a
 * particular match configuration has no substitutions, VAR or penalties. */
export interface NamedMatchEvent extends BaseMatchEvent {
  readonly type: "OFFSIDE" | "SUBSTITUTION" | "PENALTY" | "GOAL_DISALLOWED";
  readonly teamId: TeamId;
  readonly playerId?: PlayerId;
  readonly secondaryPlayerId?: PlayerId;
  readonly reason?: string;
}

export interface ThrowInEvent extends BaseMatchEvent {
  readonly type: "THROW_IN";
  readonly teamId: TeamId;
}

export interface GoalKickEvent extends BaseMatchEvent {
  readonly type: "GOAL_KICK";
  readonly teamId: TeamId;
}

export type MatchEvent =
  | PeriodStartedEvent
  | PeriodEndedEvent
  | ShotEvent
  | ShotStartedEvent
  | ShotTakenEvent
  | ShotOutcomeEvent
  | ShotResolvedEvent
  | GoalkeeperSaveEvent
  | ReboundEvent
  | BallDeflectionEvent
  | PassAttemptedEvent
  | PassCompletedEvent
  | CarryStartedEvent
  | CarryEndedEvent
  | PossessionChangedEvent
  | TackleEvent
  | NamedMatchEvent
  | CardEvent
  | GoalEvent
  | CornerEvent
  | FoulEvent
  | ThrowInEvent
  | GoalKickEvent;
