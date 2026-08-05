/** Single source of truth for parameters tuned against match-level metrics. */
export const ENGINE_CALIBRATION_PARAMETERS = {
  /** Official simulation timestep: 20 updates per simulated second. */
  officialTickSeconds: 0.05,
  passing: {
    maximumGroundPassMeters: 44,
    utilityBoost: 7,
    executionErrorExponent: 0.65,
    executionErrorDistanceScale: 0.90,
    maximumExecutionErrorMeters: 16,
    minimumArrivalMarginSeconds: -0.45,
  },
  defending: {
    tackleCooldownSeconds: 3.75,
    tackleContactRadiusMeters: 1.60,
    tackleUtilityFloor: 48,
  },
  shot: {
    cooldownSeconds: 105,
    cornerFromMissRate: 0.58,
    cornerFromParryRate: 0.30,
    goalkeeperSaveBonus: 0.26,
    goalkeeperSaveFloor: 0.55,
    goalkeeperSaveCap: 0.90,
    onTargetProbabilityScale: 1.18,
    onTargetProbabilityCap: 0.75,
    utilityScale: 0.86,
    boxFlatBoost: 42,
    maxPerPossession: 1,
    maxDistanceMeters: 24,
    closeRangeMeters: 14,
    minimumWindowOutsideCloseRange: 0.68,
    /** Spatial execution parameters; these shape outcomes, never pick them. */
    aimLateralBaseMeters: 0.75,
    aimTechniqueScaleMeters: 0.75,
    aimQualityScaleMeters: 0.45,
    placedErrorMeters: 1.65,
    powerErrorMeters: 2.55,
    chipErrorMeters: 1.80,
    lateralErrorMultiplier: 7.20,
    heightErrorMultiplier: 1.60,
    goalkeeperBodyReachMeters: 2.60,
    goalkeeperAerialReachScaleMeters: 0.70,
    goalkeeperCatchSpeedMetersPerSecond: 34,
    goalkeeperReactionBaseSeconds: 0.32,
    goalkeeperReactionReflexScaleSeconds: 0.16,
    goalkeeperReactionAnticipationScaleSeconds: 0.07,
    goalkeeperReactionConcentrationScaleSeconds: 0.04,
    goalkeeperMinimumReactionSeconds: 0.08,
  },
  discipline: {
    // With tackles now counted only at physical contact, unsuccessful
    // challenges must carry the foul probability previously diluted across
    // hundreds of non-contact "attempts".
    baseFoulChance: 0.92,
    foulDangerFloor: 0.18,
    directRedDanger: 0.97,
    directRedChance: 0.006,
    baseYellowChance: 0.22,
    maxYellowChance: 0.32,
    repeatBookingFactor: 0.05,
  },
  assists: {
    maxPassAgeSeconds: 8,
    allowDefenderDeflection: true,
    allowGoalkeeperParry: true,
    allowWoodworkRebound: true,
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
        ? ["reduce spatial finishing precision", "increase goalkeeper reaction/reach", "decrease shot utility only if volume is also high"]
        : ["inspect unresolved spatial shots", "reduce goalkeeper reaction/reach", "increase shot utility only if volume is also low"];
    case "shots":
      return high
        ? ["decrease shotUtilityScale", "increase pass/hold utilities near box"]
        : ["increase shotUtilityScale", "decrease long-range shot penalty"];
    case "shotsOnTarget":
      return high
        ? ["increase spatial execution error", "increase pressure penalty on finishing"]
        : ["reduce spatial execution error", "inspect defender block envelope"];
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
