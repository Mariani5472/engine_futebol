export interface SofaScoreStandingsResponse {
  standings: SofaScoreStanding[];
}

export interface SofaScoreStanding {
  id: number;
  type: string;
  tournament: SofaScoreTournament;
  name: string;
  descriptions: unknown[];
  tieBreakingRule: SofaScoreTieBreakingRule;
  rows: SofaScoreStandingRow[];
}

export interface SofaScoreStandingRow {
  id: number;
  team: SofaScoreTeam;
  descriptions: unknown[];
  promotion?: SofaScorePromotion;
  position: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  scoresFor: number;
  scoresAgainst: number;
  points: number;
  scoreDiffFormatted: string;
}

export interface SofaScoreTeam {
  name: string;
  slug: string;
  shortName: string;
  gender: string;
  sport: SofaScoreSport;
  userCount: number;
  nameCode: string;
  disabled: boolean;
  national: boolean;
  type: number;
  country: SofaScoreCountry;
  id: number;
  teamColors: SofaScoreTeamColors;
  fieldTranslations: SofaScoreFieldTranslations;
}

export interface SofaScoreSport {
  name: string;
  slug: string;
  id: number;
}

export interface SofaScoreCountry {
  alpha2: string;
  alpha3: string;
  name: string;
  slug: string;
}

export interface SofaScoreTeamColors {
  primary: string;
  secondary: string;
  text: string;
}

export interface SofaScoreFieldTranslations {
  nameTranslation: Record<string, string>;
  shortNameTranslation: Record<string, string>;
}

export interface SofaScorePromotion {
  id: number;
  text: string;
}

export interface SofaScoreTieBreakingRule {
  id: number;
  text: string;
}

export interface SofaScoreTournament {
  name: string;
  slug: string;
  category: SofaScoreCategory;
  uniqueTournament: SofaScoreUniqueTournament;
  priority: number;
  isGroup: boolean;
  isLive: boolean;
  id: number;
  fieldTranslations: SofaScoreFieldTranslations;
}

export interface SofaScoreCategory {
  name: string;
  slug: string;
  sport: SofaScoreSport;
  priority: number;
  country: SofaScoreCountry;
  id: number;
  flag: string;
  alpha2: string;
  fieldTranslations: SofaScoreFieldTranslations;
}

export interface SofaScoreUniqueTournament {
  name: string;
  slug: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  category: SofaScoreCategory;
  userCount: number;
  hasPerformanceGraphFeature: boolean;
  country: Record<string, unknown>;
  id: number;
  displayInverseHomeAwayTeams: boolean;
  fieldTranslations: SofaScoreFieldTranslations;
}