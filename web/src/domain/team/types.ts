import type { Country, Venue, Manager, TeamColors } from "../database.interface";
import type { Athlete } from "./teams";

export type TeamId = string;
export type PlayerId = string;

export interface DomainTeam {
  id: TeamId;
  databaseId: number;
  name: string;
  shortName: string;
  nameCode: string;
  slug: string;
  gender: string;
  national: boolean;
  country: Country;
  colors: TeamColors;
  manager?: Manager;
  venue?: Venue;
  logoUrl: string;
  athletes: Athlete[];
}
