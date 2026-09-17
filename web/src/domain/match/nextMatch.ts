import type { Fixture } from "@/domain/season/types";
import type { TeamId } from "@/domain/team/types";

export function getNextPlayerFixture(
  fixtures: Fixture[],
  teamId: TeamId,
): Fixture | undefined {
  return [...fixtures]
    .filter(
      (fixture) =>
        (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId) &&
        fixture.result === null,
    )
    .sort((a, b) => a.round - b.round)[0];
}
