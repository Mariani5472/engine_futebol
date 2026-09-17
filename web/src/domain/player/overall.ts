import type { Player as DatabasePlayer, AverageAttributeOverview } from "@/domain/database.interface";
import type { Athlete } from "@/domain/team/teams";

export type TacticalRole = "GK" | "D" | "M" | "F";

const ROLE_WEIGHTS: Record<TacticalRole, Record<keyof Pick<AverageAttributeOverview, "attacking" | "technical" | "tactical" | "defending" | "creativity">, number>> = {
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

export function getNaturalRole(
  position: string,
  positionsDetailed: string[] = [],
): TacticalRole {
  const normalized = position.toUpperCase();

  if (normalized === "G" || normalized === "GK" || positionsDetailed.includes("GK")) {
    return "GK";
  }

  if (normalized === "D" || normalized.startsWith("D")) return "D";
  if (normalized === "M" || normalized.startsWith("M") || normalized.startsWith("AM")) return "M";
  return "F";
}

function findBestOverview(
  overviews: AverageAttributeOverview[],
  role: TacticalRole,
): AverageAttributeOverview | undefined {
  const current = overviews.filter((item) => item.yearShift === 0);
  const candidates = current.length > 0 ? current : overviews;

  return (
    candidates.find((item) => {
      const position = item.position.toUpperCase();
      if (role === "GK") return position === "G" || position === "GK";
      return position === role;
    }) ?? candidates[0]
  );
}

export function calculateAttributeOverall(
  overview: AverageAttributeOverview,
  role: TacticalRole,
): number {
  const weights = ROLE_WEIGHTS[role];

  const value =
    overview.attacking * weights.attacking +
    overview.technical * weights.technical +
    overview.tactical * weights.tactical +
    overview.defending * weights.defending +
    overview.creativity * weights.creativity;

  return Math.round(Math.max(1, Math.min(99, value)));
}

export function getBasePlayerOverall(player: DatabasePlayer): number {
  const role = getNaturalRole(player.position, player.positionsDetailed);
  const overview = findBestOverview(player.averageAttributeOverviews ?? [], role);

  if (overview) return calculateAttributeOverall(overview, role);

  const marketValue = player.proposedMarketValueRaw?.value;
  if (marketValue && marketValue > 0) {
    return Math.round(
      Math.max(45, Math.min(91, 60 + 11.5 * Math.log10(marketValue / 100_000))),
    );
  }

  return 58;
}

export function getPlayerOverall(player: Athlete): number {
  return player.overall;
}

export function getPositionOverall(player: Athlete, role: TacticalRole): number {
  const overview = findBestOverview(player.positionAverageAttributes, role);
  if (!overview) return player.overall;
  return calculateAttributeOverall(overview, role);
}

export function getPlayerPositionLabel(player: Athlete): string {
  const labels: Record<string, string> = {
    G: "Goleiro",
    D: "Defensor",
    M: "Meia",
    F: "Atacante",
  };

  return labels[player.position] ?? player.position;
}
