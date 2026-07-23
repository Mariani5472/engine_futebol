import type {
  PlayerMatchState,
} from "./PlayerMatchState";
export type Brand<
  T,
  B extends string
> =
  T & {
    readonly __brand: B;
  };
export type TeamId =
  Brand<
    string,
    "TeamId"
  >;
export type PlayerId =
  Brand<
    string,
    "PlayerId"
  >;
export type MatchId =
  Brand<
    string,
    "MatchId"
  >;
export type RefereeId =
  Brand<
    string,
    "RefereeId"
  >;
export type LanguageCode =
  Brand<
    string,
    "LanguageCode"
  >;
export type Seconds =
  Brand<
    number,
    "Seconds"
  >;
export type Milliseconds =
  Brand<
    number,
    "Milliseconds"
  >;
export type AttributeValue =
  Brand<
    number,
    "AttributeValue"
  >;
export interface Vector2 {
  readonly x:
  number;
  readonly y:
  number;
}
export interface Rect {
  readonly x:
  number;
  readonly y:
  number;
  readonly width:
  number;
  readonly height:
  number;
}
export interface CircleObstacle {
  position:
  Vector2;
  radius:
  number;
}
export interface PossessionCandidate {
  player:
  PlayerMatchState;
  distance:
  number;
  score:
  number;
}
export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}
export function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}
export function createAttributeValue(
  value: number
): AttributeValue {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 20
  ) {
    throw new Error(
      `AttributeValue must be an integer between 1 and 20. ` +
      `Received: ${value}`
    );
  }
  return value as AttributeValue;
}
export function createVector2(
  x: number,
  y: number
): Vector2 {
  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y)
  ) {
    throw new Error(
      "Vector2 coordinates must be finite numbers."
    );
  }
  return {
    x,
    y,
  };
}