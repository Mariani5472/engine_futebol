import { Milliseconds, PlayerId, TeamId } from "./common";
export type MatchPeriod = "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "FINISHED";
export type ShotResult = "OFF_TARGET" | "BLOCKED" | "SAVED" | "GOAL";
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
export type MatchEvent =
  | PeriodStartedEvent
  | PeriodEndedEvent
  | ShotEvent
  | CardEvent
  | GoalEvent;