import { getBasePlayerOverall } from "@/domain/player/overall";
import { teamEntries } from "@/domain/database";
import type { Player as DatabasePlayer } from "@/domain/database.interface";
import type { DomainTeam, PlayerId, TeamId } from "./types";

export interface Athlete {
  id: PlayerId;
  databaseId: number;
  name: string;
  shortName: string;
  slug: string;
  position: DatabasePlayer["position"];
  positionsDetailed: string[];
  jersey: string | null;
  shirtNumber: number | null;
  heightCm: number | null;
  weightKg: number | null;
  dateOfBirth: string | null;
  age: number | null;
  preferredFoot: DatabasePlayer["preferredFoot"] | null;
  nationality: string | null;
  country: DatabasePlayer["country"];
  marketValue: number | null;
  marketValueCurrency: string | null;
  sofascoreId: string;
  photoUrl: string;
  attributes: DatabasePlayer["averageAttributeOverviews"];
  positionAverageAttributes: DatabasePlayer["averageAttributeOverviews"];
  lastYearSummary: DatabasePlayer["lastYearSummary"];
  overall: number;
}

function calculateAge(dateOfBirth: string): number | null {
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

function toAthlete(player: DatabasePlayer): Athlete {
  const attributes = player.averageAttributeOverviews ?? [];
  const currentAttributes = attributes.filter((item) => item.yearShift === 0);

  return {
    id: String(player.id),
    databaseId: player.id,
    name: player.name,
    shortName: player.shortName,
    slug: player.slug,
    position: player.position,
    positionsDetailed: player.positionsDetailed ?? [],
    jersey: player.jerseyNumber || player.shirtNumber ? player.jerseyNumber : null,
    shirtNumber: player.shirtNumber ?? null,
    heightCm: player.height ?? null,
    weightKg: null,
    dateOfBirth: player.dateOfBirth ?? null,
    age: player.dateOfBirth ? calculateAge(player.dateOfBirth) : null,
    preferredFoot: player.preferredFoot ?? null,
    nationality: player.country?.name ?? null,
    country: player.country,
    marketValue: player.proposedMarketValueRaw?.value ?? null,
    marketValueCurrency: player.proposedMarketValueRaw?.currency ?? null,
    sofascoreId: player.sofascoreId,
    photoUrl: `https://img.sofascore.com/api/v1/player/${player.sofascoreId}/image`,
    attributes: currentAttributes,
    positionAverageAttributes: attributes,
    lastYearSummary: player.lastYearSummary ?? [],
    overall: getBasePlayerOverall(player),
  };
}

function toDomainTeam(entry: (typeof teamEntries)[number]): DomainTeam {
  return {
    id: String(entry.id),
    databaseId: entry.id,
    name: entry.name,
    shortName: entry.shortName,
    nameCode: entry.nameCode,
    slug: entry.slug,
    gender: entry.gender,
    national: entry.national,
    country: entry.country,
    colors: entry.teamColors,
    manager: entry.team.manager,
    venue: entry.team.venue,
    logoUrl: `https://img.sofascore.com/api/v1/team/${entry.id}/image`,
    athletes: entry.players.map(toAthlete),
  };
}

export const teams: DomainTeam[] = teamEntries.map(toDomainTeam);

export function getTeamById(teamId: TeamId): DomainTeam | undefined {
  return teams.find((team) => team.id === teamId);
}

export function getTeamByDatabaseId(teamId: number): DomainTeam | undefined {
  return teams.find((team) => team.databaseId === teamId);
}

export function getPlayerById(playerId: PlayerId): Athlete | undefined {
  for (const team of teams) {
    const player = team.athletes.find((athlete) => athlete.id === playerId);
    if (player) return player;
  }

  return undefined;
}

export function getTeamNames(): Record<TeamId, string> {
  return Object.fromEntries(teams.map((team) => [team.id, team.name]));
}

export function getTeamIds(): TeamId[] {
  return teams.map((team) => team.id);
}
