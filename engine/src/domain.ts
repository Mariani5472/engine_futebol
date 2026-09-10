/** Public input models for the match simulator. */
export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

export type Formation = "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2";

export type Player = {
  id: string;
  name: string;
  position: PlayerPosition;
  attributes: {
    mental: number;
    physical: number;
    technical: number;
  };
};

export type Team = {
  id: string;
  name: string;
  logoUrl: string | null;
  players: Player[];
  formation: Formation;
};

export type Score = { home: number; away: number };

export type TeamStatistics = {
  shots: number;
  shotsOnTarget: number;
  goals: number;
  yellowCards: number;
  corners: number;
};

export type MatchStatistics = {
  possession: Score;
  shots: Score;
  shotsOnTarget: Score;
  goals: Score;
  yellowCards: Score;
  corners: Score;
};

export type PlayerMatchState = {
  playerId: string;
  status: "STARTER" | "BENCH" | "SUBSTITUTED";
  minutesPlayed: number;
  goals: number;
  shots: number;
  yellowCards: number;
  rating: number;
};

export type TeamState = {
  teamId: string;
  players: PlayerMatchState[];
};

export type MatchEvent =
  | { type: "MATCH_STARTED"; minute: 0 }
  | {
    type: "SHOT";
    minute: number;
    teamId: string;
    playerId: string;
    outcome: "GOAL" | "SAVED" | "BLOCKED" | "MISSED";
  }
  | { type: "YELLOW_CARD"; minute: number; teamId: string; playerId: string }
  | {
    type: "SUBSTITUTION";
    minute: number;
    teamId: string;
    playerInId: string;
    playerOutId: string;
  }
  | { type: "HALF_TIME"; minute: 45 }
  | { type: "MATCH_FINISHED"; minute: 90 };

export type DebugEntry = {
  minute: number;
  type: "SHOT";
  teamId: string;
  playerId: string;
  attackPower: number;
  defensePower: number;
  outcome: "GOAL" | "SAVED" | "BLOCKED" | "MISSED";
};

export type MatchResult = {
  score: Score;
  events: MatchEvent[];
  statistics: MatchStatistics;
  finalState: {
    minute: 90;
    status: "FINISHED";
    homeTeam: TeamState;
    awayTeam: TeamState;
  };
  debug?: DebugEntry[];
};

export type SimulateMatchInput = {
  homeTeam: Team;
  awayTeam: Team;
  seed: number;
  debug?: boolean;
  /** Defaults to 1.05 and only affects the home side's attack selection. */
  homeAdvantage?: number;
};
