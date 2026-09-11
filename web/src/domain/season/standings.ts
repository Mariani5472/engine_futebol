import type {
  Fixture,
  TeamStanding,
} from "./types";

export function createInitialStandings(
  teamIds: string[],
): TeamStanding[] {
  return teamIds.map((teamId) => ({
    teamId,

    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,

    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,

    points: 0,

    form: [],
  }));
}

export function calculateStandings(
  teamIds: string[],
  fixtures: Fixture[],
  teamNames?: Record<string, string>,
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>();

  for (const standing of createInitialStandings(teamIds)) {
    standings.set(standing.teamId, standing);
  }

  const orderedFixtures = [...fixtures]
    .filter((fixture) => fixture.result !== null)
    .sort((a, b) => {
      if (a.round !== b.round) {
        return a.round - b.round;
      }

      return a.id.localeCompare(b.id);
    });

  for (const fixture of orderedFixtures) {
    if (!fixture.result) continue;

    const home = standings.get(fixture.homeTeamId);
    const away = standings.get(fixture.awayTeamId);

    if (!home || !away) continue;

    const { homeScore, awayScore } = fixture.result;

    home.played += 1;
    away.played += 1;

    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;

    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    home.goalDifference =
      home.goalsFor - home.goalsAgainst;

    away.goalDifference =
      away.goalsFor - away.goalsAgainst;

    if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;

      home.points += 3;

      home.form.push("W");
      away.form.push("L");
    } else if (homeScore < awayScore) {
      away.wins += 1;
      home.losses += 1;

      away.points += 3;

      home.form.push("L");
      away.form.push("W");
    } else {
      home.draws += 1;
      away.draws += 1;

      home.points += 1;
      away.points += 1;

      home.form.push("D");
      away.form.push("D");
    }

    home.form = home.form.slice(-5);
    away.form = away.form.slice(-5);
  }

  return [...standings.values()].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }

    if (b.goalsFor !== a.goalsFor) {
      return b.goalsFor - a.goalsFor;
    }

    const nameA =
      teamNames?.[a.teamId] ?? a.teamId;

    const nameB =
      teamNames?.[b.teamId] ?? b.teamId;

    return nameA.localeCompare(
      nameB,
      "pt-BR",
    );
  });
}