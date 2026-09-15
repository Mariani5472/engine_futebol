export type PlayerAttributeOverview = {
  id: number;
  position: string;
  yearShift: number;
  attacking?: number;
  technical?: number;
  tactical?: number;
  defending?: number;
  creativity?: number;
  saves?: number;
  anticipation?: number;
  ballDistribution?: number;
  aerial?: number;
};

type TacticalRole = "GK" | "D" | "M" | "F";

const OUTFIELD_WEIGHTS: Record<
  TacticalRole,
  Record<
    keyof Pick<
      PlayerAttributeOverview,
      "attacking" | "technical" | "tactical" | "defending" | "creativity"
    >,
    number
  >
> = {
  GK: {
    attacking: 0.05,
    technical: 0.15,
    tactical: 0.25,
    defending: 0.45,
    creativity: 0.1,
  },
  D: {
    attacking: 0.1,
    technical: 0.2,
    tactical: 0.25,
    defending: 0.35,
    creativity: 0.1,
  },
  M: {
    attacking: 0.15,
    technical: 0.25,
    tactical: 0.25,
    defending: 0.1,
    creativity: 0.25,
  },
  F: {
    attacking: 0.35,
    technical: 0.25,
    tactical: 0.15,
    defending: 0.05,
    creativity: 0.2,
  },
};

function normalizeRole(position: string): TacticalRole {
  if (position === "G" || position === "GK") return "GK";
  if (position === "D") return "D";
  if (position === "M") return "M";
  return "F";
}

export function getNaturalRole(
  position: string,
  positionsDetailed: string[],
): TacticalRole {
  const detailed = positionsDetailed.map((item) => item.toUpperCase());

  if (detailed.includes("GK")) return "GK";
  if (
    detailed.some((item) =>
      ["DC", "DL", "DR", "DML", "DMR"].includes(item),
    )
  ) {
    return "D";
  }
  if (
    detailed.some((item) =>
      ["DM", "DMC", "MC", "ML", "MR", "AM", "AMC", "AML", "AMR"].includes(item),
    )
  ) {
    return "M";
  }
  if (
    detailed.some((item) =>
      ["ST", "LW", "RW", "CF"].includes(item),
    )
  ) {
    return "F";
  }

  return normalizeRole(position);
}

export function getCurrentPlayerAttributeOverview(
  attributes: PlayerAttributeOverview[],
  naturalRole: TacticalRole,
) {
  const current = attributes.filter((attribute) => attribute.yearShift === 0);

  return (
    current.find(
      (attribute) => normalizeRole(attribute.position) === naturalRole,
    ) ?? current[0] ?? attributes[0]
  );
}

function weightedOutfieldOverall(
  attribute: PlayerAttributeOverview,
  role: TacticalRole,
) {
  const weights = OUTFIELD_WEIGHTS[role];
  const keys = Object.keys(weights) as Array<keyof typeof weights>;

  let total = 0;
  let weightTotal = 0;

  for (const key of keys) {
    const value = attribute[key];
    if (typeof value !== "number") continue;

    total += value * weights[key];
    weightTotal += weights[key];
  }

  if (weightTotal === 0) return null;

  return Math.round(total / weightTotal);
}

function weightedGoalkeeperOverall(attribute: PlayerAttributeOverview) {
  const values = [
    attribute.saves,
    attribute.anticipation,
    attribute.tactical,
    attribute.ballDistribution,
    attribute.aerial,
  ].filter((value): value is number => typeof value === "number");

  if (values.length > 0) {
    return Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }

  return weightedOutfieldOverall(attribute, "GK");
}

export function calculateAttributeOverall(
  attribute: PlayerAttributeOverview | undefined,
  role: TacticalRole,
) {
  if (!attribute) return null;

  const overall =
    role === "GK"
      ? weightedGoalkeeperOverall(attribute)
      : weightedOutfieldOverall(attribute, role);

  if (overall == null) return null;

  return Math.max(1, Math.min(99, overall));
}

export function getAttributeKeys(
  attribute: PlayerAttributeOverview,
  role: TacticalRole,
) {
  if (role === "GK" && typeof attribute.saves === "number") {
    return [
      ["Defesas", attribute.saves],
      ["Antecipação", attribute.anticipation],
      ["Tático", attribute.tactical],
      ["Distribuição", attribute.ballDistribution],
      ["Aéreo", attribute.aerial],
    ] as const;
  }

  return [
    ["Ataque", attribute.attacking],
    ["Técnico", attribute.technical],
    ["Tático", attribute.tactical],
    ["Defesa", attribute.defending],
    ["Criatividade", attribute.creativity],
  ] as const;
}
