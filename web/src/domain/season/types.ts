import type { TeamId } from "@/domain/team/types";

export interface MatchResult {
  homeScore: number;
  awayScore: number;
}

export interface Fixture {
  id: string;
  round: number;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  result: MatchResult | null;
}

export interface TeamStanding {
  teamId: TeamId;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: Array<"W" | "D" | "L">;
}

export interface PlayerStat {
  playerId: string;
  teamId: TeamId;
  goals: number;
  assists: number;
  appearances: number;
  yellowCards: number;
  redCards: number;
}
