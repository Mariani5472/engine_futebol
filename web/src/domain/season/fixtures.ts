import type { Fixture } from "./types";
import type { TeamId } from "@/domain/team/types";

function createRoundPairings(teamIds: TeamId[]): Array<Array<[TeamId, TeamId]>> {
  const rotatingTeams = [...teamIds];

  if (rotatingTeams.length % 2 !== 0) {
    rotatingTeams.push("__BYE__");
  }

  const rounds: Array<Array<[TeamId, TeamId]>> = [];
  const fixed = rotatingTeams[0];
  let rotating = rotatingTeams.slice(1);

  for (let round = 0; round < rotatingTeams.length - 1; round += 1) {
    const current = [fixed, ...rotating];
    const matches: Array<[TeamId, TeamId]> = [];

    for (let index = 0; index < current.length / 2; index += 1) {
      const a = current[index];
      const b = current[current.length - 1 - index];

      if (a !== "__BYE__" && b !== "__BYE__") {
        matches.push([a, b]);
      }
    }

    rounds.push(matches);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return rounds;
}

type OrientationState = {
  home: number;
  away: number;
  last: "home" | "away" | null;
  streak: number;
};

function chooseOrientation(
  a: TeamId,
  b: TeamId,
  state: Map<TeamId, OrientationState>,
): [TeamId, TeamId] {
  const left = state.get(a)!;
  const right = state.get(b)!;

  // Never knowingly create a third consecutive home/away match.
  if (left.streak >= 2 && left.last === "home") return [b, a];
  if (right.streak >= 2 && right.last === "away") return [b, a];
  if (right.streak >= 2 && right.last === "home") return [a, b];
  if (left.streak >= 2 && left.last === "away") return [a, b];

  // Balance the home/away totals before using the natural pairing order.
  if (left.home !== right.home) {
    return left.home < right.home ? [a, b] : [b, a];
  }

  if (left.away !== right.away) {
    return left.away > right.away ? [a, b] : [b, a];
  }

  return [a, b];
}

function updateOrientationState(
  state: Map<TeamId, OrientationState>,
  home: TeamId,
  away: TeamId,
) {
  for (const [teamId, side] of [
    [home, "home"],
    [away, "away"],
  ] as const) {
    const current = state.get(teamId)!;
    current[side] += 1;

    if (current.last === side) {
      current.streak += 1;
    } else {
      current.streak = 1;
    }

    current.last = side;
  }
}

export function generateFixtures(teamIds: TeamId[]): Fixture[] {
  const uniqueTeamIds = [...new Set(teamIds)];

  if (uniqueTeamIds.length < 2) return [];

  const rounds = createRoundPairings(uniqueTeamIds);
  const orientationState = new Map<TeamId, OrientationState>(
    uniqueTeamIds.map((teamId) => [
      teamId,
      { home: 0, away: 0, last: null, streak: 0 },
    ]),
  );

  const firstHalf: Fixture[] = [];

  rounds.forEach((roundMatches, roundIndex) => {
    roundMatches.forEach(([a, b], matchIndex) => {
      const [homeTeamId, awayTeamId] = chooseOrientation(
        a,
        b,
        orientationState,
      );

      updateOrientationState(orientationState, homeTeamId, awayTeamId);

      firstHalf.push({
        id: `R${roundIndex + 1}-${matchIndex + 1}-1`,
        round: roundIndex + 1,
        homeTeamId,
        awayTeamId,
        result: null,
      });
    });
  });

  const secondHalf = firstHalf.map((fixture) => ({
    ...fixture,
    id: `${fixture.id}-2`,
    round: fixture.round + rounds.length,
    homeTeamId: fixture.awayTeamId,
    awayTeamId: fixture.homeTeamId,
    result: null,
  }));

  return [...firstHalf, ...secondHalf];
}

export function getFixturesByRound(
  fixtures: Fixture[],
  round: number,
): Fixture[] {
  return fixtures
    .filter((fixture) => fixture.round === round)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getPlayerFixtures(
  fixtures: Fixture[],
  teamId: TeamId,
): Fixture[] {
  return fixtures
    .filter(
      (fixture) =>
        fixture.homeTeamId === teamId || fixture.awayTeamId === teamId,
    )
    .sort((a, b) => a.round - b.round);
}
