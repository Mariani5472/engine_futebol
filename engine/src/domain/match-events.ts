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
  readonly purpose: "PROGRESS" | "ESCAPE_PRESSURE" | "CREATE_ANGLE" | "ATTACK_SPACE" | "PROTECT_POSSESSION";
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
  | GoalkeeperSaveEvent
  | ReboundEvent
  | BallDeflectionEvent
  | PassAttemptedEvent
  | PassCompletedEvent
  | CarryStartedEvent
  | CardEvent
  | GoalEvent
  | CornerEvent
  | FoulEvent
  | ThrowInEvent
  | GoalKickEvent;
