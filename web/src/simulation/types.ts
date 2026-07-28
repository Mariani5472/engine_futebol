export interface Point { readonly x: number; readonly y: number }
export interface BallPoint extends Point {
  readonly height?: number;
  readonly motionKind?: string | null;
  readonly hasExplicitEffect?: boolean;
}
export interface PlayerSnapshot extends Point {
  readonly id: string;
  readonly number: number;
  readonly team: "HOME" | "AWAY";
  readonly hasBall?: boolean;
  readonly targetPosition?: Point;
  readonly tacticalAnchorPosition?: Point;
  readonly role?: string;
}
export interface TeamTacticalDiagnostics {
  readonly averageLineHeight: { readonly defence:number; readonly midfield:number; readonly attack:number };
  readonly blockWidth:number; readonly blockDepth:number;
  readonly defenceMidfieldDistance:number; readonly midfieldAttackDistance:number;
  readonly averagePlayersAheadOfBall:number; readonly finalThirdEntries:number;
  readonly penaltyAreaEntries:number; readonly progressiveRuns:number;
  readonly averageTransitionSeconds:number; readonly ppda:number|null;
  readonly pressureByZone:{ readonly ownThird:number; readonly middleThird:number; readonly finalThird:number };
  readonly averagePositionByRole:Readonly<Record<string,{readonly x:number;readonly y:number;readonly samples:number}>>;
  readonly ballCirculationSpeed:number;
}
export interface SectorCentroids { readonly defence:Point|null; readonly midfield:Point|null; readonly attack:Point|null }
export interface MatchSnapshot {
  readonly type?: "snapshot";
  readonly matchId?: string;
  readonly sequence?: number;
  readonly time: number;
  readonly status?: "RUNNING" | "PAUSED";
  readonly homePhase?: string;
  readonly awayPhase?: string;
  readonly phase: "READY" | "KICKOFF_PASS" | "RECEIVED" | "OPEN_PLAY" | "FIRST_HALF" | "SECOND_HALF" | "FINISHED";
  readonly players: readonly PlayerSnapshot[];
  readonly ball: BallPoint;
  readonly tacticalDiagnostics?: { readonly home:TeamTacticalDiagnostics; readonly away:TeamTacticalDiagnostics };
  readonly tacticalDebug?: { readonly carrierId:string|null; readonly passOptionIds:readonly string[]; readonly homeSectors:SectorCentroids; readonly awaySectors:SectorCentroids };
}

export function interpolatePoint(previous: Point, current: Point, alpha: number): Point {
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
  };
}
