export type MatchEventType =
  | "goal"
  | "shot"
  | "save"
  | "yellow"
  | "foul"
  | "chance";

export type MatchEvent = {
  minute: number;
  teamId: string;
  type: MatchEventType;
  playerId?: string;
  text: string;
};

export type MatchSimulation = {
  fixtureId: string;

  minute: number;

  homeScore: number;
  awayScore: number;

  events: MatchEvent[];

  finished: boolean;
};