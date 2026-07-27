/**
 * Central catalogue of engine knobs that affect match-level statistics.
 * Phase 10 calibration adjusts these (manually or via search) until
 * CalibrationRunner averages converge toward Brasileirão targets.
 *
 * Values here are *documentation of current defaults* — the live code
 * still hard-codes most of them. Future work can wire a shared config
 * object through evaluators / actions so a search loop can mutate them.
 */
export interface CalibrationParameters {
  // ── Shot volume & conversion ───────────────────────────────────
  /** Multiplier on ShotEvaluator distanceBase. >1 → more shots attempted. */
  readonly shotUtilityScale: number;
  /** Cap on on-target probability in ShotAction. */
  readonly shotOnTargetCap: number;
  /** Cap on GK save probability. Higher → fewer goals per on-target shot. */
  readonly gkSaveCap: number;
  /** Floor on GK save probability. */
  readonly gkSaveFloor: number;

  // ── Tempo / action frequency ───────────────────────────────────
  /** Default action preparation times scale (ActionExecutionProfile). */
  readonly actionTempoScale: number;

  // ── Discipline (when foul/card systems mature) ─────────────────
  readonly foulRateScale: number;
  readonly yellowCardRateScale: number;
  readonly redCardRateScale: number;

  // ── Set pieces ─────────────────────────────────────────────────
  readonly cornerRateScale: number;
}

/** Baseline parameters matching the engine as of Phase 10 scaffolding. */
export const DEFAULT_CALIBRATION_PARAMETERS: CalibrationParameters = {
  shotUtilityScale: 1.0,
  shotOnTargetCap: 0.88,
  gkSaveCap: 0.85,
  gkSaveFloor: 0.05,
  actionTempoScale: 1.0,
  foulRateScale: 1.0,
  yellowCardRateScale: 1.0,
  redCardRateScale: 1.0,
  cornerRateScale: 1.0,
};

/**
 * Suggested adjustment directions when a metric is off-target.
 * Used by tooling / docs — not applied automatically.
 */
export function suggestAdjustments(
  key: string,
  observed: number,
  target: number,
): string[] {
  const high = observed > target;
  switch (key) {
    case "goals":
      return high
        ? ["↑ gkSaveCap / gkSaveFloor", "↓ shotOnTargetCap", "↓ shotUtilityScale"]
        : ["↓ gkSaveCap", "↑ shotOnTargetCap", "↑ shotUtilityScale"];
    case "shots":
      return high
        ? ["↓ shotUtilityScale", "↑ pass/hold utilities near box"]
        : ["↑ shotUtilityScale", "↓ long-range shot penalty"];
    case "shotsOnTarget":
      return high
        ? ["↓ shotOnTargetCap", "↑ pressure penalty on finishing"]
        : ["↑ shotOnTargetCap", "↓ pressure penalty on finishing"];
    case "fouls":
    case "yellowCards":
    case "redCards":
      return high
        ? [`↓ ${key === "fouls" ? "foulRateScale" : key === "yellowCards" ? "yellowCardRateScale" : "redCardRateScale"}`]
        : [`↑ ${key === "fouls" ? "foulRateScale" : key === "yellowCards" ? "yellowCardRateScale" : "redCardRateScale"}`];
    case "corners":
      return high
        ? ["↓ cornerRateScale", "↓ blocked-shot → corner conversion"]
        : ["↑ cornerRateScale", "↑ blocked-shot → corner conversion"];
    case "averageShotDistance":
      return high
        ? ["↑ close-range shot utility", "↓ longShots bonus"]
        : ["↓ close-range only bias", "↑ longShots utility"];
    default:
      return ["Inspect related evaluator weights and ActionExecution profiles"];
  }
}
