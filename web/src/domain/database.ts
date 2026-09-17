import rawDatabase from "@/database/database.json";
import type { BrasileiraoData, TeamEntry, Player } from "./database.interface";

export const database = rawDatabase as BrasileiraoData;

export const tournament = database.tournament;

export const teamEntries: TeamEntry[] = database.teams;

export function getDatabaseTeamById(id: number): TeamEntry | undefined {
  return teamEntries.find((team) => team.id === id);
}

export function getDatabasePlayerById(id: number): Player | undefined {
  for (const team of teamEntries) {
    const player = team.players.find((item) => item.id === id);
    if (player) return player;
  }

  return undefined;
}

export function getAllDatabasePlayers(): Player[] {
  return teamEntries.flatMap((team) => team.players);
}
