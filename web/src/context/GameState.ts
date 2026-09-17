import {
  INITIAL_MATCH_STATS,
  type MatchEvent,
  type MatchPhase,
  type MatchStats,
} from "@/domain/match/types";
import type {
  Fixture,
  PlayerStat,
  TeamStanding,
} from "@/domain/season/types";
import type { PlayerStatus } from "@/domain/player/status";
import type { Formation, TacticalPosition } from "@/domain/tactic/types";

export type { Formation, TacticalPosition } from "@/domain/tactic/types";
export type { MatchPhase } from "@/domain/match/types";

export type GameStatus =
  | "idle"
  | "team-selection"
  | "playing"
  | "finished";

export type GameState = {
  saveVersion: number;
  status: GameStatus;
  player: {
    teamId: string | null;
  };
  season: {
    year: number;
    currentRound: number;
    fixtures: Fixture[];
    standings: TeamStanding[];
    playerStats: PlayerStat[];
  };
  squad: {
    starters: string[];
    bench: string[];
    statuses: Record<string, PlayerStatus>;
  };
  tactic: {
    formation: Formation;
    positions: TacticalPosition[];
  };
  match: {
    fixtureId: string | null;
    phase: MatchPhase;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeScore: number;
    awayScore: number;
    minute: number;
    addedTime: number;
    scheduledEndMinute: number;
    events: MatchEvent[];
    stats: MatchStats;
  };
};

export const INITIAL_GAME_STATE: GameState = {
  saveVersion: 1,
  status: "idle",
  player: {
    teamId: null,
  },
  season: {
    year: 2026,
    currentRound: 1,
    fixtures: [],
    standings: [],
    playerStats: [],
  },
  squad: {
    starters: [],
    bench: [],
    statuses: {},
  },
  tactic: {
    formation: "4-3-3",
    positions: [],
  },
  match: {
    fixtureId: null,
    phase: "idle",
    homeTeamId: null,
    awayTeamId: null,
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    addedTime: 0,
    scheduledEndMinute: 90,
    events: [],
    stats: { ...INITIAL_MATCH_STATS },
  },
};
