export type Position = "GK" | "DEF" | "MID" | "FWD" | "UNKNOWN";

export interface EspnClub {
  id: string;
  name: string;
}

export interface Athlete {
  id: string;
  name: string;
  shortName: string;
  jersey: number | null;
  position: Position;
  positionLabel: string | null;
  nationality: string | null;
  age: number | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  photoUrl: string | null;
}

export interface TeamRoster {
  id: string;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  athletes: Athlete[];
}

export interface ScrapeFailure {
  clubId: string;
  clubName: string;
  error: string;
}

export interface RosterDataset {
  source: "ESPN";
  competition: "Brasileirão Série A";
  season: number;
  generatedAt: string;
  teams: TeamRoster[];
  failures: ScrapeFailure[];
}

export interface EspnRosterResponse {
  team?: Record<string, unknown>;
  athletes?: Array<Record<string, unknown>>;
}
