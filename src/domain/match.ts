import { MatchId, Milliseconds, TeamId } from "./common";
import { Ball } from "./ball";
import { Pitch } from "./pitch";
import { Referee } from "./referee";
import { Team } from "./team";
import { MatchEvent, MatchPeriod } from "./match-events";

export interface MatchScore {
  readonly homeGoals: number;
  readonly awayGoals: number;
}

export interface MatchConfig {
  readonly id: MatchId;
  readonly homeTeam: Team;
  readonly awayTeam: Team;
  readonly pitch: Pitch;
  readonly referee: Referee;
  readonly seed: number;
  readonly durationMs?: Milliseconds;
}

export interface TeamMatchState {
  readonly teamId: TeamId;
  readonly side: "HOME" | "AWAY";
  readonly tacticId?: string;
}

export interface MatchState {
  readonly currentTimeMs: Milliseconds;
  readonly period: MatchPeriod;
  readonly pitch: Pitch;
  readonly ball: Ball;
  readonly homeTeam: TeamMatchState;
  readonly awayTeam: TeamMatchState;
  readonly referee: Referee;
  readonly score: MatchScore;
  readonly events: readonly MatchEvent[];
}

export interface MatchReport {
  readonly matchId: MatchId;
  readonly config: MatchConfig;
  readonly finalState: MatchState;
  readonly events: readonly MatchEvent[];
}

export class Match {
  public readonly id: MatchId;
  public readonly homeTeam: Team;
  public readonly awayTeam: Team;
  public readonly pitch: Pitch;
  public readonly referee: Referee;
  public readonly seed: number;
  public readonly durationMs: Milliseconds;

  private constructor(config: MatchConfig) {
    this.id = config.id;
    this.homeTeam = config.homeTeam;
    this.awayTeam = config.awayTeam;
    this.pitch = config.pitch;
    this.referee = config.referee;
    this.seed = config.seed;
    this.durationMs = (config.durationMs ?? (90 * 60 * 1000)) as Milliseconds;
  }

  public static create(config: MatchConfig): Match {
    if (config.homeTeam.id === config.awayTeam.id) {
      throw new Error("Home team and away team must be different.");
    }

    return new Match(config);
  }
}