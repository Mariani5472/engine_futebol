/** Single source of truth for parameters tuned against match-level metrics. */
export const ENGINE_CALIBRATION_PARAMETERS = {
  /** Official simulation timestep: 20 updates per simulated second. */
  officialTickSeconds: 0.05,
  shot: {
    cooldownSeconds: 125,
    cornerFromMissRate: 0.58,
    cornerFromParryRate: 0.30,
    goalkeeperSaveBonus: 0.15,
    goalkeeperSaveFloor: 0.55,
    goalkeeperSaveCap: 0.90,
    onTargetProbabilityScale: 1.18,
    onTargetProbabilityCap: 0.75,
    utilityScale: 0.75,
    boxFlatBoost: 42,
    maxPerPossession: 1,
    maxDistanceMeters: 22,
    closeRangeMeters: 14,
    minimumWindowOutsideCloseRange: 0.70,
  },
  discipline: {
    baseFoulChance: 0.045,
    foulDangerFloor: 0.34,
    directRedDanger: 0.97,
    directRedChance: 0.006,
    baseYellowChance: 0.50,
    maxYellowChance: 0.45,
    repeatBookingFactor: 0.013,
  },
  metrics: { xGScale: 0.80 },
} as const;

/** Legacy flat shape retained for calibration-tool API compatibility. */
export interface CalibrationParameters {
  readonly shotUtilityScale: number;
  readonly shotOnTargetCap: number;
  readonly gkSaveCap: number;
  readonly gkSaveFloor: number;
  readonly actionTempoScale: number;
  readonly foulRateScale: number;
  readonly yellowCardRateScale: number;
  readonly redCardRateScale: number;
  readonly cornerRateScale: number;
}

export const DEFAULT_CALIBRATION_PARAMETERS: CalibrationParameters = {
  shotUtilityScale: ENGINE_CALIBRATION_PARAMETERS.shot.utilityScale,
  shotOnTargetCap: ENGINE_CALIBRATION_PARAMETERS.shot.onTargetProbabilityCap,
  gkSaveCap: ENGINE_CALIBRATION_PARAMETERS.shot.goalkeeperSaveCap,
  gkSaveFloor: ENGINE_CALIBRATION_PARAMETERS.shot.goalkeeperSaveFloor,
  actionTempoScale: 1,
  foulRateScale: 1,
  yellowCardRateScale: 1,
  redCardRateScale: 1,
  cornerRateScale: 1,
};

export function suggestAdjustments(key: string, observed: number, target: number): string[] {
  const high = observed > target;
  switch (key) {
    case "goals":
      return high
        ? ["increase gkSaveCap / gkSaveFloor", "decrease shotOnTargetCap", "decrease shotUtilityScale"]
        : ["decrease gkSaveCap", "increase shotOnTargetCap", "increase shotUtilityScale"];
    case "shots":
      return high
        ? ["decrease shotUtilityScale", "increase pass/hold utilities near box"]
        : ["increase shotUtilityScale", "decrease long-range shot penalty"];
    case "shotsOnTarget":
      return high
        ? ["decrease shotOnTargetCap", "increase pressure penalty on finishing"]
        : ["increase shotOnTargetCap", "decrease pressure penalty on finishing"];
    case "fouls":
    case "yellowCards":
    case "redCards": {
      const parameter = key === "fouls"
        ? "foulRateScale"
        : key === "yellowCards" ? "yellowCardRateScale" : "redCardRateScale";
      return [`${high ? "decrease" : "increase"} ${parameter}`];
    }
    case "corners":
      return high
        ? ["decrease cornerRateScale", "decrease blocked-shot to corner conversion"]
        : ["increase cornerRateScale", "increase blocked-shot to corner conversion"];
    case "averageShotDistance":
      return high
        ? ["increase close-range shot utility", "decrease longShots bonus"]
        : ["decrease close-range only bias", "increase longShots utility"];
    default:
      return ["Inspect related evaluator weights and ActionExecution profiles"];
  }
}
