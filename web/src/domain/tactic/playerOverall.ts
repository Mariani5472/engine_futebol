export type TacticalRole = "GK" | "D" | "M" | "F";

export type OverallAttributes = {
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

export type PlayerOverallInput = {
  age: number | null | undefined;
  sofascoreOverall: number | null | undefined;
  marketValue: number | null | undefined;
  position: string;
  attributes?: OverallAttributes | null;
};

const MIN_OVERALL = 50;
const MAX_OVERALL = 94;

/**
 * Valor de mercado em milhões de euros -> OVR.
 *
 * A curva é logarítmica: aumentar de €1M para €5M tem muito mais impacto
 * do que aumentar de €30M para €34M.
 */
const MARKET_ANCHORS = [
  { value: 0, overall: 52 },
  { value: 0.3, overall: 56 },
  { value: 0.5, overall: 59 },
  { value: 1, overall: 63 },
  { value: 2, overall: 67 },
  { value: 4, overall: 72 },
  { value: 7, overall: 77 },
  { value: 10, overall: 81 },
  { value: 15, overall: 85 },
  { value: 25, overall: 89 },
  { value: 40, overall: 93 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRole(position: string): TacticalRole {
  const normalized = position.toUpperCase();

  if (normalized === "G" || normalized === "GK") return "GK";
  if (normalized === "D" || normalized.startsWith("D")) return "D";
  if (
    normalized === "M" ||
    normalized.startsWith("M") ||
    normalized.startsWith("AM")
  ) {
    return "M";
  }

  return "F";
}

/** Converte valor de mercado em OVR. */
export function marketValueToOverall(
  marketValue: number | null | undefined,
) {
  if (!marketValue || marketValue <= 0) return 52;

  const valueInMillions = marketValue / 1_000_000;
  const x = Math.log10(valueInMillions + 0.1);

  for (let index = 1; index < MARKET_ANCHORS.length; index += 1) {
    const previous = MARKET_ANCHORS[index - 1];
    const current = MARKET_ANCHORS[index];

    const previousX = Math.log10(previous.value + 0.1);
    const currentX = Math.log10(current.value + 0.1);

    if (x <= currentX) {
      const progress = (x - previousX) / (currentX - previousX);

      return previous.overall +
        (current.overall - previous.overall) * clamp(progress, 0, 1);
    }
  }

  return MARKET_ANCHORS[MARKET_ANCHORS.length - 1].overall;
}

/**
 * Idade é somente um pequeno ajuste de maturidade.
 * Não representa potencial: um jogador jovem não recebe OVR artificialmente alto.
 */
export function ageModifier(age: number | null | undefined) {
  if (age == null || !Number.isFinite(age)) return 0;

  if (age < 19) return -2;
  if (age <= 21) return -1;
  if (age <= 29) return 2;
  if (age <= 31) return 1;
  if (age <= 33) return 0;
  if (age <= 35) return -1;

  return -2;
}

const OUTFIELD_WEIGHTS: Record<
  Exclude<TacticalRole, "GK">,
  Record<
    keyof Pick<
      OverallAttributes,
      "attacking" | "technical" | "tactical" | "defending" | "creativity"
    >,
    number
  >
> = {
  D: {
    attacking: 0.10,
    technical: 0.20,
    tactical: 0.25,
    defending: 0.30,
    creativity: 0.15,
  },
  M: {
    attacking: 0.20,
    technical: 0.25,
    tactical: 0.20,
    defending: 0.15,
    creativity: 0.20,
  },
  F: {
    attacking: 0.30,
    technical: 0.25,
    tactical: 0.15,
    defending: 0.05,
    creativity: 0.25,
  },
};

/**
 * Transforma os cinco atributos do SofaScore em um OVR de atributos.
 *
 * Goleiros usam os cinco indicadores específicos com peso igual.
 * Jogadores de linha usam pesos diferentes por função, mas nenhum atributo
 * é ignorado completamente.
 */
export function attributesToOverall(
  attributes: OverallAttributes | null | undefined,
  position: string,
) {
  if (!attributes) return null;

  const role = normalizeRole(position);

  const values: Array<[number | undefined, number]> = role === "GK"
    ? [
        [attributes.saves, 0.20],
        [attributes.anticipation, 0.20],
        [attributes.tactical, 0.20],
        [attributes.ballDistribution, 0.20],
        [attributes.aerial, 0.20],
      ]
    : Object.entries(OUTFIELD_WEIGHTS[role]).map(([key, weight]) => [
        attributes[key as keyof OverallAttributes] as number | undefined,
        weight,
      ]);

  let total = 0;
  let weightTotal = 0;

  for (const [value, weight] of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;

    total += clamp(value, 1, 99) * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) return null;

  return total / weightTotal;
}

/**
 * Calculadora principal do OVR.
 *
 * Ordem de importância:
 * - 50%: overall do SofaScore
 * - 30%: valor de mercado
 * - 20%: atributos do SofaScore
 * - idade: pequeno ajuste de -2 a +2 pontos
 *
 * Se um dado não existir, ele não derruba o jogador para um valor arbitrário:
 * os pesos dos dados disponíveis são redistribuídos automaticamente.
 */
export function calculatePlayerOverall(input: PlayerOverallInput) {
  const components: Array<{ value: number; weight: number }> = [];

  if (
    input.sofascoreOverall != null &&
    Number.isFinite(input.sofascoreOverall)
  ) {
    components.push({
      value: clamp(input.sofascoreOverall, 1, 99),
      weight: 0.50,
    });
  }

  components.push({
    value: marketValueToOverall(input.marketValue),
    weight: 0.30,
  });

  const attributeOverall = attributesToOverall(
    input.attributes,
    input.position,
  );

  if (attributeOverall != null) {
    components.push({
      value: attributeOverall,
      weight: 0.20,
    });
  }

  const weightTotal = components.reduce(
    (sum, component) => sum + component.weight,
    0,
  );

  const qualityOverall = components.reduce(
    (sum, component) => sum + component.value * component.weight,
    0,
  ) / weightTotal;

  // Idade influencia pouco. O máximo real é ±2 pontos.
  const age = ageModifier(input.age);
  const overall = qualityOverall + age;

  return Math.round(clamp(overall, MIN_OVERALL, MAX_OVERALL));
}

/** OVR base do jogador. */
export function getPlayerOverall(player: {
  age: number | null;
  marketValue: number | null;
  position: string;
  sofascoreOverall?: number | null;
  attributes?: OverallAttributes | null;
}) {
  return calculatePlayerOverall({
    age: player.age,
    marketValue: player.marketValue,
    position: player.position,
    sofascoreOverall: player.sofascoreOverall,
    attributes: player.attributes,
  });
}

/**
 * Penalidade por atuar fora da função natural.
 * O OVR base não muda; somente a eficiência naquela posição muda.
 */
export function getPositionPenalty(
  playerPosition: string,
  requestedRole: string,
) {
  const naturalRole = normalizeRole(playerPosition);
  const targetRole = normalizeRole(requestedRole);

  if (naturalRole === targetRole) return 0;
  if (naturalRole === "GK" || targetRole === "GK") return -15;

  if (
    (naturalRole === "D" && targetRole === "M") ||
    (naturalRole === "M" && (targetRole === "D" || targetRole === "F")) ||
    (naturalRole === "F" && targetRole === "M")
  ) {
    return -3;
  }

  return -7;
}

export function getPositionOverall(
  player: {
    age: number | null;
    marketValue: number | null;
    position: string;
    sofascoreOverall?: number | null;
    attributes?: OverallAttributes | null;
  },
  role: string,
) {
  return clamp(
    getPlayerOverall(player) + getPositionPenalty(player.position, role),
    1,
    99,
  );
}

export function getPlayerPositionLabel(player: {
  positionLabel?: string | null;
  positionsDetailed?: string[];
}) {
  if (!player.positionsDetailed || player.positionsDetailed.length === 0) {
    return player.positionLabel || "Jogador";
  }

  return `${player.positionLabel || "Jogador"} (${player.positionsDetailed.join("/")})`;
}
