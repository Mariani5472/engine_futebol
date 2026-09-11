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

  const overall = 60 + 11.5 * Math.log10(marketValue / 100_000);

  return Math.round(Math.max(45, Math.min(91, overall)));
}

/**
 * OVR real/base do jogador.
 *
 * Não considera:
 * - posição em que está sendo utilizado
 * - forma
 * - desempenho
 * - desenvolvimento
 * - fadiga
 * - moral
 */
export function getPlayerOverall(player: Athlete) {
  return marketValueOverall(player.marketValue);
}

/**
 * Modificador de adequação à posição.
 *
 * Esse modificador existe apenas para representar o rendimento
 * do jogador naquela função específica dentro da tática.
 */
function positionModifier(
  player: Athlete,
  requestedRole: TacticalRole,
) {
  const naturalRole = getNaturalRole(player);

  if (naturalRole === requestedRole) return 3;

  // Goleiros fora do gol sofrem uma penalidade pesada.
  if (naturalRole === "GK" || requestedRole === "GK") return -12;

  // Adaptações razoáveis entre D <-> M <-> F nesta V1.
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

/**
 * OVR do jogador dentro de uma função tática específica.
 *
 * Exemplo:
 * Carlos Miguel
 * OVR base: 82
 * GK: 85
 * F: 70
 */
export function getPositionOverall(
  player: Athlete,
  role: string,
) {
  const requestedRole: TacticalRole =
    role === "GK" ||
      role === "D" ||
      role === "M" ||
      role === "F"
      ? role
      : "F";

  return Math.max(
    1,
    Math.min(
      99,
      getPlayerOverall(player) +
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