import assert from "node:assert/strict";
import { initialTeams } from "../src/data/teams.js";
import { createSeason, generateFixtures, isSeasonFinished, simulateRound, updatePlayerStats, updateStandings } from "../src/domain/season.js";

const fixtures = generateFixtures(initialTeams.map((team) => team.id));
assert.equal(new Set(fixtures.map((fixture) => fixture.round)).size, 38);
assert.equal(fixtures.length, 380);
for (const round of Array.from({ length: 38 }, (_, index) => index + 1)) {
  const roundFixtures = fixtures.filter((fixture) => fixture.round === round);
  assert.equal(roundFixtures.length, 10);
  assert.equal(new Set(roundFixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId])).size, 20);
}
for (const home of initialTeams) for (const away of initialTeams) if (home.id !== away.id) assert.equal(fixtures.filter((fixture) => fixture.homeTeamId === home.id && fixture.awayTeamId === away.id).length, 1);

const result = { score: { home: 2, away: 1 } } as never;
const table = updateStandings([{ id: "test", round: 1, homeTeamId: "palmeiras", awayTeamId: "flamengo", status: "PLAYED", result }], initialTeams);
assert.equal(table.find((row) => row.teamId === "palmeiras")?.points, 3);
assert.equal(table.find((row) => row.teamId === "flamengo")?.points, 0);
const drawTable = updateStandings([{ id: "draw", round: 1, homeTeamId: "palmeiras", awayTeamId: "flamengo", status: "PLAYED", result: { score: { home: 1, away: 1 } } as never }], initialTeams);
assert.equal(drawTable.find((row) => row.teamId === "palmeiras")?.points, 1);
assert.equal(drawTable.find((row) => row.teamId === "flamengo")?.points, 1);
const stats = updatePlayerStats([{ id: "stats", round: 1, homeTeamId: "palmeiras", awayTeamId: "flamengo", status: "PLAYED", result: { finalState: { homeTeam: { teamId: "palmeiras", players: [{ playerId: "palmeiras-9", minutesPlayed: 90, goals: 2, shots: 4, yellowCards: 0, rating: 9, status: "STARTER" }] }, awayTeam: { teamId: "flamengo", players: [] } } } } as never]);
assert.equal(stats[0].goals, 2);

let season = createSeason(initialTeams, "palmeiras");
assert.equal(isSeasonFinished(season), false);
season = simulateRound(season);
assert.equal(season.fixtures.filter((fixture) => fixture.status === "PLAYED").length, 10);
assert.ok(season.fixtures.find((fixture) => fixture.status === "PLAYED")?.result?.events.length);
while (!isSeasonFinished(season)) season = simulateRound(season);
assert.equal(season.round, 38);
assert.equal(season.playerStats.some((stat) => stat.goals > 0), true);
assert.equal(updatePlayerStats(season.fixtures).length > 0, true);
console.log("web season tests passed");
