import type { Athlete } from "@/domain/team/teams";

function normalizePosition(position: string, label: string) {
  const value = `${position} ${label}`.toLowerCase();
  if (position === "GK" || value.includes("goleiro")) return "GK";
  if (position === "D" || /zagueiro|lateral|defensor/.test(value)) return "D";
  if (position === "M" || /meia|volante/.test(value)) return "M";
  if (position === "F" || /atacante|ponta/.test(value)) return "F";
  return "UNKNOWN";
}

function baseOverall(player: Athlete) {
  const seed = Number.parseInt(player.id.slice(-3), 10) || 0;
  const ageBonus = player.age == null ? 0 : Math.max(-3, Math.min(4, Math.round((player.age - 24) / 8)));
  return 70 + (seed % 12) + ageBonus;
}

export function getPositionOverall(player: Athlete, role: string) {
  const natural = normalizePosition(player.position, player.positionLabel);
  const requested = role === "GK" ? "GK" : role === "D" ? "D" : role === "M" ? "M" : "F";
  let modifier = -3;
  if (natural === requested) modifier = 5;
  else if (natural !== "UNKNOWN" && ((natural === "D" && requested === "M") || (natural === "M" && (requested === "D" || requested === "F")) || (natural === "F" && requested === "M"))) modifier = 1;
  return Math.max(1, Math.min(99, baseOverall(player) + modifier));
}

export function getPlayerPositionLabel(player: Athlete) {
  return player.positionLabel || player.position || "Jogador";
}
