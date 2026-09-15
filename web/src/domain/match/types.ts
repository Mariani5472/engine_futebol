export type MatchEventType =
  | "goal"
  | "shot"
  | "save"
  | "yellow"
  | "red"
  | "foul"
  | "chance";

export type MatchEvent = {
  minute: number;
  teamId: string;
  type: MatchEventType;
  playerId?: string;
  assistPlayerId?: string;
  text: string;
};

export type MatchPlayerStats = {
  playerId: string;
  teamId: string;

  minutes: number;

  goals: number;
  assists: number;

  shots: number;
  shotsOnTarget: number;

  saves: number;

  fouls: number;

  yellowCards: number;
  redCards: number;
};

export type MatchTeamStats = {
  possession: number;

  attacks: number;

  shots: number;
  shotsOnTarget: number;

  goals: number;

  saves: number;

  fouls: number;

  yellowCards: number;
  redCards: number;
};

export type MatchStats = {
  home: MatchTeamStats;
  away: MatchTeamStats;

  players: Record<string, MatchPlayerStats>;

  /**
   * Contadores internos usados para calcular
   * posse sem perder precisão por arredondamento.
   */
  possessionHomeTicks: number;
  possessionAwayTicks: number;
};

export type MatchSimulation = {
  fixtureId: string;

  minute: number;

  homeScore: number;
  awayScore: number;

  events: MatchEvent[];

  stats: MatchStats;

  finished: boolean;
};