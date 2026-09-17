import { getTeamById } from "@/domain/team/teams";
import type { Fixture } from "@/domain/season/types";

function simulateScore(homeStrength: number, awayStrength: number): number {
  const base = homeStrength / Math.max(1, awayStrength);
  const lambda = Math.max(0.2, Math.min(3.2, 1.25 * base));
  let goals = 0;

  for (let i = 0; i < 3; i += 1) {
    if (Math.random() < lambda / (i + 4)) goals += 1;
  }

  return Math.min(goals, 6);
}

export function simulateFixture(fixture: Fixture): Fixture {
  if (fixture.result) return fixture;

  const home = getTeamById(fixture.homeTeamId);
  const away = getTeamById(fixture.awayTeamId);

  if (!home || !away) {
    return {
      ...fixture,
      result: {
        homeScore: 0,
        awayScore: 0,
      },
    };
  }

  const homePlayers = home.athletes.slice(0, 11);
  const awayPlayers = away.athletes.slice(0, 11);

  const homeStrength = homePlayers.length
    ? homePlayers.reduce((sum, player) => sum + player.overall, 0) / homePlayers.length + 3
    : 60;
  const awayStrength = awayPlayers.length
    ? awayPlayers.reduce((sum, player) => sum + player.overall, 0) / awayPlayers.length
    : 60;

  return {
    ...fixture,
    result: {
      homeScore: simulateScore(homeStrength, awayStrength),
      awayScore: simulateScore(awayStrength, homeStrength + 3),
    },
  };
}

export function simulateAllUnplayedFixtures(fixtures: Fixture[]): Fixture[] {
  return fixtures.map(simulateFixture);
}
