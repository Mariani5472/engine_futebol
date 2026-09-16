import data from "../../../database/game-database.json";
import {
  type PlayerAttributeOverview,
} from "@/domain/player/attributes";
import {
  FifaAttributes,
  getPlayerOverall,
  SofaScoreAiAttributes,
  TacticalRole,
  type OverallData,
} from "@/domain/tactic/playerOverall"

type RawCountry = {
  alpha2?: string | null;
  alpha3?: string | null;
  name?: string | null;
  slug?: string | null;
};

type RawManager = {
  id?: number;
  name?: string | null;
  shortName?: string | null;
  slug?: string | null;
  country?: RawCountry | null;
} | null;

type RawVenue = {
  id?: number;
  name?: string | null;
  capacity?: number | null;
  city?: {
    id?: number;
    name?: string | null;
    country?: RawCountry | null;
  } | null;
  country?: RawCountry | null;
  venueCoordinates?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  hidden?: boolean;
  stadium?: {
    name?: string | null;
    capacity?: number | null;
  } | null;
} | null;

type RawPlayer = {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  position: string;
  positionsDetailed?: string[] | null;
  jerseyNumber?: string | null;
  shirtNumber?: number | null;
  height?: number | null;
  weight?: number | null;
  dateOfBirth?: string | null;
  preferredFoot?: string | null;
  proposedMarketValueRaw?: {
    value?: number | null;
    currency?: string | null;
  } | null;
  sofascoreId?: string | null;
  country?: RawCountry | null;
  averageAttributeOverviews?: PlayerAttributeOverview[] | null;
  playerAttributeOverviews?: PlayerAttributeOverview[] | null;
  sofascoreOriginal?: SofaScoreAiAttributes | null;
  sofascoreVazia?: SofaScoreAiAttributes | null;
  cartinhaFifa?: FifaAttributes | null;
  desempenhoTotal2026?: number | null;
};

type RawTeam = {
  country?: RawCountry | null;
  gender?: string | null;
  id: number;
  name: string;
  nameCode?: string | null;
  national?: boolean;
  shortName: string;
  slug: string;
  teamColors?: {
    primary?: string | null;
    secondary?: string | null;
  } | null;
  team: {
    country?: RawCountry | null;
    foundationDateTimestamp?: number | null;
    fullName?: string | null;
    gender?: string | null;
    id: number;
    manager?: RawManager;
    name: string;
    nameCode?: string | null;
    national?: boolean;
    teamColors?: {
      primary?: string | null;
      secondary?: string | null;
      text?: string | null;
    } | null;
    shortName?: string | null;
    slug: string;
    venue?: RawVenue;
  };
  uniqueTournaments?: unknown[];
  players: RawPlayer[];
};

type RawData = {
  tournament: {
    id: number;
    name: string;
  };
  teams: RawTeam[];
};

export type Manager = {
  id: number | null;
  name: string;
  shortName: string;
  nationality: string | null;
};

export type Venue = {
  id: number | null;
  name: string;
  capacity: number | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Team = {
  id: string;
  name: string;
  abbreviation: string;
  shortName: string;
  logoUrl: string;
  colors: {
    primary: string;
    secondary: string;
  };
  foundationDateTimestamp: number | null;
  manager: Manager | null;
  venue: Venue | null;
  uniqueTournaments: unknown[];
  athletes: Athlete[];
};

export type Athlete = {
  id: string;
  slug: string;
  sofascoreId: string | null;
  name: string;
  shortName: string;
  jersey: number | null;
  position: string;
  positionLabel: string;
  positionsDetailed: string[];
  nationality: string | null;
  nationalityCode: string | null;
  age: number | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  preferredFoot: string | null;
  marketValue: number | null;
  marketValueCurrency: string | null;
  photoUrl: string;

  attributes: PlayerAttributeOverview[];
  positionAverageAttributes: PlayerAttributeOverview[];

  overall: number;

  overallData: OverallData | null;
};

const rawData = data as RawData;

function calculateAge(dateOfBirth: string | null | undefined) {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age;
}

function getPositionLabel(position: string, positionsDetailed: string[]) {
  if (position === "G") return "Goleiro";
  if (position === "D") return "Defensor";
  if (position === "M") return "Meia";
  if (position === "F") return "Atacante";

  return positionsDetailed[0] ?? "Jogador";
}

function calculateSofaScoreAttributeOverall(
  attributes: SofaScoreAiAttributes | null | undefined,
  role: TacticalRole
): number | null {
  if (!attributes) return null;

  const weights: Record<TacticalRole, Partial<Record<keyof SofaScoreAiAttributes, number>>> = {
    GK: {
      SAV: 0.30,
      ANT: 0.20,
      TAC: 0.15,
      DIS: 0.15,
      AER: 0.20,
    },
    D: {
      DEF: 0.30,
      TAC: 0.25,
      TEC: 0.15,
      AER: 0.15,
      CRE: 0.10,
      ATT: 0.05,
    },
    M: {
      CRE: 0.25,
      TEC: 0.25,
      TAC: 0.20,
      ATT: 0.15,
      DEF: 0.10,
      AER: 0.05,
    },
    F: {
      ATT: 0.30,
      TEC: 0.25,
      CRE: 0.20,
      TAC: 0.10,
      DEF: 0.05,
      AER: 0.10,
    },
  };

  const roleWeights = weights[role];

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [attribute, weight] of Object.entries(roleWeights)) {
    const value = attributes[attribute as keyof SofaScoreAiAttributes];

    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 1 ||
      value > 99
    ) {
      continue;
    }

    weightedSum += value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  return Math.round(weightedSum / totalWeight);
}

function mapPlayer(player: RawPlayer): Athlete {
  const positionsDetailed = player.positionsDetailed ?? [];
  const attributes = player.playerAttributeOverviews ?? [];
  const positionAverageAttributes = player.averageAttributeOverviews ?? [];

  const marketValue = player.proposedMarketValueRaw?.value ?? null;

  const overall = getPlayerOverall({
    age: calculateAge(player.dateOfBirth),
    marketValue,
    position: player.position,
    overallData: {
      sofascoreOriginal: player.sofascoreOriginal,
      sofascoreVazia: player.sofascoreVazia,
      cartinhaFifa: player.cartinhaFifa,
      desempenhoTotal2026: player.desempenhoTotal2026
    },
  })

  const jersey = player.jerseyNumber ?? player.shirtNumber;

  return {
    id: String(player.id),
    slug: player.slug,
    sofascoreId: player.sofascoreId ?? null,
    name: player.name,
    shortName: player.shortName || player.name,
    jersey: jersey == null ? null : Number(jersey),
    position: player.position,
    positionLabel: getPositionLabel(player.position, positionsDetailed),
    positionsDetailed,
    nationality: player.country?.name ?? null,
    nationalityCode: player.country?.alpha2 ?? null,
    age: calculateAge(player.dateOfBirth),
    dateOfBirth: player.dateOfBirth ?? null,
    heightCm: player.height ?? null,
    weightKg: player.weight ?? null,
    preferredFoot: player.preferredFoot ?? null,
    marketValue,
    marketValueCurrency: player.proposedMarketValueRaw?.currency ?? null,
    photoUrl: `https://img.sofascore.com/api/v1/player/${player.id}/image`,
    attributes,
    positionAverageAttributes,
    overall,
    overallData: {
      sofascoreOriginal: player.sofascoreOriginal,
      sofascoreVazia: player.sofascoreVazia,
      cartinhaFifa: player.cartinhaFifa,
      desempenhoTotal2026: player.desempenhoTotal2026,
    },
  };
}

function mapManager(manager: RawManager): Manager | null {
  if (!manager) return null;

  return {
    id: manager.id ?? null,
    name: manager.name ?? "Técnico não informado",
    shortName: manager.shortName ?? manager.name ?? "—",
    nationality: manager.country?.name ?? null,
  };
}

function mapVenue(venue: RawVenue | null | undefined): Venue | null {
  if (!venue) return null;

  return {
    id: venue.id ?? null,
    name: venue.name ?? venue.stadium?.name ?? "Estádio não informado",
    capacity: venue.capacity ?? venue.stadium?.capacity ?? null,
    city: venue.city?.name ?? null,
    country: venue.country?.name ?? venue.city?.country?.name ?? null,
    latitude: venue.venueCoordinates?.latitude ?? null,
    longitude: venue.venueCoordinates?.longitude ?? null,
  };
}

export const teams: Team[] = rawData.teams.map((raw) => {
  const team = raw.team;

  return {
    id: String(raw.id),
    name: raw.name,
    abbreviation: raw.nameCode ?? team.nameCode ?? "",
    shortName: raw.shortName,
    logoUrl: `https://img.sofascore.com/api/v1/team/${raw.id}/image`,
    colors: {
      primary:
        raw.teamColors?.primary ?? team.teamColors?.primary ?? "#ffffff",
      secondary:
        raw.teamColors?.secondary ?? team.teamColors?.secondary ?? "#000000",
    },
    foundationDateTimestamp: team.foundationDateTimestamp ?? null,
    manager: mapManager(team.manager ?? null),
    venue: mapVenue(team.venue),
    uniqueTournaments: raw.uniqueTournaments ?? [],
    athletes: raw.players.map(mapPlayer),
  };
});

export function getTeamById(teamId: string) {
  return teams.find((team) => team.id === teamId);
}
