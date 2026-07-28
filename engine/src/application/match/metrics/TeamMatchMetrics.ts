/**
 * Per-team match statistics collected during simulation (Phase 9).
 * Designed so Phase 10 calibration can compare against real league averages.
 */
export interface TeamMatchMetrics {
  readonly goals: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly shotsOffTarget: number;
  readonly shotsBlocked: number;
  readonly shotsSaved: number;
  /** Simple xG sum derived from shot distance / outcome model. */
  readonly xG: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly fouls: number;
  readonly corners: number;
  readonly passes: number;
  readonly progressivePasses: number;
  readonly crosses: number;
  readonly tackles: number;
  readonly interceptions: number;
  readonly clearances: number;
  /** Ball recoveries in the attacking third (high press). */
  readonly highPressRecoveries: number;
  /** Sequences that entered the final third. */
  readonly attacks: number;
  /** Average distance of shots taken (metres). 0 if no shots. */
  readonly averageShotDistance: number;
  /** Possession share 0–100. */
  readonly possessionPercent: number;
  /**
   * Field tilt: % of all possession samples that occurred in this team's
   * attacking third (0–100).
   */
  readonly fieldTiltPercent: number;
  /**
   * Passes allowed per defensive action (PPDA).
   * Lower = more aggressive press. Infinity when no defensive actions.
   */
  readonly ppda: number;
}

export function emptyTeamMetrics(): TeamMatchMetrics {
  return {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    shotsOffTarget: 0,
    shotsBlocked: 0,
    shotsSaved: 0,
    xG: 0,
    yellowCards: 0,
    redCards: 0,
    fouls: 0,
    corners: 0,
    passes: 0,
    progressivePasses: 0,
    crosses: 0,
    tackles: 0,
    interceptions: 0,
    clearances: 0,
    highPressRecoveries: 0,
    attacks: 0,
    averageShotDistance: 0,
    possessionPercent: 50,
    fieldTiltPercent: 50,
    ppda: Number.POSITIVE_INFINITY,
  };
}
