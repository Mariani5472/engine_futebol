import type { Fixture } from "./types";
import type { TeamId } from "@/domain/team/types";

function createRoundPairings(teamIds: TeamId[]): Array<Array<[TeamId, TeamId]>> {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push("__BYE__");

  const rounds: Array<Array<[TeamId, TeamId]>> = [];
  const fixed = teams[0];
  let rotating = teams.slice(1);

  for (let round = 0; round < teams.length - 1; round += 1) {
    const current = [fixed, ...rotating];
    const matches: Array<[TeamId, TeamId]> = [];

    for (let index = 0; index < current.length / 2; index += 1) {
      const a = current[index];
      const b = current[current.length - 1 - index];
      if (a !== "__BYE__" && b !== "__BYE__") matches.push([a, b]);
    }

    rounds.push(matches);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return rounds;
}

function chooseOrientation(
  a: TeamId,
  b: TeamId,
  state: Map<TeamId, { home: number; away: number; last: "home" | "away" | null; streak: number }>,
): [TeamId, TeamId] {
  const left = state.get(a)!;
  const right = state.get(b)!;

  if (left.streak >= 2 && left.last === "home") return [b, a];
  if (right.streak >= 2 && right.last === "away") return [b, a];
  if (right.streak >= 2 && right.last === "home") return [a, b];
  if (left.streak >= 2 && left.last === "away") return [a, b];

  if (left.home !== right.home) {
    return left.home < right.home ? [a, b] : [b, a];
  }

  return [a, b];
}

function updateOrientationState(
  state: Map<TeamId, { home: number; away: number; last: "home" | "away" | null; streak: number }>,
  home: TeamId,
  away: TeamId,
) {
  for (const [teamId, side] of [[home, "home"], [away, "away"]] as const) {
    const current = state.get(teamId)!;
    current[side] += 1;

    if (current.last === side) current.streak += 1;
    else current.streak = 1;

    current.last = side;
  }
}

export function generateFixtures(teamIds: TeamId[]): Fixture[] {
  if (teamIds.length < 2) return [];

  const uniqueTeamIds = [...new Set(teamIds)];
  const rounds = createRoundPairings(uniqueTeamIds);
  const state = new Map(
    uniqueTeamIds.map((teamId) => [
      teamId,
      { home: 0, away: 0, last: null as "home" | "away" | null, streak: 0 },
    ]),
  );

  const firstHalf: Fixture[] = [];

  rounds.forEach((roundMatches, roundIndex) => {
    roundMatches.forEach(([a, b], matchIndex) => {
      const [homeTeamId, awayTeamId] = chooseOrientation(a, b, state);
      updateOrientationState(state, homeTeamId, awayTeamId);

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
