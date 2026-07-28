export interface Point { readonly x: number; readonly y: number }
export interface PlayerSnapshot extends Point {
  readonly id: string;
  readonly number: number;
  readonly team: "HOME" | "AWAY";
}
export interface MatchSnapshot {
  readonly type: "snapshot";
  readonly matchId: string;
  readonly sequence: number;
  readonly time: number;
  readonly status: "RUNNING" | "PAUSED";
  readonly phase: "READY" | "KICKOFF_PASS" | "RECEIVED" | "OPEN_PLAY";
  readonly players: readonly PlayerSnapshot[];
  readonly ball: Point;
}
