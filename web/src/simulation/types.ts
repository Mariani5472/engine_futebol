export interface Point { readonly x: number; readonly y: number }
export interface BallPoint extends Point {
  readonly height?: number;
  readonly motionKind?: string | null;
  readonly hasExplicitEffect?: boolean;
  readonly logicalPosition?: Point;
  readonly activeShot?: { readonly id:string; readonly shooterId:string; readonly lifecycle:string; readonly shotType:string; readonly speed:number } | null;
}
export interface MatchFeedEvent {
  readonly type:string; readonly id?:string; readonly timestamp?:number; readonly matchSecond?:number;
  readonly teamId?:string; readonly playerId?:string; readonly result?:string;
  readonly distanceToBall?:number; readonly ballSpeed?:number; readonly reason?:string;
  readonly previousAction?:string|null; readonly distance?:number; readonly allowedDistance?:number;
}
export interface MatchTimelineEntry {
  readonly eventId:string; readonly minute:number; readonly type:string;
  readonly teamId?:string; readonly primaryPlayerId?:string; readonly secondaryPlayerId?:string;
  readonly label:string; readonly replayAvailable:boolean;
}
export interface ReplayFrame {
  readonly timestamp:number;
  readonly ball:{readonly x:number;readonly y:number;readonly height:number};
  readonly players:readonly {readonly id:string;readonly teamId:string;readonly x:number;readonly y:number;readonly facingX:number;readonly facingY:number;readonly action:string|null}[];
  readonly events:readonly string[];
}
export interface GoalReplay { readonly goalEventId:string; readonly speed:1; readonly frames:readonly ReplayFrame[] }
export interface PlayerSnapshot extends Point {
  readonly id: string;
  readonly number: number;
  readonly team: "HOME" | "AWAY";
  readonly hasBall?: boolean;
  readonly targetPosition?: Point;
  readonly tacticalAnchorPosition?: Point;
  readonly runCorridorOrigin?: Point;
  readonly acceptedTargetChanges?: number;
  readonly tacticalResponsibility?: string|null;
  readonly occupiedChannel?: string|null;
  readonly role?: string;
  readonly goalkeeperState?: string|null;
  readonly goalkeeperInterceptionTarget?: Point|null;
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
export interface TeamOffensiveFunnel {
  readonly possessions:number; readonly progressions:number; readonly finalThirdEntries:number;
  readonly penaltyAreaEntries:number; readonly receptionsInArea:number; readonly shots:number;
  readonly shotsOnTarget:number; readonly goals:number; readonly sterilePossessions:number;
  readonly reasons:Readonly<Record<string,number>>; readonly goalContexts:Readonly<Record<string,number>>;
}
export interface MatchSnapshot {
  readonly seed?:number;
  readonly type?: "snapshot";
  readonly matchId?: string;
  readonly sequence?: number;
  readonly time: number;
  readonly status?: "RUNNING" | "PAUSED";
  readonly homePhase?: string;
  readonly awayPhase?: string;
  readonly homePossessionState?:string;
  readonly awayPossessionState?:string;
  readonly possessionPrediction?:{readonly likelyTeamId?:string;readonly likelyReceiverId?:string;readonly confidence:number;readonly interceptionRisk:number;readonly state:string;readonly transitionReason:string};
  readonly phase: "READY" | "KICKOFF_PASS" | "RECEIVED" | "OPEN_PLAY" | "FIRST_HALF" | "SECOND_HALF" | "FINISHED";
  readonly players: readonly PlayerSnapshot[];
  readonly ball: BallPoint;
  readonly score?:{readonly homeGoals:number;readonly awayGoals:number};
  readonly events?:readonly MatchFeedEvent[];
  readonly diagnostics?:readonly MatchFeedEvent[];
  readonly tacticalDiagnostics?: { readonly home:TeamTacticalDiagnostics; readonly away:TeamTacticalDiagnostics };
  readonly offensiveFunnel?: { readonly home:TeamOffensiveFunnel; readonly away:TeamOffensiveFunnel };
  readonly tacticalDebug?: { readonly carrierId:string|null; readonly passOptionIds:readonly string[]; readonly homeSectors:SectorCentroids; readonly awaySectors:SectorCentroids };
  readonly timeline?:readonly MatchTimelineEntry[];
  readonly replayGoalIds?:readonly string[];
  readonly analytics?:unknown|null;
}

export function interpolatePoint(previous: Point, current: Point, alpha: number): Point {
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
  };
}
