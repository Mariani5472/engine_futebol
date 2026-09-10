import type { Player } from "@match-engine/core";
export const overall = (player: Player): number => Number(((player.attributes.mental + player.attributes.physical + player.attributes.technical) / 3).toFixed(1));
export { initialTeams } from "./espnTeams";

