import type { Formation, Player, Team } from "../domain.js";

type StrengthKind = "attack" | "defense" | "midfield";

const formationModifiers: Record<Formation, Record<StrengthKind, number>> = {
  "4-4-2": { attack: 1, defense: 1.02, midfield: 1.03 },
  "4-3-3": { attack: 1.05, defense: 1, midfield: 1.02 },
  "4-2-3-1": { attack: 1.02, defense: 1.02, midfield: 1.04 },
  "3-5-2": { attack: 1.02, defense: 0.97, midfield: 1.06 },
};

function average(players: Player[]): number {
  return players.reduce((total, player) => total + player.attributes.technical + player.attributes.mental * 0.5 + player.attributes.physical * 0.25, 0) / players.length;
}

function playersFor(team: Team, kind: StrengthKind): Player[] {
  const starters = team.players.slice(0, 11);
  const positions: Record<StrengthKind, Player["position"][]> = {
    attack: ["FWD", "MID"],
    defense: ["GK", "DEF", "MID"],
    midfield: ["MID", "DEF", "FWD"],
  };
  const selected = starters.filter((player) => positions[kind].includes(player.position));
  return selected.length > 0 ? selected : starters;
}

function calculate(team: Team, kind: StrengthKind): number {
  return average(playersFor(team, kind)) * formationModifiers[team.formation][kind];
}

export const calculateTeamAttack = (team: Team): number => calculate(team, "attack");
export const calculateTeamDefense = (team: Team): number => calculate(team, "defense");
export const calculateTeamMidfield = (team: Team): number => calculate(team, "midfield");
