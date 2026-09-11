import data from "@/data/brasileirao-2026.json";

export type Team = {
  id: string;
  name: string;
  abbreviation: string;
  logoUrl: string;
  athletes: Athlete[];
};

export type Athlete = {
  id: string;
  name: string;
  shortName: string;
  jersey: number | null;
  position: string;
  positionLabel: string;
  nationality: string | null;
  age: number | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
};

export const teams = data.teams as Team[];
export function getTeamById(teamId: string) {
  return teams.find((team) => team.id === teamId);
}
