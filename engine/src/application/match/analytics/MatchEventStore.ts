import type { MatchState } from "../../../core/movement/MatchState";
import type { MatchEvent } from "../../../domain";
import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";

export interface StoredMatchEvent {
  readonly id: string;
  readonly matchId: string;
  readonly timestamp: number;
  readonly matchMinute: number;
  readonly period:string;
  readonly type: string;
  readonly teamId?: string;
  readonly playerId?: string;
  readonly secondaryPlayerId?: string;
  readonly position?: { readonly x: number; readonly y: number };
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface PossessionInterval {
  readonly teamId: string;
  readonly playerId?: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly origin: "CONTROL" | "PASS" | "RESTART" | "RECOVERY";
  readonly endReason: "PLAYER_CHANGE" | "TEAM_CHANGE" | "CONTESTED" | "PERIOD_END";
}

export interface MatchTimelineEntry {
  readonly eventId: string;
  readonly minute: number;
  readonly stoppageTime?: number;
  readonly type: string;
  readonly teamId?: string;
  readonly primaryPlayerId?: string;
  readonly secondaryPlayerId?: string;
  readonly label: string;
  readonly replayAvailable: boolean;
}

export interface EventDerivedTeamReport {
  readonly possessionSeconds: number;
  readonly possessionPercent: number;
  readonly passesAttempted: number;
  readonly passesCompleted: number;
  readonly passAccuracy: number;
  readonly progressivePasses: number;
  readonly passesIntoFinalThird: number;
  readonly passesIntoPenaltyArea: number;
  readonly crosses: number;
  readonly carries: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly shotsOffTarget: number;
  readonly shotsBlocked: number;
  readonly goals: number;
  readonly assists: number;
  readonly bigChances: number;
  readonly bigChancesMissed: number;
  readonly xG:number;
  readonly averageShotDistance:number;
  readonly goalkeeperSaves: number;
  readonly goalkeeperParries: number;
  readonly rebounds: number;
  readonly corners: number;
  readonly throwIns: number;
  readonly goalKicks: number;
  readonly offsides: number;
  readonly fouls: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly tackles: number;
  readonly tacklesWon: number;
  readonly interceptions: number;
  readonly recoveries: number;
  readonly possessionLosses: number;
  readonly duels: number;
  readonly duelsWon: number;
  readonly highPressRecoveries:number;
  readonly attacks:number;
  readonly distanceTravelled: number;
  readonly actionsByZone: Readonly<Record<"OWN_THIRD" | "MIDDLE_THIRD" | "FINAL_THIRD", number>>;
  readonly byPeriod: Readonly<Record<"FIRST_HALF" | "SECOND_HALF", {
    readonly passesAttempted:number; readonly passesCompleted:number; readonly shots:number;
    readonly goals:number; readonly fouls:number; readonly cards:number;
  }>>;
}

export interface EventDerivedPlayerReport {
  readonly playerId: string;
  readonly teamId: string;
  readonly passesAttempted: number;
  readonly passesCompleted: number;
  readonly progressivePasses:number;
  readonly carries: number;
  readonly shots: number;
  readonly goals: number;
  readonly assists:number;
  readonly saves: number;
  readonly cards: number;
  readonly tackles:number;
  readonly tacklesWon:number;
  readonly interceptions:number;
  readonly recoveries:number;
  readonly possessionLosses:number;
  readonly duels:number;
  readonly duelsWon:number;
  readonly actionsByZone:Readonly<Record<"OWN_THIRD"|"MIDDLE_THIRD"|"FINAL_THIRD",number>>;
  readonly distanceTravelled: number;
}

export interface EventDerivedMatchReport {
  readonly matchId: string;
  readonly teams: Readonly<Record<string, EventDerivedTeamReport>>;
  readonly players: Readonly<Record<string, EventDerivedPlayerReport>>;
  readonly possessionIntervals: readonly PossessionInterval[];
}

interface MutablePlayerReport {
  playerId: string; teamId: string; passesAttempted: number; passesCompleted: number;
  progressivePasses:number; carries: number; shots: number; goals: number; assists:number;
  saves: number; cards: number; tackles:number; tacklesWon:number; interceptions:number;
  recoveries:number; possessionLosses:number; duels:number; duelsWon:number;
  actionsByZone:{OWN_THIRD:number;MIDDLE_THIRD:number;FINAL_THIRD:number}; distanceTravelled: number;
}

/** Stores normalized real events and derives reports without parallel shot/pass counters. */
export class MatchEventStore {
  private readonly stored: StoredMatchEvent[] = [];
  private readonly timelineEntries: MatchTimelineEntry[] = [];
  private readonly intervals: PossessionInterval[] = [];
  private readonly distanceByPlayer = new Map<string, number>();
  private readonly previousPositions = new Map<string, { x: number; y: number }>();
  private activePossession: { teamId: string; playerId?: string; startedAt: number; origin: PossessionInterval["origin"] } | null = null;

  public constructor(private readonly matchId: string) {}

  public append(events: readonly MatchEvent[]): void {
    for (const event of events) {
      const stored = this.normalize(event);
      this.stored.push(stored);
      const timeline = this.toTimelineEntry(stored);
      if (timeline) this.timelineEntries.push(timeline);
    }
  }

  public sample(state: MatchState): void {
    for (const player of [...state.home.players, ...state.away.players]) {
      const previous = this.previousPositions.get(player.player.id);
      if (previous) {
        const distance = Math.hypot(player.position.x - previous.x, player.position.y - previous.y);
        this.distanceByPlayer.set(player.player.id, (this.distanceByPlayer.get(player.player.id) ?? 0) + distance);
      }
      this.previousPositions.set(player.player.id, { x: player.position.x, y: player.position.y });
    }

    const owner = state.ball.owner;
    let teamId: string | null = null;
    let playerId: string | undefined;
    let origin: PossessionInterval["origin"] = "CONTROL";
    if (owner) {
      teamId = state.home.players.includes(owner) ? state.home.team.id : state.away.team.id;
      playerId = owner.player.id;
    } else if (state.ball.pendingPass) {
      const passer = [...state.home.players, ...state.away.players]
        .find(player => player.player.id === state.ball.pendingPass!.passerId);
      if (passer) teamId = state.home.players.includes(passer) ? state.home.team.id : state.away.team.id;
      origin = "PASS";
    }

    if (!teamId) {
      this.closePossession(state.currentSecond, "CONTESTED");
      return;
    }
    if (!this.activePossession || this.activePossession.teamId !== teamId || this.activePossession.playerId !== playerId) {
      this.closePossession(state.currentSecond, this.activePossession?.teamId === teamId ? "PLAYER_CHANGE" : "TEAM_CHANGE");
      this.activePossession = { teamId, playerId, startedAt: state.currentSecond, origin };
    }
  }

  public finalize(state: MatchState): EventDerivedMatchReport {
    this.closePossession(state.currentSecond, "PERIOD_END");
    const teamIds = [state.home.team.id, state.away.team.id];
    const teamReports: Record<string, EventDerivedTeamReport> = {};
    const playerReports: Record<string, MutablePlayerReport> = {};
    for (const player of [...state.home.players, ...state.away.players]) {
      const teamId = state.home.players.includes(player) ? state.home.team.id : state.away.team.id;
      playerReports[player.player.id] = {
        playerId: player.player.id, teamId, passesAttempted: 0, passesCompleted: 0,
        progressivePasses:0, carries: 0, shots: 0, goals: 0, assists:0, saves: 0, cards: 0,
        tackles:0,tacklesWon:0,interceptions:0,recoveries:0,possessionLosses:0,duels:0,duelsWon:0,
        actionsByZone:{OWN_THIRD:0,MIDDLE_THIRD:0,FINAL_THIRD:0},
        distanceTravelled: this.distanceByPlayer.get(player.player.id) ?? 0,
      };
    }
    const totalPossession = this.intervals.reduce((sum, interval) => sum + interval.endedAt - interval.startedAt, 0);
    for (const teamId of teamIds) {
      const teamEvents = this.stored.filter(event => event.teamId === teamId);
      const possessionSeconds = this.intervals.filter(interval => interval.teamId === teamId)
        .reduce((sum, interval) => sum + interval.endedAt - interval.startedAt, 0);
      const passesAttempted = teamEvents.filter(event => event.type === "PASS_ATTEMPTED").length;
      const passesCompleted = teamEvents.filter(event => event.type === "PASS_COMPLETED").length;
      const completedPasses = teamEvents.filter(event=>event.type==="PASS_COMPLETED");
      const passesIntoFinalThird = completedPasses.filter(event=>this.targetProgress(state,event,teamId)>=state.pitch.length*2/3).length;
      const passesIntoPenaltyArea = completedPasses.filter(event=>{
        const target=this.passTarget(event); const x=target?.x??NaN, y=target?.y??NaN;
        return Number.isFinite(x)&&Number.isFinite(y)&&this.targetProgress(state,event,teamId)>=state.pitch.length-16.5
          && y>=state.pitch.width/2-20.16&&y<=state.pitch.width/2+20.16;
      }).length;
      const shotStarts=teamEvents.filter(event=>event.type==="SHOT_STARTED");
      const bigShotIds=new Set(shotStarts.filter(event=>{
        const x=event.position?.x??Number(event.metadata.originX), y=event.position?.y??Number(event.metadata.originY);
        const goalX=this.attackingDirection(event,teamId,state)===1?state.pitch.length:0;
        return Number.isFinite(x)&&Number.isFinite(y)&&Math.hypot(goalX-x,state.pitch.width/2-y)<=14;
      }).map(event=>String(event.metadata.shotId)));
      const scoredShotIds=new Set(teamEvents.filter(event=>event.type==="SHOT_ON_TARGET"&&event.metadata.outcome==="GOAL").map(event=>String(event.metadata.shotId)));
      const shotDistances=shotStarts.map(event=>{
        const x=event.position?.x??0,y=event.position?.y??state.pitch.width/2;
        const goalX=this.attackingDirection(event,teamId,state)===1?state.pitch.length:0;
        return Math.hypot(goalX-x,state.pitch.width/2-y);
      });
      const zones = { OWN_THIRD: 0, MIDDLE_THIRD: 0, FINAL_THIRD: 0 };
      for (const event of teamEvents) {
        const zone = event.metadata.zone;
        if (zone === "OWN_THIRD" || zone === "MIDDLE_THIRD" || zone === "FINAL_THIRD") zones[zone]++;
      }
      teamReports[teamId] = {
        possessionSeconds,
        possessionPercent: totalPossession ? possessionSeconds / totalPossession * 100 : 50,
        passesAttempted, passesCompleted,
        passAccuracy: passesAttempted ? passesCompleted / passesAttempted * 100 : 0,
        progressivePasses: completedPasses.filter(event => Number(event.metadata.forwardGain) >= 8).length,
        passesIntoFinalThird, passesIntoPenaltyArea,
        crosses: teamEvents.filter(event => event.type === "PASS_ATTEMPTED" && event.metadata.passKind === "CROSS").length,
        carries: teamEvents.filter(event => event.type === "CARRY_STARTED").length,
        shots: teamEvents.filter(event => event.type === "SHOT").length,
        shotsOnTarget: teamEvents.filter(event => event.type === "SHOT_ON_TARGET").length,
        shotsOffTarget: teamEvents.filter(event => event.type === "SHOT_OFF_TARGET" || event.type === "WOODWORK").length,
        shotsBlocked: teamEvents.filter(event => event.type === "SHOT_BLOCKED").length,
        goals: teamEvents.filter(event => event.type === "GOAL").length,
        assists:teamEvents.filter(event=>event.type==="GOAL"&&Boolean(event.secondaryPlayerId)).length,
        bigChances:bigShotIds.size,
        bigChancesMissed:[...bigShotIds].filter(id=>!scoredShotIds.has(id)).length,
        xG:shotDistances.reduce((sum,distance)=>sum+this.estimateXG(distance),0),
        averageShotDistance:shotDistances.length?shotDistances.reduce((sum,distance)=>sum+distance,0)/shotDistances.length:0,
        goalkeeperSaves: teamEvents.filter(event => event.type === "GOALKEEPER_SAVE").length,
        goalkeeperParries: teamEvents.filter(event => event.type === "GOALKEEPER_SAVE" && event.metadata.caught === false).length,
        rebounds: teamEvents.filter(event => event.type === "REBOUND").length,
        corners: teamEvents.filter(event => event.type === "CORNER").length,
        throwIns: teamEvents.filter(event => event.type === "THROW_IN").length,
        goalKicks: teamEvents.filter(event => event.type === "GOAL_KICK").length,
        offsides:teamEvents.filter(event=>event.type==="OFFSIDE").length,
        fouls: teamEvents.filter(event => event.type === "FOUL").length,
        yellowCards: teamEvents.filter(event => event.type === "CARD" && event.metadata.cardType === "YELLOW").length,
        redCards: teamEvents.filter(event => event.type === "CARD" && event.metadata.cardType === "RED").length,
        tackles:teamEvents.filter(event=>event.type==="TACKLE").length,
        tacklesWon:teamEvents.filter(event=>event.type==="TACKLE"&&event.metadata.successful===true).length,
        interceptions:teamEvents.filter(event=>event.type==="POSSESSION_CHANGED"&&event.metadata.reason==="INTERCEPTION").length,
        recoveries:teamEvents.filter(event=>event.type==="POSSESSION_CHANGED"&&["INTERCEPTION","PHYSICAL_CLAIM","TACKLE"].includes(String(event.metadata.reason))).length,
        possessionLosses:this.intervals.filter(interval=>interval.teamId===teamId&&interval.endReason==="TEAM_CHANGE").length,
        duels:teamEvents.filter(event=>event.type==="TACKLE"||event.type==="POSSESSION_CHANGED"&&event.metadata.reason==="PHYSICAL_CLAIM").length,
        duelsWon:teamEvents.filter(event=>event.type==="TACKLE"&&event.metadata.successful===true||event.type==="POSSESSION_CHANGED"&&event.metadata.reason==="PHYSICAL_CLAIM").length,
        highPressRecoveries:teamEvents.filter(event=>event.type==="POSSESSION_CHANGED"&&this.eventProgress(state,event,teamId)>=state.pitch.length*2/3).length,
        attacks:this.intervals.filter(interval=>interval.teamId===teamId).length,
        distanceTravelled: Object.values(playerReports).filter(player => player.teamId === teamId).reduce((sum, player) => sum + player.distanceTravelled, 0),
        actionsByZone: zones,
        byPeriod:{
          FIRST_HALF:this.periodSummary(teamEvents,"FIRST_HALF"),
          SECOND_HALF:this.periodSummary(teamEvents,"SECOND_HALF"),
        },
      };
    }

    for (const event of this.stored) {
      if (!event.playerId || !playerReports[event.playerId]) continue;
      const player = playerReports[event.playerId];
      if (event.type === "PASS_ATTEMPTED") player.passesAttempted++;
      if (event.type === "PASS_COMPLETED") player.passesCompleted++;
      if (event.type === "PASS_COMPLETED"&&Number(event.metadata.forwardGain)>=8) player.progressivePasses++;
      if (event.type === "CARRY_STARTED") player.carries++;
      if (event.type === "SHOT") player.shots++;
      if (event.type === "GOAL") player.goals++;
      if (event.type === "GOAL"&&event.secondaryPlayerId&&playerReports[event.secondaryPlayerId]) playerReports[event.secondaryPlayerId].assists++;
      if (event.type === "GOALKEEPER_SAVE") player.saves++;
      if (event.type === "CARD") player.cards++;
      if (event.type === "TACKLE") { player.tackles++; player.duels++; if(event.metadata.successful===true){player.tacklesWon++;player.duelsWon++;} }
      if (event.type === "POSSESSION_CHANGED"&&event.metadata.reason==="INTERCEPTION") player.interceptions++;
      if (event.type === "POSSESSION_CHANGED"&&["INTERCEPTION","PHYSICAL_CLAIM","TACKLE"].includes(String(event.metadata.reason))) player.recoveries++;
      if (event.type === "POSSESSION_CHANGED"&&event.metadata.reason==="PHYSICAL_CLAIM") {player.duels++;player.duelsWon++;}
      const zone=event.metadata.zone;
      if(zone==="OWN_THIRD"||zone==="MIDDLE_THIRD"||zone==="FINAL_THIRD") player.actionsByZone[zone]++;
    }
    for(const interval of this.intervals) {
      if(interval.endReason==="TEAM_CHANGE"&&interval.playerId&&playerReports[interval.playerId]) {
        playerReports[interval.playerId].possessionLosses++;
      }
    }
    return { matchId: this.matchId, teams: teamReports, players: playerReports, possessionIntervals: [...this.intervals] };
  }

  public events(): readonly StoredMatchEvent[] { return this.stored; }

  public timeline(replayGoalIds: ReadonlySet<string> = new Set()): readonly MatchTimelineEntry[] {
    return this.timelineEntries.map(entry => entry.type === "GOAL"
      ? { ...entry, replayAvailable: replayGoalIds.has(entry.eventId) }
      : entry);
  }

  private toTimelineEntry(event: StoredMatchEvent): MatchTimelineEntry | null {
    if (!["GOAL", "CARD", "GOALKEEPER_SAVE", "PERIOD_STARTED", "PERIOD_ENDED", "SUBSTITUTION", "PENALTY", "GOAL_DISALLOWED"].includes(event.type)) return null;
    const specialLabel = event.type === "SUBSTITUTION" ? `Substituição: ${event.playerId ?? "jogador"} / ${event.secondaryPlayerId ?? "jogador"}`
      : event.type === "PENALTY" ? `Pênalti para ${event.teamId ?? "time"}`
      : event.type === "GOAL_DISALLOWED" ? `Gol anulado de ${event.playerId ?? "jogador"}` : null;
    const label = specialLabel ?? (event.type === "GOAL" ? `Gol de ${event.playerId ?? "jogador"}${event.secondaryPlayerId ? ` (assistência: ${event.secondaryPlayerId})` : ""}`
      : event.type === "CARD" ? `${event.metadata.cardType} — ${event.playerId ?? "jogador"}`
      : event.type === "GOALKEEPER_SAVE" ? `Defesa de ${event.playerId ?? "goleiro"}`
      : event.type === "PERIOD_STARTED" ? `Início de ${String(event.metadata.periodName).toLowerCase()}`
      : `Fim de ${String(event.metadata.periodName).toLowerCase()}`);
    return {
      eventId: event.id, minute: event.matchMinute,
      stoppageTime: event.matchMinute > (event.period === "FIRST_HALF" ? 45 : 90)
        ? event.matchMinute - (event.period === "FIRST_HALF" ? 45 : 90) : undefined,
      type: event.type,
      teamId: event.teamId, primaryPlayerId: event.playerId,
      secondaryPlayerId: event.secondaryPlayerId, label, replayAvailable: false,
    };
  }

  private closePossession(at: number, reason: PossessionInterval["endReason"]): void {
    if (!this.activePossession) return;
    if (at > this.activePossession.startedAt) {
      this.intervals.push({ ...this.activePossession, endedAt: at, endReason: reason });
    }
    this.activePossession = null;
  }

  private normalize(event: MatchEvent): StoredMatchEvent {
    const raw = event as unknown as Record<string, unknown>;
    const teamId = typeof raw.teamId === "string" ? raw.teamId : undefined;
    const playerId = typeof raw.playerId === "string" ? raw.playerId
      : typeof raw.scorerId === "string" ? raw.scorerId
      : typeof raw.goalkeeperId === "string" ? raw.goalkeeperId : undefined;
    const secondaryPlayerId = typeof raw.assistId === "string" ? raw.assistId
      : typeof raw.receiverId === "string" ? raw.receiverId
      : typeof raw.shooterId === "string" ? raw.shooterId : undefined;
    const x = this.number(raw.positionX) ?? this.number(raw.originX);
    const y = this.number(raw.positionY) ?? this.number(raw.originY);
    const metadata: Record<string, unknown> = { ...raw };
    for (const key of ["id", "type", "timestamp", "period", "teamId", "playerId", "scorerId", "goalkeeperId", "assistId", "receiverId", "shooterId", "positionX", "positionY", "originX", "originY"]) delete metadata[key];
    if (x !== undefined) metadata.zone = x < 35 ? "OWN_THIRD" : x < 70 ? "MIDDLE_THIRD" : "FINAL_THIRD";
    return {
      id: event.id, matchId: this.matchId, timestamp: Number(event.timestamp) / 1000,
      matchMinute: Math.floor(Number(event.timestamp) / 60000), type: event.type,
      period:String(event.period),
      teamId, playerId, secondaryPlayerId,
      position: x !== undefined && y !== undefined ? { x, y } : undefined,
      metadata,
    };
  }

  private number(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private attackingDirection(event:StoredMatchEvent,teamId:string,state:MatchState):1|-1 {
    const firstHalf=event.period==="FIRST_HALF";
    const home=teamId===state.home.team.id;
    return (home===firstHalf?1:-1);
  }

  private targetProgress(state:MatchState,event:StoredMatchEvent,teamId:string):number {
    const x=this.passTarget(event)?.x??NaN;
    if(!Number.isFinite(x)) return 0;
    return this.attackingDirection(event,teamId,state)===1?x:state.pitch.length-x;
  }

  private passTarget(event:StoredMatchEvent):{x:number;y:number}|null {
    const directX=Number(event.metadata.targetX), directY=Number(event.metadata.targetY);
    if(Number.isFinite(directX)&&Number.isFinite(directY)) return {x:directX,y:directY};
    for(let index=this.stored.indexOf(event)-1;index>=0;index--) {
      const candidate=this.stored[index];
      if(candidate.type!=="PASS_ATTEMPTED"||candidate.playerId!==event.playerId) continue;
      const x=Number(candidate.metadata.targetX),y=Number(candidate.metadata.targetY);
      return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
    }
    return null;
  }

  private periodSummary(events:readonly StoredMatchEvent[],period:"FIRST_HALF"|"SECOND_HALF") {
    const selected=events.filter(event=>event.period===period);
    return {
      passesAttempted:selected.filter(event=>event.type==="PASS_ATTEMPTED").length,
      passesCompleted:selected.filter(event=>event.type==="PASS_COMPLETED").length,
      shots:selected.filter(event=>event.type==="SHOT").length,
      goals:selected.filter(event=>event.type==="GOAL").length,
      fouls:selected.filter(event=>event.type==="FOUL").length,
      cards:selected.filter(event=>event.type==="CARD").length,
    };
  }

  private eventProgress(state:MatchState,event:StoredMatchEvent,teamId:string):number {
    const x=event.position?.x??0;
    return this.attackingDirection(event,teamId,state)===1?x:state.pitch.length-x;
  }

  private estimateXG(distance:number):number {
    const base=distance<=6?.35:distance<=12?.18:distance<=18?.09:distance<=25?.04:distance<=35?.02:.01;
    return base*ENGINE_CALIBRATION_PARAMETERS.metrics.xGScale;
  }
}
