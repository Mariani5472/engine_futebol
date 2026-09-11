import type { Athlete } from "@/domain/team/teams";

type TacticalRole = "GK" | "D" | "M" | "F";

const POSITION_GROUPS: Record<TacticalRole, string[]> = {
  GK: ["GK"],
  D: ["DC", "DL", "DR", "DML", "DMR"],
  M: ["DM", "DMC", "MC", "ML", "MR", "AM", "AMC", "AML", "AMR"],
  F: ["ST", "LW", "RW", "CF"],
};

function normalizeRole(position: string): TacticalRole {
  if (position === "G" || position === "GK") return "GK";
  if (position === "D") return "D";
  if (position === "M") return "M";
  return "F";
}

function getNaturalRole(player: Athlete): TacticalRole {
  const detailedPositions = player.positionsDetailed.map((position) =>
    position.toUpperCase(),
  );

  for (const role of Object.keys(POSITION_GROUPS) as TacticalRole[]) {
    if (
      detailedPositions.some((position) =>
        POSITION_GROUPS[role].includes(position),
      )
    ) {
      return role;
    }
  }

  return normalizeRole(player.position);
}

function marketValueOverall(marketValue: number | null) {
  if (!marketValue || marketValue <= 0) return 58;

  // The JSON does not contain technical attributes such as pace, passing,
  // finishing or tackling. Market value is therefore used as the initial
  // strength proxy instead of inventing an OVR from the player id.
  const overall = 60 + 11.5 * Math.log10(marketValue / 100_000);

  return Math.round(Math.max(45, Math.min(91, overall)));
}

function positionModifier(player: Athlete, requestedRole: TacticalRole) {
  const naturalRole = getNaturalRole(player);

  if (naturalRole === requestedRole) return 3;

  // Goalkeepers are intentionally penalized heavily outside the goal.
  if (naturalRole === "GK" || requestedRole === "GK") return -12;

  // D <-> M <-> F is a reasonable positional adaptation for this V1.
  if (
    (naturalRole === "D" && requestedRole === "M") ||
    (naturalRole === "M" &&
      (requestedRole === "D" || requestedRole === "F")) ||
    (naturalRole === "F" && requestedRole === "M")
  ) {
    return 0;
  }

  return -5;
}

export function getPositionOverall(player: Athlete, role: string) {
  const requestedRole: TacticalRole =
    role === "GK" || role === "D" || role === "M" || role === "F"
      ? role
      : "F";

  return Math.max(
    1,
    Math.min(
      99,
      marketValueOverall(player.marketValue) +
        positionModifier(player, requestedRole),
    ),
  );
}

export function getPlayerPositionLabel(player: Athlete) {
  if (player.positionsDetailed.length === 0) {
    return player.positionLabel || "Jogador";
  }

  return `${player.positionLabel} (${player.positionsDetailed.join("/")})`;
}
