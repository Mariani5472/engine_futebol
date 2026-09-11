export type MatchResult = {
  homeScore: number;
  awayScore: number;
};

export type Fixture = {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  result: MatchResult | null;
};

export type TeamStanding = {
  teamId: string;

  played: number;
  wins: number;
  draws: number;
  losses: number;

  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;

  points: number;

  form: Array<"W" | "D" | "L">;
};

export type PlayerStat = {
  playerId: string;
  teamId: string;

  goals: number;
  assists: number;

  appearances: number;
  yellowCards: number;
  redCards: number;
};

export type SeasonState = {
  year: number;
  currentRound: number;

  fixtures: Fixture[];

  standings: TeamStanding[];

  playerStats: PlayerStat[];
};