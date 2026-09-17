import type { Fixture, TeamStanding } from "./types";
import type { TeamId } from "@/domain/team/types";

function createStanding(teamId: TeamId): TeamStanding {
  return {
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
  };
}

export function createInitialStandings(teamIds: TeamId[]): TeamStanding[] {
  return teamIds.map(createStanding);
}

export function calculateStandings(
  teamIds: TeamId[],
  fixtures: Fixture[],
  teamNames?: Record<TeamId, string>,
): TeamStanding[] {
  const standings = new Map<TeamId, TeamStanding>(
    teamIds.map((teamId) => [teamId, createStanding(teamId)]),
  );

  for (const fixture of fixtures) {
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

    if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
      home.form = [...home.form, "W"].slice(-5);
      away.form = [...away.form, "L"].slice(-5);
    } else if (homeScore < awayScore) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
      home.form = [...home.form, "L"].slice(-5);
      away.form = [...away.form, "W"].slice(-5);
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
      home.form = [...home.form, "D"].slice(-5);
      away.form = [...away.form, "D"].slice(-5);
    }
  }

  for (const standing of standings.values()) {
    standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
  }

  return [...standings.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    const nameA = teamNames?.[a.teamId] ?? a.teamId;
    const nameB = teamNames?.[b.teamId] ?? b.teamId;
    return nameA.localeCompare(nameB, "pt-BR");
  });
}
