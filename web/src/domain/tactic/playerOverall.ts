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

export type SofaScoreAiAttributes = {
  ATT?: number | null;
  CRE?: number | null;
  TEC?: number | null;
  DEF?: number | null;
  TAC?: number | null;
  SAV?: number | null;
  ANT?: number | null;
  DIS?: number | null;
  AER?: number | null;
};

export type FifaAttributes = {
  PAC?: number;
  SHO?: number;
  PAS?: number;
  DRI?: number;
  DEF?: number;
  PHY?: number;
  DIV?: number;
  HAN?: number;
  KIC?: number;
  REF?: number;
  SPD?: number;
  POS?: number;
};

export type OverallData = {
  sofascoreOriginal?: SofaScoreAiAttributes | null;
  sofascoreVazia?: SofaScoreAiAttributes | null;
  cartinhaFifa?: FifaAttributes | null;
  desempenhoTotal2026?: number | null;
};

export type PlayerOverallInput = {
  age: number | null | undefined;
  sofascoreOverall: number | null | undefined;
  overallData?: OverallData | null;
  marketValue?: number | null | undefined;
  position: string;
};

const MIN_OVERALL = 50;
const MAX_OVERALL = 94;

const OVERALL_WEIGHTS = {
  sofascore: 0.05,
  sofascoreAttributes: 0.05,
  fifaAttributes: 0.60,
  performance: 0.30,
} as const;

const SOFASCORE_ATTRIBUTE_WEIGHTS: Record<
  TacticalRole,
  Partial<Record<keyof SofaScoreAiAttributes, number>>
> = {
  GK: {
    SAV: 0.30,
    ANT: 0.20,
    TAC: 0.15,
    DIS: 0.15,
    AER: 0.20,
  },

  D: {
    DEF: 0.30,
    TAC: 0.25,
    TEC: 0.15,
    AER: 0.15,
    CRE: 0.10,
    ATT: 0.05,
  },

  M: {
    CRE: 0.25,
    TEC: 0.25,
    TAC: 0.20,
    ATT: 0.15,
    DEF: 0.10,
    AER: 0.05,
  },

  F: {
    ATT: 0.30,
    TEC: 0.25,
    CRE: 0.20,
    TAC: 0.10,
    DEF: 0.05,
    AER: 0.10,
  },
};

const FIFA_ATTRIBUTE_WEIGHTS: Record<
  TacticalRole,
  Partial<Record<keyof FifaAttributes, number>>
> = {
  GK: {
    DIV: 0.25,
    HAN: 0.20,
    REF: 0.25,
    POS: 0.15,
    KIC: 0.10,
    SPD: 0.05,
  },

  D: {
    DEF: 0.30,
    PHY: 0.20,
    PAC: 0.15,
    PAS: 0.15,
    DRI: 0.10,
    SHO: 0.10,
  },

  M: {
    PAS: 0.25,
    DRI: 0.20,
    PHY: 0.15,
    PAC: 0.15,
    SHO: 0.15,
    DEF: 0.10,
  },

  F: {
    SHO: 0.25,
    DRI: 0.20,
    PAC: 0.20,
    PAS: 0.15,
    PHY: 0.10,
    DEF: 0.10,
  },
};

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(min, Math.min(max, value));
}

function isValidNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function normalizeRole(position: string): TacticalRole {
  const normalized = (position ?? 'F')
    .toUpperCase()
    .trim();

  if (normalized == "NAO DEU") console.log(normalized)
  if (
    normalized === "G" ||
    normalized === "GK" ||
    normalized === "GL"
  ) {
    return "GK";
  }

  if (
    normalized === "D" ||
    normalized.startsWith("D") ||
    normalized.includes("DEF")
  ) {
    return "D";
  }

  if (
    normalized === "M" ||
    normalized.startsWith("M") ||
    normalized.startsWith("AM") ||
    normalized.includes("MID")
  ) {
    return "M";
  }

  return "F";
}

/**
 * Converte uma nota SofaScore tradicional (5-9)
 * para o intervalo de Overall utilizado pelo jogo.
 *
 * Esta função é utilizada somente como fallback
 * quando sofascoreOriginal não estiver disponível.
 */
export function sofascoreToOverall(
  sofascore: number | null | undefined,
) {
  if (!isValidNumber(sofascore)) {
    return null;
  }

  const value = clamp(
    sofascore,
    5,
    9,
  );

  const anchors = [
    { rating: 5.0, overall: 50 },
    { rating: 5.5, overall: 55 },
    { rating: 6.0, overall: 62 },
    { rating: 6.5, overall: 70 },
    { rating: 7.0, overall: 78 },
    { rating: 7.5, overall: 85 },
    { rating: 8.0, overall: 91 },
    { rating: 8.5, overall: 94 },
    { rating: 9.0, overall: 94 },
  ];

  for (
    let index = 1;
    index < anchors.length;
    index += 1
  ) {
    const previous = anchors[index - 1];
    const current = anchors[index];

    if (value <= current.rating) {
      const progress =
        (value - previous.rating) /
        (current.rating - previous.rating);

      return (
        previous.overall +
        (current.overall - previous.overall) *
        clamp(progress, 0, 1)
      );
    }
  }

  return 94;
}

/**
 * Calcula uma média ponderada ignorando valores inválidos.
 *
 * Quando um atributo não existe ou é inválido,
 * seu peso é redistribuído entre os atributos válidos.
 */
function weightedAverage(
  values: Array<
    [number | null | undefined, number]
  >,
) {
  let total = 0;
  let weightTotal = 0;

  for (const [value, weight] of values) {
    if (!isValidNumber(value)) {
      continue;
    }

    if (value < 1 || value > 99) {
      continue;
    }

    total += value * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) {
    return null;
  }

  return total / weightTotal;
}

/**
 * Calcula o Overall de uma fonte de atributos
 * do SofaScore.
 *
 * Os atributos possuem escala 1-99.
 */
function calculateSofaScoreAttributeOverall(
  attributes: SofaScoreAiAttributes | null | undefined,
  role: TacticalRole,
) {
  if (!attributes) {
    return null;
  }

  const weights =
    SOFASCORE_ATTRIBUTE_WEIGHTS[role];

  const values = Object.entries(weights).map(
    ([attribute, weight]) => [
      attributes[
      attribute as keyof SofaScoreAiAttributes
      ],
      weight,
    ] as [
        number | null | undefined,
        number,
      ],
  );

  return weightedAverage(values);
}

/**
 * Calcula o Overall dos atributos originais
 * extraídos do SofaScore.
 */
export function sofascoreOriginalToOverall(
  attributes: SofaScoreAiAttributes | null | undefined,
  position: string,
) {
  const role = normalizeRole(position);

  return calculateSofaScoreAttributeOverall(
    attributes,
    role,
  );
}

/**
 * Calcula o Overall dos atributos SofaScore
 * estimados pela IA.
 *
 * sofascoreVazia utiliza exatamente a mesma
 * estrutura de atributos e os mesmos pesos
 * posicionais do SofaScore original.
 */
export function sofascoreAttributesToOverall(
  attributes: SofaScoreAiAttributes | null | undefined,
  position: string,
) {
  const role = normalizeRole(position);

  return calculateSofaScoreAttributeOverall(
    attributes,
    role,
  );
}

/**
 * Calcula o Overall dos atributos FIFA estimados
 * pela IA.
 */
export function fifaAttributesToOverall(
  attributes: FifaAttributes | null | undefined,
  position: string,
) {
  if (!attributes) {
    return null;
  }

  const role = normalizeRole(position);
  const weights =
    FIFA_ATTRIBUTE_WEIGHTS[role];

  const values = Object.entries(weights).map(
    ([attribute, weight]) => [
      attributes[
      attribute as keyof FifaAttributes
      ],
      weight,
    ] as [
        number | null | undefined,
        number,
      ],
  );

  return weightedAverage(values);
}

/**
 * Converte o desempenho da temporada 2026
 * de 0-10 para Overall.
 */
export function performanceToOverall(
  performance: number | null | undefined,
) {
  if (!isValidNumber(performance)) {
    return null;
  }

  const value = clamp(
    performance,
    0,
    10,
  );

  const anchors = [
    { rating: 0, overall: 50 },
    { rating: 4, overall: 60 },
    { rating: 5, overall: 65 },
    { rating: 6, overall: 70 },
    { rating: 7, overall: 78 },
    { rating: 8, overall: 85 },
    { rating: 9, overall: 91 },
    { rating: 10, overall: 94 },
  ];

  for (
    let index = 1;
    index < anchors.length;
    index += 1
  ) {
    const previous = anchors[index - 1];
    const current = anchors[index];

    if (value <= current.rating) {
      const progress =
        (value - previous.rating) /
        (current.rating - previous.rating);

      return (
        previous.overall +
        (current.overall - previous.overall) *
        clamp(progress, 0, 1)
      );
    }
  }

  return 94;
}

/**
 * Modelo antigo de atributos.
 *
 * Mantido para compatibilidade com partes
 * antigas do sistema.
 */
export function attributesToOverall(
  attributes: OverallAttributes | null | undefined,
  position: string,
) {
  if (!attributes) {
    return null;
  }

  const role = normalizeRole(position);

  if (role === "GK") {
    return weightedAverage([
      [attributes.saves, 0.30],
      [attributes.anticipation, 0.20],
      [attributes.tactical, 0.15],
      [attributes.ballDistribution, 0.15],
      [attributes.aerial, 0.20],
    ]);
  }

  if (role === "D") {
    return weightedAverage([
      [attributes.defending, 0.30],
      [attributes.tactical, 0.25],
      [attributes.technical, 0.15],
      [attributes.aerial, 0.15],
      [attributes.creativity, 0.10],
      [attributes.attacking, 0.05],
    ]);
  }

  if (role === "M") {
    return weightedAverage([
      [attributes.creativity, 0.25],
      [attributes.technical, 0.25],
      [attributes.tactical, 0.20],
      [attributes.attacking, 0.15],
      [attributes.defending, 0.10],
      [attributes.aerial, 0.05],
    ]);
  }

  return weightedAverage([
    [attributes.attacking, 0.30],
    [attributes.technical, 0.25],
    [attributes.creativity, 0.20],
    [attributes.tactical, 0.10],
    [attributes.defending, 0.05],
    [attributes.aerial, 0.10],
  ]);
}

/**
 * Calcula o Overall final do jogador.
 *
 * Fontes:
 *
 * SofaScore original: 30%
 * SofaScore IA:       25%
 * FIFA IA:            30%
 * Desempenho 2026:   15%
 *
 * Quando uma fonte não existe, seu peso é
 * redistribuído proporcionalmente entre as
 * fontes disponíveis.
 */
export function calculatePlayerOverall(
  input: PlayerOverallInput,
) {
  const data = input.overallData;

  const components: Array<{
    value: number;
    weight: number;
  }> = [];

  /**
   * 1. SofaScore original
   *
   * Prioridade:
   * sofascoreOriginal -> sofascoreOverall legado
   */
  const sofascoreOriginalOverall =
    sofascoreOriginalToOverall(
      data?.sofascoreOriginal,
      input.position,
    );

  const sofascoreOverall =
    sofascoreOriginalOverall ??
    sofascoreToOverall(
      input.sofascoreOverall,
    );

  if (sofascoreOverall != null) {
    components.push({
      value: sofascoreOverall,
      weight: OVERALL_WEIGHTS.sofascore,
    });
  }

  /**
   * 2. SofaScore estimado pela IA
   */
  const sofascoreAiOverall =
    sofascoreAttributesToOverall(
      data?.sofascoreVazia,
      input.position,
    );

  if (sofascoreAiOverall != null) {
    components.push({
      value: sofascoreAiOverall,
      weight:
        OVERALL_WEIGHTS.sofascoreAttributes,
    });
  }

  /**
   * 3. FIFA estimado pela IA
   */
  const fifaOverall =
    fifaAttributesToOverall(
      data?.cartinhaFifa,
      input.position,
    );

  if (fifaOverall != null) {
    components.push({
      value: fifaOverall,
      weight:
        OVERALL_WEIGHTS.fifaAttributes,
    });
  }

  /**
   * 4. Desempenho total de 2026
   */
  const performance =
    performanceToOverall(
      data?.desempenhoTotal2026,
    );

  if (performance != null) {
    components.push({
      value: performance,
      weight:
        OVERALL_WEIGHTS.performance,
    });
  }

  /**
   * Nenhuma fonte disponível.
   */

  console.log(components)
  if (components.length === 0) {
    return MIN_OVERALL;
  }

  /**
   * Redistribui automaticamente os pesos
   * das fontes inexistentes.
   */
  const weightTotal =
    components.reduce(
      (sum, component) =>
        sum + component.weight,
      0,
    );

  const overall =
    components.reduce(
      (sum, component) =>
        sum +
        component.value *
        component.weight,
      0,
    ) / weightTotal;

  return Math.round(
    clamp(
      overall,
      MIN_OVERALL,
      MAX_OVERALL,
    ),
  );
}

export function getPlayerOverall(
  player: {
    age: number | null;
    marketValue: number | null;
    position: string;
    sofascoreOverall?: number | null;
    overallData?: OverallData | null | undefined;
  },
) {
  return calculatePlayerOverall({
    age: player.age,
    marketValue: player.marketValue,
    position: player.position,
    sofascoreOverall: player.sofascoreOverall,
    overallData: player.overallData,
  });
}

export function getPositionPenalty(
  playerPosition: string,
  requestedRole: string,
) {
  const naturalRole =
    normalizeRole(playerPosition);

  const targetRole =
    normalizeRole(requestedRole);

  if (naturalRole === targetRole) {
    return 0;
  }

  /**
   * Qualquer jogador em uma função de GK
   * diferente da sua recebe -15.
   */
  if (
    naturalRole === "GK" ||
    targetRole === "GK"
  ) {
    return -15;
  }

  /**
   * D <-> M
   * M <-> F
   */
  if (
    (naturalRole === "D" &&
      targetRole === "M") ||
    (naturalRole === "M" &&
      targetRole === "D") ||
    (naturalRole === "M" &&
      targetRole === "F") ||
    (naturalRole === "F" &&
      targetRole === "M")
  ) {
    return -3;
  }

  /**
   * Outras incompatibilidades.
   */
  return -7;
}

export function getPositionOverall(
  player: {
    age: number | null;
    marketValue: number | null;
    position: string;
    sofascoreOverall?: number | null;
    overallData?: OverallData | null;
  },
  role: string,
) {
  return clamp(
    getPlayerOverall(player) +
    getPositionPenalty(
      player.position,
      role,
    ),
    1,
    99,
  );
}

export function getPlayerPositionLabel(
  player: {
    positionLabel?: string | null;
    positionsDetailed?: string[];
  },
) {
  if (
    !player.positionsDetailed ||
    player.positionsDetailed.length === 0
  ) {
    return (
      player.positionLabel ||
      "Jogador"
    );
  }

  return `${player.positionLabel ||
    "Jogador"
    } (${player.positionsDetailed.join("/")})`;
}