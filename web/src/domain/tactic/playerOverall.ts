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
  ATT?: number;
  CRE?: number;
  TEC?: number;
  DEF?: number;
  TAC?: number;

  SAV?: number;
  ANT?: number;
  DIS?: number;
  AER?: number;
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
  sofascoreOriginal?: number | null;

  sofascoreVazia?: SofaScoreAiAttributes | null;

  cartinhaFifa?: FifaAttributes | null;

  desempenhoTotal2026?: number | null;
};

export type PlayerOverallInput = {
  age: number | null | undefined;

  /**
   * Nota original do SofaScore.
   * Ex: 6.8, 7.1, 7.5...
   */
  sofascoreOverall: number | null | undefined;

  /**
   * Dados gerados pela IA.
   */
  overallData?: OverallData | null;

  /**
   * Mantidos por compatibilidade com o restante do projeto.
   * Não participam mais diretamente do OVR.
   */
  marketValue?: number | null | undefined;

  position: string;

  /**
   * Mantido por compatibilidade.
   */
  attributes?: OverallAttributes | null;
};

const MIN_OVERALL = 50;
const MAX_OVERALL = 94;

/**
 * Pesos da composição final.
 *
 * SofaScore original:
 * representa a avaliação geral observada pelo SofaScore.
 *
 * SofaScore IA:
 * complementa o que a nota geral não explica.
 *
 * FIFA IA:
 * representa as características do jogador no modelo FIFA.
 *
 * Desempenho:
 * representa o rendimento na temporada de 2026.
 */
const OVERALL_WEIGHTS = {
  sofascore: 0.30,
  sofascoreAttributes: 0.25,
  fifaAttributes: 0.30,
  performance: 0.15,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeRole(position: string): TacticalRole {
  const normalized = position.toUpperCase().trim();

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
 * Converte uma nota do SofaScore para uma escala FIFA.
 *
 * Exemplos aproximados:
 *
 * 6.0 -> 62
 * 6.5 -> 70
 * 7.0 -> 78
 * 7.5 -> 85
 * 8.0 -> 91
 *
 * A curva evita que pequenas diferenças nas notas mais altas
 * produzam OVRs absurdamente diferentes.
 */
export function sofascoreToOverall(
  sofascore: number | null | undefined,
) {
  if (!isValidNumber(sofascore)) return null;

  const value = clamp(sofascore, 5, 9);

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

  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const current = anchors[index];

    if (value <= current.rating) {
      const progress =
        (value - previous.rating) /
        (current.rating - previous.rating);

      return previous.overall +
        (current.overall - previous.overall) *
        clamp(progress, 0, 1);
    }
  }

  return 94;
}

/**
 * Média ponderada dos atributos disponíveis.
 */
function weightedAverage(
  values: Array<[number | null | undefined, number]>,
) {
  let total = 0;
  let weightTotal = 0;

  for (const [value, weight] of values) {
    if (!isValidNumber(value)) continue;

    total += clamp(value, 1, 99) * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) return null;

  return total / weightTotal;
}

/**
 * ============================================================
 * SOFASCORE IA
 * ============================================================
 *
 * A IA produziu:
 *
 * Linha:
 * ATT / CRE / TEC / DEF / TAC
 *
 * Goleiro:
 * SAV / ANT / TAC / DIS / AER
 *
 * Os pesos mudam de acordo com a posição.
 */
export function sofascoreAttributesToOverall(
  attributes: SofaScoreAiAttributes | null | undefined,
  position: string,
) {
  if (!attributes) return null;

  const role = normalizeRole(position);

  if (role === "GK") {
    return weightedAverage([
      [attributes.SAV, 0.30],
      [attributes.ANT, 0.20],
      [attributes.TAC, 0.15],
      [attributes.DIS, 0.15],
      [attributes.AER, 0.20],
    ]);
  }

  if (role === "D") {
    return weightedAverage([
      [attributes.DEF, 0.30],
      [attributes.TAC, 0.25],
      [attributes.TEC, 0.15],
      [attributes.AER, 0.15],
      [attributes.CRE, 0.10],
      [attributes.ATT, 0.05],
    ]);
  }

  if (role === "M") {
    return weightedAverage([
      [attributes.CRE, 0.25],
      [attributes.TEC, 0.25],
      [attributes.TAC, 0.20],
      [attributes.ATT, 0.15],
      [attributes.DEF, 0.10],
      [attributes.AER, 0.05],
    ]);
  }

  return weightedAverage([
    [attributes.ATT, 0.30],
    [attributes.TEC, 0.25],
    [attributes.CRE, 0.20],
    [attributes.TAC, 0.10],
    [attributes.DEF, 0.05],
    [attributes.AER, 0.10],
  ]);
}

/**
 * ============================================================
 * FIFA IA
 * ============================================================
 *
 * Linha:
 * PAC / SHO / PAS / DRI / DEF / PHY
 *
 * Goleiro:
 * DIV / HAN / KIC / REF / SPD / POS
 */
export function fifaAttributesToOverall(
  attributes: FifaAttributes | null | undefined,
  position: string,
) {
  if (!attributes) return null;

  const role = normalizeRole(position);

  if (role === "GK") {
    return weightedAverage([
      [attributes.DIV, 0.25],
      [attributes.HAN, 0.20],
      [attributes.REF, 0.25],
      [attributes.POS, 0.15],
      [attributes.KIC, 0.10],
      [attributes.SPD, 0.05],
    ]);
  }

  if (role === "D") {
    return weightedAverage([
      [attributes.DEF, 0.30],
      [attributes.PHY, 0.20],
      [attributes.PAC, 0.15],
      [attributes.PAS, 0.15],
      [attributes.DRI, 0.10],
      [attributes.SHO, 0.10],
    ]);
  }

  if (role === "M") {
    return weightedAverage([
      [attributes.PAS, 0.25],
      [attributes.DRI, 0.20],
      [attributes.PHY, 0.15],
      [attributes.PAC, 0.15],
      [attributes.SHO, 0.15],
      [attributes.DEF, 0.10],
    ]);
  }

  return weightedAverage([
    [attributes.SHO, 0.25],
    [attributes.DRI, 0.20],
    [attributes.PAC, 0.20],
    [attributes.PAS, 0.15],
    [attributes.PHY, 0.10],
    [attributes.DEF, 0.10],
  ]);
}

/**
 * ============================================================
 * DESEMPENHO 2026
 * ============================================================
 *
 * A IA fornece uma nota de 0 a 10.
 *
 * Não queremos:
 *
 * 10 -> 100
 *
 * porque isso faria desempenho dominar os atributos.
 *
 * A escala é deliberadamente comprimida.
 */
export function performanceToOverall(
  performance: number | null | undefined,
) {
  if (!isValidNumber(performance)) return null;

  const value = clamp(performance, 0, 10);

  /**
   * 4.0 -> 60
   * 5.0 -> 65
   * 6.0 -> 70
   * 7.0 -> 78
   * 8.0 -> 85
   * 9.0 -> 91
   * 10  -> 94
   */
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

  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const current = anchors[index];

    if (value <= current.rating) {
      const progress =
        (value - previous.rating) /
        (current.rating - previous.rating);

      return previous.overall +
        (current.overall - previous.overall) *
        clamp(progress, 0, 1);
    }
  }

  return 94;
}

/**
 * ============================================================
 * COMPATIBILIDADE
 * ============================================================
 *
 * Mantemos essa função porque outras partes do projeto podem
 * utilizá-la.
 *
 * Agora ela representa somente os atributos genéricos antigos.
 */
export function attributesToOverall(
  attributes: OverallAttributes | null | undefined,
  position: string,
) {
  if (!attributes) return null;

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
      [attributes.creativity, 0.15],
      [attributes.attacking, 0.15],
    ]);
  }

  if (role === "M") {
    return weightedAverage([
      [attributes.creativity, 0.25],
      [attributes.technical, 0.25],
      [attributes.tactical, 0.20],
      [attributes.attacking, 0.15],
      [attributes.defending, 0.15],
    ]);
  }

  return weightedAverage([
    [attributes.attacking, 0.30],
    [attributes.technical, 0.25],
    [attributes.creativity, 0.25],
    [attributes.tactical, 0.10],
    [attributes.defending, 0.10],
  ]);
}

/**
 * ============================================================
 * OVR PRINCIPAL
 * ============================================================
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
   */
  const sofascoreOverall = sofascoreToOverall(
    data?.sofascoreOriginal ?? input.sofascoreOverall,
  );

  if (sofascoreOverall != null) {
    components.push({
      value: sofascoreOverall,
      weight: OVERALL_WEIGHTS.sofascore,
    });
  }

  /**
   * 2. Atributos SofaScore gerados pela IA
   */
  const sofascoreAttributes = sofascoreAttributesToOverall(
    data?.sofascoreVazia,
    input.position,
  );

  if (sofascoreAttributes != null) {
    components.push({
      value: sofascoreAttributes,
      weight: OVERALL_WEIGHTS.sofascoreAttributes,
    });
  }

  /**
   * 3. Cartinha FIFA gerada pela IA
   */
  const fifaAttributes = fifaAttributesToOverall(
    data?.cartinhaFifa,
    input.position,
  );

  if (fifaAttributes != null) {
    components.push({
      value: fifaAttributes,
      weight: OVERALL_WEIGHTS.fifaAttributes,
    });
  }

  /**
   * 4. Desempenho total de 2026
   */
  const performance = performanceToOverall(
    data?.desempenhoTotal2026,
  );

  if (performance != null) {
    components.push({
      value: performance,
      weight: OVERALL_WEIGHTS.performance,
    });
  }

  /**
   * Se nenhuma fonte existir, temos um fallback.
   */
  if (components.length === 0) {
    return MIN_OVERALL;
  }

  /**
   * Redistribui os pesos caso alguma fonte esteja ausente.
   */
  const weightTotal = components.reduce(
    (sum, component) => sum + component.weight,
    0,
  );

  const overall =
    components.reduce(
      (sum, component) =>
        sum + component.value * component.weight,
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

/**
 * OVR base do jogador.
 */
export function getPlayerOverall(
  player: {
    age: number | null;
    marketValue: number | null;
    position: string;
    sofascoreOverall?: number | null;
    overallData?: OverallData | null;
    attributes?: OverallAttributes | null;
  },
) {
  return calculatePlayerOverall({
    age: player.age,
    marketValue: player.marketValue,
    position: player.position,
    sofascoreOverall: player.sofascoreOverall,
    overallData: player.overallData,
    attributes: player.attributes,
  });
}

/**
 * Penalidade por atuar fora da função natural.
 *
 * O OVR base não muda.
 * A penalidade só é aplicada quando o jogador é utilizado
 * em outra função.
 */
export function getPositionPenalty(
  playerPosition: string,
  requestedRole: string,
) {
  const naturalRole = normalizeRole(playerPosition);
  const targetRole = normalizeRole(requestedRole);

  if (naturalRole === targetRole) return 0;

  if (
    naturalRole === "GK" ||
    targetRole === "GK"
  ) {
    return -15;
  }

  if (
    (naturalRole === "D" && targetRole === "M") ||
    (naturalRole === "M" &&
      (targetRole === "D" || targetRole === "F")) ||
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
    overallData?: OverallData | null;
    attributes?: OverallAttributes | null;
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
    return player.positionLabel || "Jogador";
  }

  return `${player.positionLabel || "Jogador"
    } (${player.positionsDetailed.join("/")})`;
}