import type { Athlete } from "@/domain/team/teams";

function isGoalkeeper(player: Athlete) {
  return (
    player.position === "G" ||
    player.position === "GK" ||
    player.positionsDetailed.includes("GK")
  );
}

function positionPriority(player: Athlete) {
  if (isGoalkeeper(player)) return 0;
  if (player.position === "D") return 1;
  if (player.position === "M") return 2;
  return 3;
}

export function buildInitialSquad(athletes: Athlete[]) {
  const ordered = [...athletes].sort((a, b) => {
    const positionDifference = positionPriority(a) - positionPriority(b);
    if (positionDifference !== 0) return positionDifference;

    return (b.marketValue ?? 0) - (a.marketValue ?? 0);
  });

  const goalkeeper = ordered.find(isGoalkeeper);
  const outfield = ordered.filter(
    (player) => !goalkeeper || player.id !== goalkeeper.id,
  );

  const starters = [goalkeeper, ...outfield]
    .filter((player): player is Athlete => Boolean(player))
    .slice(0, 11);

  const starterIds = new Set(starters.map((player) => player.id));
  const bench = athletes.filter((player) => !starterIds.has(player.id));

  return {
    starters: starters.map((player) => player.id),
    bench: bench.map((player) => player.id),
  };
}
