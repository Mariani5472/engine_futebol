import type {
  Player as DatabasePlayer,
  AverageAttributeOverview,
} from "@/domain/database.interface";
import type { Athlete } from "@/domain/team/teams";

export type TacticalRole = "GK" | "D" | "M" | "F";

export type DetailedPosition =
  | "GK"
  | "DC"
  | "DL"
  | "DR"
  | "DM"
  | "CM"
  | "AM"
  | "ST"
  | "LW"
  | "RW"
  | "ML"
  | "MR";

type AttributeKey = keyof Pick<
  AverageAttributeOverview,
  "attacking" | "technical" | "tactical" | "defending" | "creativity"
>;

const ROLE_WEIGHTS: Record<TacticalRole, Record<AttributeKey, number>> = {
  GK: {
    defending: 0.35,
    tactical: 0.25,
    technical: 0.2,
    creativity: 0.1,
    attacking: 0.1,
  },

  D: {
    defending: 0.35,
    tactical: 0.2,
    technical: 0.15,
    creativity: 0.15,
    attacking: 0.15,
  },

  M: {
    technical: 0.25,
    tactical: 0.2,
    creativity: 0.25,
    attacking: 0.2,
    defending: 0.1,
  },

  F: {
    attacking: 0.35,
    technical: 0.25,
    creativity: 0.2,
    tactical: 0.15,
    defending: 0.05,
  },
};

const DETAILED_POSITION_ROLE: Record<
  DetailedPosition,
  TacticalRole
> = {
  GK: "GK",

  DC: "D",
  DL: "D",
  DR: "D",

  DM: "M",
  CM: "M",
  AM: "M",
  ML: "M",
  MR: "M",

  ST: "F",
  LW: "F",
  RW: "F",
};

const VALID_DETAILED_POSITIONS = new Set<DetailedPosition>([
  "GK",
  "DC",
  "DL",
  "DR",
  "DM",
  "CM",
  "AM",
  "ST",
  "LW",
  "RW",
  "ML",
  "MR",
]);

const POSITION_LABELS: Record<DetailedPosition, string> = {
  GK: "Goleiro",

  DC: "Zagueiro",
  DL: "Lateral esquerdo",
  DR: "Lateral direito",

  DM: "Volante",
  CM: "Meia",
  AM: "Meia avançado",
  ML: "Meia esquerda",
  MR: "Meia direita",

  ST: "Atacante",
  LW: "Ponta esquerda",
  RW: "Ponta direita",
};

export function getDetailedPositions(
  positionsDetailed: string[] = [],
): DetailedPosition[] {
  return positionsDetailed
    .map((position) => position.trim().toUpperCase())
    .filter(
      (position): position is DetailedPosition =>
        VALID_DETAILED_POSITIONS.has(
          position as DetailedPosition,
        ),
    );
}

export function getNaturalRole(
  position?: string,
  positionsDetailed: string[] = [],
): TacticalRole {
  const detailed = getDetailedPositions(positionsDetailed);

  if (detailed.includes("GK")) {
    return "GK";
  }

  if (
    detailed.some((item) =>
      ["DC", "DL", "DR"].includes(item)
    )
  ) {
    return "D";
  }

  if (
    detailed.some((item) =>
      ["DM", "CM", "AM", "ML", "MR"].includes(item)
    )
  ) {
    return "M";
  }

  if (detailed.some((item) =>
    ["ST", "LW", "RW"].includes(item)
  )) {
    return "F";
  }

  const normalized = position?.trim().toUpperCase();

  if (normalized === "G" || normalized === "GK") {
    return "GK";
  }

  if (normalized === "D" || normalized?.startsWith("D")) {
    return "D";
  }

  if (normalized === "M" || normalized?.startsWith("M")) {
    return "M";
  }

  return "F";
}

function getPositionRole(
  position: DetailedPosition,
): TacticalRole {
  return DETAILED_POSITION_ROLE[position];
}

function findCurrentOverviews(
  overviews: AverageAttributeOverview[],
): AverageAttributeOverview[] {
  const current = overviews.filter(
    (item) => item.yearShift === 0,
  );

  return current.length > 0 ? current : overviews;
}

function findBestOverview(
  overviews: AverageAttributeOverview[],
  position: DetailedPosition,
): AverageAttributeOverview | undefined {
  const candidates = findCurrentOverviews(overviews);

  if (candidates.length === 0) {
    return undefined;
  }

  /*
   * Primeiro tenta encontrar exatamente a posição desejada.
   *
   * Ex:
   * DL -> DL
   * DC -> DC
   * ST -> ST
   */
  const exactMatch = candidates.find(
    (item) =>
      item.position?.trim().toUpperCase() === position,
  );

  if (exactMatch) {
    return exactMatch;
  }

  /*
   * Caso o banco não possua o overview detalhado,
   * procuramos o overview do grupo tático.
   *
   * DL -> D
   * DC -> D
   * CM -> M
   * ST -> F
   */
  const role = getPositionRole(position);

  const roleMatch = candidates.find((item) => {
    const overviewPosition =
      item.position?.trim().toUpperCase();

    if (role === "GK") {
      return (
        overviewPosition === "G" ||
        overviewPosition === "GK"
      );
    }

    return overviewPosition === role;
  });

  return roleMatch;
}

export function calculateAttributeOverall(
  overview: AverageAttributeOverview,
  role: TacticalRole,
): number {
  const weights = ROLE_WEIGHTS[role];

  /*
   * Proteção contra dados inválidos.
   *
   * Isso evita o crash caso algum overview esteja
   * incompleto no JSON.
   */
  if (!weights) {
    return 1;
  }

  const attacking = Number(overview.attacking) || 0;
  const technical = Number(overview.technical) || 0;
  const tactical = Number(overview.tactical) || 0;
  const defending = Number(overview.defending) || 0;
  const creativity = Number(overview.creativity) || 0;

  const value =
    attacking * weights.attacking +
    technical * weights.technical +
    tactical * weights.tactical +
    defending * weights.defending +
    creativity * weights.creativity;
  console.log(value)
  return Math.round(
    Math.max(1, Math.min(99, value)),
  );
}

export function getBasePlayerOverall(
  player: DatabasePlayer,
): number {
  const positions = getDetailedPositions(
    player.positionsDetailed,
  );

  const naturalPosition = positions[0];

  if (naturalPosition) {
    const overview = findBestOverview(
      player.averageAttributeOverviews ?? [],
      naturalPosition,
    );

    if (overview) {
      return calculateAttributeOverall(
        overview,
        getPositionRole(naturalPosition),
      );
    }
  }

  const role = getNaturalRole(
    player.position,
    player.positionsDetailed,
  );

  const overviews = findCurrentOverviews(
    player.averageAttributeOverviews ?? [],
  );

  const overview = overviews.find((item) => {
    const overviewPosition =
      item.position?.trim().toUpperCase();

    if (role === "GK") {
      return (
        overviewPosition === "G" ||
        overviewPosition === "GK"
      );
    }

    return overviewPosition === role;
  });

  if (overview) {
    return calculateAttributeOverall(
      overview,
      role,
    );
  }

  const marketValue =
    player.proposedMarketValueRaw?.value;

  if (marketValue && marketValue > 0) {
    return Math.round(
      Math.max(
        45,
        Math.min(
          91,
          60 +
          11.5 *
          Math.log10(
            marketValue / 100_000,
          ),
        ),
      ),
    );
  }

  return 58;
}

export function getPlayerOverall(
  player: Athlete,
): number {
  return player.overall;
}

export function getPositionOverall(
  player: Athlete,
  position: DetailedPosition,
): number {
  const role = getPositionRole(position);

  const overview = findBestOverview(
    player.positionAverageAttributes,
    position,
  );

  if (!overview) {
    return player.overall;
  }

  return calculateAttributeOverall(
    overview,
    role,
  );
}

export function getPlayerPositionLabel(
  player: Athlete,
): string {
  const positions = getDetailedPositions(
    player.positionsDetailed,
  );

  if (positions.length > 0) {
    return positions
      .map((position) => POSITION_LABELS[position])
      .join(" / ");
  }

  const labels: Record<string, string> = {
    G: "Goleiro",
    D: "Defensor",
    M: "Meia",
    F: "Atacante",
  };

  return (
    labels[player.position] ??
    player.position
  );
}

export function getDetailedPositionLabel(
  position: DetailedPosition,
): string {
  return POSITION_LABELS[position];
}

export function isPlayerNaturalPosition(
  player: Athlete,
  position: DetailedPosition,
): boolean {
  return getDetailedPositions(
    player.positionsDetailed,
  ).includes(position);
}

export function getPositionCompatibility(
  player: Athlete,
  position: DetailedPosition,
): number {
  const positions = getDetailedPositions(
    player.positionsDetailed,
  );

  if (positions.includes(position)) {
    return 1;
  }

  const playerRole = positions[0]
    ? getPositionRole(positions[0])
    : null;

  const targetRole = getPositionRole(position);

  if (playerRole === targetRole) {
    return 0.65;
  }

  return 0.25;
}