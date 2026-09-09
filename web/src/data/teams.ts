import type { Player, Team } from "@match-engine/core";

/** Base ratings are a 1–20 engine-scale inference from relative squad market value, not official player ratings. */
const clubs = [
  ["palmeiras", "Palmeiras", 17], ["flamengo", "Flamengo", 17], ["cruzeiro", "Cruzeiro", 16], ["bahia", "Bahia", 16],
  ["botafogo", "Botafogo", 16], ["atletico-mg", "Atlético Mineiro", 15], ["corinthians", "Corinthians", 15], ["internacional", "Internacional", 15],
  ["sao-paulo", "São Paulo", 15], ["fluminense", "Fluminense", 15], ["gremio", "Grêmio", 14], ["vasco", "Vasco da Gama", 14],
  ["santos", "Santos", 14], ["bragantino", "Red Bull Bragantino", 14], ["athletico-pr", "Athletico Paranaense", 14], ["mirassol", "Mirassol", 13],
  ["coritiba", "Coritiba", 13], ["vitoria", "Vitória", 13], ["chapecoense", "Chapecoense", 12], ["remo", "Remo", 11],
] as const;

const firstNames = ["Caio", "Bruno", "Diego", "Lucas", "Rafael", "André", "Felipe", "Mateus", "Gustavo", "Renato", "Vitor", "Igor", "Pedro", "Daniel", "Henrique", "Tiago", "Marcos", "Leandro"];
const surnames = ["Silva", "Costa", "Almeida", "Santos", "Oliveira", "Lima", "Souza", "Rocha", "Mendes", "Barros", "Freitas", "Nunes", "Pires", "Moraes", "Ramos", "Teixeira", "Vieira", "Campos"];
const positions: Player["position"][] = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD", "GK", "DEF", "DEF", "DEF", "MID", "MID", "FWD"];

function player(clubId: string, index: number, base: number): Player {
  const variation = ((index * 7 + base) % 5) - 2;
  return {
    id: `${clubId}-${index + 1}`,
    name: `${firstNames[index]} ${surnames[(index * 3 + base) % surnames.length]}`,
    position: positions[index],
    attributes: {
      mental: Math.max(7, Math.min(20, base + variation)),
      physical: Math.max(7, Math.min(20, base + ((index * 3) % 5) - 2)),
      technical: Math.max(7, Math.min(20, base + ((index * 5) % 5) - 2)),
    },
  };
}

export const initialTeams: Team[] = clubs.map(([id, name, quality]) => ({
  id,
  name,
  formation: "4-3-3",
  players: positions.map((_, index) => player(id, index, quality)),
}));

export const overall = (player: Player): number => Number(((player.attributes.mental + player.attributes.physical + player.attributes.technical) / 3).toFixed(1));
