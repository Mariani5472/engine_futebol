import type { Athlete } from "@/domain/team/teams";

export interface InitialSquad {
  starters: string[];
  bench: string[];
}

export function buildInitialSquad(players: Athlete[]): InitialSquad {
  const goalkeeper = players.find((player) => player.position === "G");
  const outfield = players.filter((player) => player.position !== "G");

  const starters = [
    ...(goalkeeper ? [goalkeeper.id] : []),
    ...outfield
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 10)
      .map((player) => player.id),
  ];

  const starterSet = new Set(starters);
  const bench = players
    .filter((player) => !starterSet.has(player.id))
    .sort((a, b) => b.overall - a.overall)
    .map((player) => player.id);

  return {
    starters,
    bench,
  };
}
