import type { Athlete } from "@/domain/team/teams";
import {
  calculateAttributeOverall,
  getCurrentPlayerAttributeOverview,
  getNaturalRole,
} from "@/domain/player/attributes";

type TacticalRole = "GK" | "D" | "M" | "F";

function normalizeRole(role: string): TacticalRole {
  if (role === "GK") return "GK";
  if (role === "D") return "D";
  if (role === "M") return "M";
  return "F";
}

function positionPenalty(
  player: Athlete,
  requestedRole: TacticalRole,
) {
  const naturalRole = getNaturalRole(
    player.position,
    player.positionsDetailed,
  );

  if (naturalRole === requestedRole) return 0;
  if (naturalRole === "GK" || requestedRole === "GK") return -15;

  if (
    (naturalRole === "D" && requestedRole === "M") ||
    (naturalRole === "M" && (requestedRole === "D" || requestedRole === "F")) ||
    (naturalRole === "F" && requestedRole === "M")
  ) {
    return -3;
  }

  return -7;
}

export function getPlayerOverall(player: Athlete) {
  return player.overall;
}

export function getPositionOverall(
  player: Athlete,
  role: string,
) {
  const requestedRole = normalizeRole(role);
  const naturalRole = getNaturalRole(
    player.position,
    player.positionsDetailed,
  );

  const currentAttributes = getCurrentPlayerAttributeOverview(
    player.attributes,
    naturalRole,
  );

  const attributeOverall = calculateAttributeOverall(
    currentAttributes,
    requestedRole,
  );

  const base = attributeOverall ?? player.overall;

  return Math.max(
    1,
    Math.min(
      99,
      base + positionPenalty(player, requestedRole),
    ),
  );
}

export function getPlayerPositionLabel(player: Athlete) {
  if (player.positionsDetailed.length === 0) {
    return player.positionLabel || "Jogador";
  }

  return `${player.positionLabel} (${player.positionsDetailed.join("/")})`;
}
