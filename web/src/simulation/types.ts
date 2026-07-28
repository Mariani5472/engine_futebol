export interface Point { readonly x: number; readonly y: number }
export interface PlayerSnapshot extends Point {
  readonly id: string;
  readonly number: number;
  readonly team: "HOME" | "AWAY";
}
export interface MatchSnapshot {
  readonly time: number;
  readonly players: readonly PlayerSnapshot[];
  readonly ball: Point;
}

export function interpolatePoint(previous: Point, current: Point, alpha: number): Point {
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
  };
}
