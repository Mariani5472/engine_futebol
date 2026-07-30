/**
 * Reference league averages used as calibration targets (Phase 10).
 *
 * Values approximate Brasileirão Série A 2025 match averages
 * (combined home + away per 90 minutes).
 *
 * Tolerance is the relative band accepted as "converged"
 * (e.g. 0.20 = ±20% of target).
 */
export interface CalibrationTarget {
  readonly key: string;
  readonly label: string;
  readonly target: number;
  readonly tolerance: number;
  /** How to extract the observed value from aggregated run averages. */
  readonly extract: (avg: CalibrationObservedAverages) => number;
}

/** Per-match averages produced by a calibration batch. */
export interface CalibrationObservedAverages {
  readonly goals: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly corners: number;
  readonly fouls: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly xG: number;
  readonly averageShotDistance: number;
  readonly passes: number;
  readonly progressivePasses: number;
  readonly highPressRecoveries: number;
  readonly attacks: number;
  readonly possessionHome: number;
}

export const BRASILEIRAO_2025_TARGETS: readonly CalibrationTarget[] = [
  {
    key: "goals",
    label: "Gols / jogo",
    target: 2.5,
    tolerance: 0.25,
    extract: (a) => a.goals,
  },
  {
    key: "shots",
    label: "Finalizações / jogo",
    target: 25,
    tolerance: 0.25,
    extract: (a) => a.shots,
  },
  {
    key: "shotsOnTarget",
    label: "Chutes no alvo / jogo",
    target: 8.8,
    tolerance: 0.30,
    extract: (a) => a.shotsOnTarget,
  },
  {
    key: "corners",
    label: "Escanteios / jogo",
    target: 10.5,
    tolerance: 0.40,
    extract: (a) => a.corners,
  },
  {
    key: "fouls",
    label: "Faltas / jogo",
    target: 28,
    tolerance: 0.40,
    extract: (a) => a.fouls,
  },
  {
    key: "yellowCards",
    label: "Amarelos / jogo",
    target: 4.6,
    tolerance: 0.40,
    extract: (a) => a.yellowCards,
  },
  {
    key: "redCards",
    label: "Vermelhos / jogo",
    target: 0.22,
    tolerance: 0.75,
    extract: (a) => a.redCards,
  },
  {
    key: "xG",
    label: "xG total / jogo",
    target: 2.5,
    tolerance: 0.35,
    extract: (a) => a.xG,
  },
  {
    key: "averageShotDistance",
    label: "Distância média do chute (m)",
    target: 16,
    tolerance: 0.35,
    extract: (a) => a.averageShotDistance,
  },
];
