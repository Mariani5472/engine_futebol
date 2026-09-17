import type { TeamId } from "@/domain/team/types";

export type MatchEventType =
  | "goal"
  | "shot"
  | "save"
  | "yellow"
  | "red"
  | "foul"
  | "chance";

export interface MatchEvent {
  minute: number;
  teamId: TeamId;
  type: MatchEventType;
  playerId?: string;
  text: string;
}

export interface MatchStats {
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homePossession: number;
  awayPossession: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
}

export interface MatchSimulationState {
  minute: number;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  stats?: MatchStats;
}

export const INITIAL_MATCH_STATS: MatchStats = {
  homeShots: 0,
  awayShots: 0,
  homeShotsOnTarget: 0,
  awayShotsOnTarget: 0,
  homePossession: 50,
  awayPossession: 50,
  homeCorners: 0,
  awayCorners: 0,
  homeFouls: 0,
  awayFouls: 0,
  homeYellowCards: 0,
  awayYellowCards: 0,
  homeRedCards: 0,
  awayRedCards: 0,
};
