import { MatchEvent } from "@/domain/match/types";
import type {
  Fixture,
  PlayerStat,
  TeamStanding,
} from "@/domain/season/types";

export type GameStatus =
  | "idle"
  | "team-selection"
  | "playing"
  | "finished";

export type Formation =
  | "4-3-3"
  | "4-4-2"
  | "4-2-3-1"
  | "3-5-2"
  | "3-4-3"
  | "5-3-2";

export type TacticalPosition = {
  playerId: string;
  x: number;
  y: number;
};

export type MatchPhase =
  | "idle"
  | "pre-match"
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

    events: MatchEvent[];
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

    events: [],
  },
};