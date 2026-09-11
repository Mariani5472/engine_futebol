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

export type GameState = {
  saveVersion: number;

  status: GameStatus;

  player: {
    teamId: string | null;
  };

  season: {
    year: number;
    currentRound: number;
  };

  squad: {
    starters: string[];
    bench: string[];
  };

  tactic: {
    formation: Formation;
  };

  match: {
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeScore: number;
    awayScore: number;
    minute: number;
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
  },

  squad: {
    starters: [],
    bench: [],
  },

  tactic: {
    formation: "4-3-3",
  },

  match: {
    homeTeamId: null,
    awayTeamId: null,
    homeScore: 0,
    awayScore: 0,
    minute: 0,
  },
};