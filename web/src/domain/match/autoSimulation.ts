import type { Fixture } from "@/domain/season/types";
import { getTeamById } from "@/domain/team/teams";

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTeamStrength(teamId: string) {
  const team = getTeamById(teamId);

  if (!team || team.athletes.length === 0) {
    return 60;
  }

  const total = team.athletes.reduce(
    (sum, player) => {
      const marketValue =
        player.marketValue ?? 100_000;

      const overall =
        60 +
        11.5 *
        Math.log10(marketValue / 100_000);

      return sum + Math.max(45, Math.min(91, overall));
    },
    0,
  );

  return total / team.athletes.length;
}

function generateGoals(
  teamId: string,
  opponentId: string,
) {
  const teamStrength = getTeamStrength(teamId);
  const opponentStrength =
    getTeamStrength(opponentId);

  const strengthDifference =
    teamStrength - opponentStrength;

  const baseGoals = 1.15;

  const modifier =
    strengthDifference * 0.025;

  const expectedGoals = Math.max(
    0.25,
    baseGoals + modifier,
  );

  /*
   * Distribuição simples para V1.
   */
  let goals = 0;

  const chances = Math.round(
    expectedGoals * 3,
  );

  for (let i = 0; i < chances; i++) {
    if (Math.random() < expectedGoals / chances) {
      goals++;
    }
  }

  return Math.min(goals, 6);
}

export function simulateFixture(
  fixture: Fixture,
): Fixture {
  if (fixture.result !== null) {
    return fixture;
  }

  const homeScore = generateGoals(
    fixture.homeTeamId,
    fixture.awayTeamId,
  );

  const awayScore = generateGoals(
    fixture.awayTeamId,
    fixture.homeTeamId,
  );

  return {
    ...fixture,

    result: {
      homeScore,
      awayScore,
    },
  };
}