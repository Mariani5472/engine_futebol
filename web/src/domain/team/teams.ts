import data from "@/data/brasileirao-2026.json";

type RawPlayer = {
  name: string;
  shortName: string;
  position: string;
  positionsDetailed?: string[];
  jerseyNumber?: string | null;
  shirtNumber?: number | null;
  height?: number | null;
  weight?: number | null;
  dateOfBirth?: string | null;
  preferredFoot?: string | null;
  id: number;
  country?: {
    name?: string | null;
  } | null;
  proposedMarketValue?: number | null;
};

type RawAthlete = {
  player: RawPlayer;
};

type RawTeam = {
  id: number;
  name: string;
  shortName: string;
  nameCode?: string | null;
  teamColors?: {
    primary?: string | null;
    secondary?: string | null;
  } | null;
  athletes: RawAthlete[];
};

type RawData = {
  rows: Array<{
    team: RawTeam;
  }>;
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
  athletes: Athlete[];
};

export type Athlete = {
  id: string;
  name: string;
  shortName: string;
  jersey: number | null;
  position: string;
  positionLabel: string;
  positionsDetailed: string[];
  nationality: string | null;
  age: number | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  preferredFoot: string | null;
  marketValue: number | null;
  photoUrl: string;
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

function mapPlayer({ player }: RawAthlete): Athlete {
  const jersey = player.jerseyNumber ?? player.shirtNumber;

  return {
    id: String(player.id),
    name: player.name,
    shortName: player.shortName || player.name,
    jersey: jersey == null ? null : Number(jersey),
    position: player.position,
    positionLabel: getPositionLabel(
      player.position,
      player.positionsDetailed ?? [],
    ),
    positionsDetailed: player.positionsDetailed ?? [],
    nationality: player.country?.name ?? null,
    age: calculateAge(player.dateOfBirth),
    dateOfBirth: player.dateOfBirth ?? null,
    heightCm: player.height ?? null,
    weightKg: player.weight ?? null,
    preferredFoot: player.preferredFoot ?? null,
    marketValue: player.proposedMarketValue ?? null,
    photoUrl: `https://img.sofascore.com/api/v1/player/${player.id}/image`,
  };
}

export const teams: Team[] = rawData.rows.map(({ team }) => ({
  id: String(team.id),
  name: team.name,
  abbreviation: team.nameCode ?? '',
  shortName: team.shortName,
  logoUrl: `https://img.sofascore.com/api/v1/team/${team.id}/image`,
  colors: {
    primary: team.teamColors?.primary ?? "#ffffff",
    secondary: team.teamColors?.secondary ?? "#000000",
  },
  athletes: team.athletes.map(mapPlayer),
}));

export function getTeamById(teamId: string) {
  return teams.find((team) => team.id === teamId);
}
