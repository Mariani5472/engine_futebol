import type { Fixture } from "@/domain/season/types";

export function getNextPlayerFixture(
  fixtures: Fixture[],
  teamId: string,
) {
  return [...fixtures]
    .filter(
      (fixture) =>
        fixture.result === null &&
        (
          fixture.homeTeamId === teamId ||
          fixture.awayTeamId === teamId
        ),
    )
    .sort((a, b) => {
      if (a.round !== b.round) {
        return a.round - b.round;
      }

      return a.id.localeCompare(b.id);
    })[0];
}