import { getTeamById } from "@/domain/team/teams";
import { buildInitialSquad } from "@/domain/tactic/squad";
import type { Fixture } from "@/domain/season/types";

function simulateScore(homeStrength: number, awayStrength: number): number {
  const difference = homeStrength - awayStrength;
  const base = 1.35 + difference * 0.045;
  const lambda = Math.max(0.25, Math.min(3.2, base));

  let goals = 0;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const probability = lambda / (attempt + 5);
    if (Math.random() < probability) goals += 1;
  }

  return Math.min(goals, 6);
}

function getTeamMatchStrength(teamId: string, homeBonus: number): number {
  const team = getTeamById(teamId);
  if (!team) return 60 + homeBonus;

  const squad = buildInitialSquad(team.athletes);
  const starters = squad.starters
    .map((playerId) => team.athletes.find((player) => player.id === playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));

  const average = starters.length
    ? starters.reduce((sum, player) => sum + player.overall, 0) / starters.length
    : 60;

  return average + homeBonus;
}

export function simulateFixture(fixture: Fixture): Fixture {
  if (fixture.result) return fixture;

  const homeStrength = getTeamMatchStrength(fixture.homeTeamId, 3);
  const awayStrength = getTeamMatchStrength(fixture.awayTeamId, 0);

  return {
    ...fixture,
    result: {
      homeScore: simulateScore(homeStrength, awayStrength),
      awayScore: simulateScore(awayStrength, homeStrength),
    },
  };
}

export function simulateAllUnplayedFixtures(fixtures: Fixture[]): Fixture[] {
  return fixtures.map(simulateFixture);
}
