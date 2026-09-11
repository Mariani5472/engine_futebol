import type { Athlete } from "@/domain/team/teams";

function isGoalkeeper(player: Athlete) {
  return player.position === "GK" || player.positionLabel.toLowerCase().includes("goleiro");
}

export function buildInitialSquad(athletes: Athlete[]) {
  const goalkeeper = athletes.find(isGoalkeeper);
  const outfield = athletes.filter((player) => !goalkeeper || player.id !== goalkeeper.id);
  const starters = [goalkeeper, ...outfield].filter(Boolean).slice(0, 11) as Athlete[];
  const starterIds = new Set(starters.map((player) => player.id));
  const bench = athletes.filter((player) => !starterIds.has(player.id));

  return {
    starters: starters.map((player) => player.id),
    bench: bench.map((player) => player.id),
  };
}
