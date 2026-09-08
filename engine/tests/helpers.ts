import type { Player, Team } from "../src/index.js";

export function makeTeam(id: string, quality = 12): Team {
  const positions: Player["position"][] = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD", "DEF", "MID", "FWD"];
  return {
    id,
    name: `${id} FC`,
    formation: "4-3-3",
    players: positions.map((position, index) => ({
      id: `${id}-${index + 1}`,
      name: `${id} player ${index + 1}`,
      position,
      attributes: { technical: quality, mental: quality, physical: quality },
    })),
  };
}
