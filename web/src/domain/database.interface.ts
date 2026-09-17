export interface Country {
  alpha2: string;
  alpha3: string;
  name: string;
  slug: string;
  id?: number;
  flag?: string;
  fieldTranslations?: FieldTranslations;
}

export interface FieldTranslations {
  nameTranslation?: Record<string, string>;
  shortNameTranslation?: Record<string, string>;
}

export interface Sport {
  name: string;
  slug: string;
  id: number;
}

export interface Category {
  name: string;
  slug: string;
  sport: Sport;
  priority: number;
  id: number;
  flag?: string;
  alpha2?: string;
  fieldTranslations?: FieldTranslations;
}

export interface Tournament {
  id: number;
  name: string;
  slug: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  category?: Category;
  userCount?: number;
  displayInverseHomeAwayTeams?: boolean;
  fieldTranslations?: FieldTranslations;
  isGroup?: boolean;
  country?: Country;
  isGroup?: boolean;
}

export interface Manager {
  id: number;
  name: string;
  slug: string;
  shortName: string;
  country: Country;
  fieldTranslations?: FieldTranslations;
}

export interface City {
  id: number;
  name: string;
  country: Country;
}

export interface VenueCoordinates {
  latitude: number;
  longitude: number;
}

export interface Stadium {
  name: string;
  capacity: number;
}

export interface Venue {
  id: number;
  name: string;
  slug: string;
  capacity: number;
  hidden: boolean;
  country: Country;
  city: City;
  venueCoordinates: VenueCoordinates;
  stadium: Stadium;
  fieldTranslations?: FieldTranslations;
}

export interface TeamColors {
  primary: string;
  secondary: string;
  text: string;
}

export interface Team {
  id: number;
  name: string;
  fullName?: string;
  shortName: string;
  nameCode: string;
  slug: string;
  gender: string;
  national: boolean;
  country: Country;
  teamColors: TeamColors;
  foundationDateTimestamp?: number;
  manager?: Manager;
  venue?: Venue;
}

export interface UniqueTournament extends Tournament {
  category: Category;
}

export interface ProposedMarketValue {
  value: number;
  currency: string;
}

export interface AverageAttributeOverview {
  id: number;
  attacking: number;
  technical: number;
  tactical: number;
  defending: number;
  creativity: number;
  position: string;
  yearShift: number;
}

export type LastYearSummaryType = "event" | "injury" | "missing";

export interface LastYearSummary {
  type: LastYearSummaryType;
  timestamp: number;
  value?: string;
  uniqueTournamentId?: number;
}

export interface Player {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  dateOfBirth: string;
  height: number;
  jerseyNumber: string;
  shirtNumber: number;
  position: PlayerPosition;
  positionsDetailed: string[];
  preferredFoot: PlayerFoot;
  sofascoreId: string;
  country: Country;
  proposedMarketValueRaw?: ProposedMarketValue;
  averageAttributeOverviews: AverageAttributeOverview[];
  lastYearSummary: LastYearSummary[];
}

export interface TeamEntry {
  id: number;
  name: string;
  nameCode: string;
  shortName: string;
  slug: string;
  gender: string;
  national: boolean;
  country: Country;
  teamColors: TeamColors;
  team: Team;
  uniqueTournaments: UniqueTournament[];
  players: Player[];
}

export interface BrasileiraoData {
  tournament: Tournament;
  teams: TeamEntry[];
}

export type PlayerPosition = "G" | "D" | "M" | "F";
export type PlayerFoot = "Left" | "Right" | "Both";
export type SummaryType = "event" | "injury" | "missing";
