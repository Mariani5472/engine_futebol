import { fetchRoster } from "./espn.js";
import { mapRoster } from "./mapper.js";
import type { EspnClub, RosterDataset } from "./models.js";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function scrapeRosters(clubs: readonly EspnClub[], delayMs = 350): Promise<RosterDataset> {
  const dataset: RosterDataset = {
    source: "ESPN",
    competition: "Brasileirão Série A",
    season: 2026,
    generatedAt: new Date().toISOString(),
    teams: [],
    failures: []
  };

  for (const [index, club] of clubs.entries()) {
    try {
      const response = await fetchRoster(club.id);
      dataset.teams.push(mapRoster(response, club));
    } catch (error) {
      dataset.failures.push({
        clubId: club.id,
        clubName: club.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    if (index < clubs.length - 1) await wait(delayMs);
  }
  return dataset;
}
