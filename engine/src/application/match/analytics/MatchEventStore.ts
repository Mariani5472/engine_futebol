import type { MatchState } from "../../../core/movement/MatchState";
import type { MatchEvent } from "../../../domain";

export interface StoredMatchEvent {
  readonly id: string;
  readonly matchId: string;
  readonly timestamp: number;
  readonly matchMinute: number;
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
  readonly crosses: number;
  readonly carries: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly shotsOffTarget: number;
  readonly shotsBlocked: number;
  readonly goals: number;
  readonly goalkeeperSaves: number;
  readonly goalkeeperParries: number;
  readonly rebounds: number;
  readonly corners: number;
  readonly throwIns: number;
  readonly goalKicks: number;
  readonly fouls: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly distanceTravelled: number;
  readonly actionsByZone: Readonly<Record<"OWN_THIRD" | "MIDDLE_THIRD" | "FINAL_THIRD", number>>;
}

export interface EventDerivedPlayerReport {
  readonly playerId: string;
  readonly teamId: string;
  readonly passesAttempted: number;
  readonly passesCompleted: number;
  readonly carries: number;
  readonly shots: number;
  readonly goals: number;
  readonly saves: number;
  readonly cards: number;
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
  carries: number; shots: number; goals: number; saves: number; cards: number; distanceTravelled: number;
}

/** Stores normalized real events and derives reports without parallel shot/pass counters. */
export class MatchEventStore {
  private readonly stored: StoredMatchEvent[] = [];
  private readonly intervals: PossessionInterval[] = [];
  private readonly distanceByPlayer = new Map<string, number>();
  private readonly previousPositions = new Map<string, { x: number; y: number }>();
  private activePossession: { teamId: string; playerId?: string; startedAt: number; origin: PossessionInterval["origin"] } | null = null;

  public constructor(private readonly matchId: string) {}

  public append(events: readonly MatchEvent[]): void {
    for (const event of events) this.stored.push(this.normalize(event));
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
        carries: 0, shots: 0, goals: 0, saves: 0, cards: 0,
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
        progressivePasses: teamEvents.filter(event => (event.type === "PASS_COMPLETED" && Number(event.metadata.forwardGain) >= 8)).length,
        crosses: teamEvents.filter(event => event.type === "PASS_ATTEMPTED" && event.metadata.passKind === "CROSS").length,
        carries: teamEvents.filter(event => event.type === "CARRY_STARTED").length,
        shots: teamEvents.filter(event => event.type === "SHOT").length,
        shotsOnTarget: teamEvents.filter(event => event.type === "SHOT_ON_TARGET").length,
        shotsOffTarget: teamEvents.filter(event => event.type === "SHOT_OFF_TARGET" || event.type === "WOODWORK").length,
        shotsBlocked: teamEvents.filter(event => event.type === "SHOT_BLOCKED").length,
        goals: teamEvents.filter(event => event.type === "GOAL").length,
        goalkeeperSaves: teamEvents.filter(event => event.type === "GOALKEEPER_SAVE").length,
        goalkeeperParries: teamEvents.filter(event => event.type === "GOALKEEPER_SAVE" && event.metadata.caught === false).length,
        rebounds: teamEvents.filter(event => event.type === "REBOUND").length,
        corners: teamEvents.filter(event => event.type === "CORNER").length,
        throwIns: teamEvents.filter(event => event.type === "THROW_IN").length,
        goalKicks: teamEvents.filter(event => event.type === "GOAL_KICK").length,
        fouls: teamEvents.filter(event => event.type === "FOUL").length,
        yellowCards: teamEvents.filter(event => event.type === "CARD" && event.metadata.cardType === "YELLOW").length,
        redCards: teamEvents.filter(event => event.type === "CARD" && event.metadata.cardType === "RED").length,
        distanceTravelled: Object.values(playerReports).filter(player => player.teamId === teamId).reduce((sum, player) => sum + player.distanceTravelled, 0),
        actionsByZone: zones,
      };
    }

    for (const event of this.stored) {
      if (!event.playerId || !playerReports[event.playerId]) continue;
      const player = playerReports[event.playerId];
      if (event.type === "PASS_ATTEMPTED") player.passesAttempted++;
      if (event.type === "PASS_COMPLETED") player.passesCompleted++;
      if (event.type === "CARRY_STARTED") player.carries++;
      if (event.type === "SHOT") player.shots++;
      if (event.type === "GOAL") player.goals++;
      if (event.type === "GOALKEEPER_SAVE") player.saves++;
      if (event.type === "CARD") player.cards++;
    }
    return { matchId: this.matchId, teams: teamReports, players: playerReports, possessionIntervals: [...this.intervals] };
  }

  public events(): readonly StoredMatchEvent[] { return this.stored; }

  public timeline(replayGoalIds: ReadonlySet<string> = new Set()): readonly MatchTimelineEntry[] {
    return this.stored.flatMap(event => {
      if (!["GOAL", "CARD", "GOALKEEPER_SAVE", "PERIOD_STARTED", "PERIOD_ENDED"].includes(event.type)) return [];
      const label = event.type === "GOAL" ? `Gol de ${event.playerId ?? "jogador"}${event.secondaryPlayerId ? ` (assistência: ${event.secondaryPlayerId})` : ""}`
        : event.type === "CARD" ? `${event.metadata.cardType} — ${event.playerId ?? "jogador"}`
        : event.type === "GOALKEEPER_SAVE" ? `Defesa de ${event.playerId ?? "goleiro"}`
        : event.type === "PERIOD_STARTED" ? `Início de ${String(event.metadata.periodName).toLowerCase()}`
        : `Fim de ${String(event.metadata.periodName).toLowerCase()}`;
      return [{
        eventId: event.id, minute: event.matchMinute, type: event.type,
        teamId: event.teamId, primaryPlayerId: event.playerId,
        secondaryPlayerId: event.secondaryPlayerId, label,
        replayAvailable: event.type === "GOAL" && replayGoalIds.has(event.id),
      }];
    });
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
      teamId, playerId, secondaryPlayerId,
      position: x !== undefined && y !== undefined ? { x, y } : undefined,
      metadata,
    };
  }

  private number(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }
}
