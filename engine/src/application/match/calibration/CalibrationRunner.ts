import { MatchEngine } from "../engine/MatchEngine";
import { SimulationConfig } from "../engine/SimulationConfig";
import {
  CalibrationObservedAverages,
} from "./BrasileiraoTargets";
import {
  buildCalibrationReport,
  CalibrationReport,
  formatCalibrationReport,
} from "./CalibrationReport";
import { ENGINE_CALIBRATION_PARAMETERS } from "./CalibrationParameters";

export interface CalibrationRunOptions {
  /** Number of matches to simulate. Default 50 for CI-friendly runs. */
  readonly matchCount?: number;
  /** First RNG seed; subsequent matches use seedStart + i. */
  readonly seedStart?: number;
  /** Tick size in seconds. Defaults to the official 0.05s timestep. */
  readonly tickDeltaSeconds?: number;
  /** Match length override in seconds. Default 5400 (90 min). */
  readonly maxDurationSeconds?: number;
  /** Base SimulationConfig factory (teams, tactics, pitch). */
  readonly buildConfig: (seed: number) => SimulationConfig;
  /** Optional progress callback after each match. */
  readonly onMatchComplete?: (index: number, total: number) => void;
}

export interface CalibrationBatchResult {
  readonly report: CalibrationReport;
  readonly formatted: string;
  /** Per-match raw totals for further analysis. */
  readonly samples: readonly MatchSample[];
}

export interface MatchSample {
  readonly seed: number;
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
  /** Terminal spatial outcomes, derived from the authoritative event stream. */
  readonly shotOutcomes: ShotOutcomeSample;
  readonly unresolvedShotIds: readonly string[];
}

export interface ShotOutcomeSample {
  blocked: number;
  offTarget: number;
  woodwork: number;
  savedCaught: number;
  savedParried: number;
  goals: number;
  unresolved: number;
}

export interface AverageShotOutcomes extends Readonly<ShotOutcomeSample> {
  readonly total: number;
}

export interface CalibrationDistribution {
  readonly goalsMedian: number;
  readonly goalsP10: number;
  readonly goalsP90: number;
  readonly zeroGoalMatchRate: number;
  readonly shotsMedian: number;
  readonly shotsOnTargetMedian: number;
}

/**
 * Runs N deterministic matches and compares aggregate metrics
 * against Brasileirão calibration targets (Phase 10).
 */
export class CalibrationRunner {
  private readonly engine = new MatchEngine();

  public run(options: CalibrationRunOptions): CalibrationBatchResult {
    const matchCount = options.matchCount ?? 50;
    const seedStart = options.seedStart ?? 1;
    const tickDeltaSeconds = options.tickDeltaSeconds
      ?? ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds;
    const maxDurationSeconds = options.maxDurationSeconds ?? 90 * 60;

    const samples: MatchSample[] = [];

    for (let i = 0; i < matchCount; i++) {
      const seed = seedStart + i;
      const config: SimulationConfig = {
        ...options.buildConfig(seed),
        seed,
        tickDeltaSeconds,
        maxDurationSeconds,
      };

      const result = this.engine.simulate(config);
      const homeEventReport = result.analytics.teams[result.homeTeamId];
      const awayEventReport = result.analytics.teams[result.awayTeamId];
      const eventTotal = (key: keyof typeof homeEventReport): number =>
        Number(homeEventReport[key]) + Number(awayEventReport[key]);
      const resolvedShots=result.eventStore.filter(event=>event.type==="SHOT_RESOLVED");
      const terminalShotIds = new Set(resolvedShots.map(event=>String(event.metadata.shotId)));
      const unresolvedShotIds = result.eventStore
        .filter(event => event.type === "SHOT" && !terminalShotIds.has(event.id))
        .map(event => event.id);
      const shotOutcomes: ShotOutcomeSample = {
        blocked: resolvedShots.filter(event=>event.metadata.finalOutcome==="BLOCKED").length,
        offTarget: resolvedShots.filter(event=>event.metadata.finalOutcome==="OFF_TARGET").length,
        woodwork: resolvedShots.filter(event=>["POST","CROSSBAR"].includes(String(event.metadata.finalOutcome))).length,
        savedCaught: resolvedShots.filter(event=>event.metadata.finalOutcome==="SAVED_CAUGHT").length,
        savedParried: resolvedShots.filter(event=>event.metadata.finalOutcome==="SAVED_PARRIED").length,
        goals: resolvedShots.filter(event=>event.metadata.finalOutcome==="GOAL").length,
        unresolved: unresolvedShotIds.length,
      };

      samples.push({
        seed,
        goals: eventTotal("goals"),
        shots: eventTotal("shots"),
        shotsOnTarget: eventTotal("shotsOnTarget"),
        corners: eventTotal("corners"),
        fouls: eventTotal("fouls"),
        yellowCards: eventTotal("yellowCards"),
        redCards: eventTotal("redCards"),
        xG:eventTotal("xG"),
        averageShotDistance:eventTotal("shots")
          ? (homeEventReport.averageShotDistance*homeEventReport.shots+awayEventReport.averageShotDistance*awayEventReport.shots)/eventTotal("shots") : 0,
        passes: eventTotal("passesAttempted"),
        progressivePasses: eventTotal("progressivePasses"),
        highPressRecoveries:eventTotal("highPressRecoveries"),
        attacks:eventTotal("attacks"),
        possessionHome: homeEventReport.possessionPercent,
        shotOutcomes,
        unresolvedShotIds,
      });

      options.onMatchComplete?.(i + 1, matchCount);
    }

    const averages = averageSamples(samples);
    const report = buildCalibrationReport(averages, matchCount, seedStart);

    return {
      report,
      formatted: formatCalibrationReport(report),
      samples,
    };
  }
}

export function averageShotOutcomes(samples: readonly MatchSample[]): AverageShotOutcomes {
  const n = samples.length || 1;
  const totals = samples.reduce<ShotOutcomeSample>((acc, sample) => ({
    blocked: acc.blocked + sample.shotOutcomes.blocked,
    offTarget: acc.offTarget + sample.shotOutcomes.offTarget,
    woodwork: acc.woodwork + sample.shotOutcomes.woodwork,
    savedCaught: acc.savedCaught + sample.shotOutcomes.savedCaught,
    savedParried: acc.savedParried + sample.shotOutcomes.savedParried,
    goals: acc.goals + sample.shotOutcomes.goals,
    unresolved: acc.unresolved + sample.shotOutcomes.unresolved,
  }), {
    blocked: 0, offTarget: 0, woodwork: 0, savedCaught: 0,
    savedParried: 0, goals: 0, unresolved: 0,
  });
  const average = {
    blocked: totals.blocked / n,
    offTarget: totals.offTarget / n,
    woodwork: totals.woodwork / n,
    savedCaught: totals.savedCaught / n,
    savedParried: totals.savedParried / n,
    goals: totals.goals / n,
    unresolved: totals.unresolved / n,
  };
  return { ...average, total: Object.values(average).reduce((sum, value) => sum + value, 0) };
}

export function calibrationDistribution(samples: readonly MatchSample[]): CalibrationDistribution {
  const quantile = (values: readonly number[], q: number): number => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * q;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  };
  return {
    goalsMedian: quantile(samples.map(sample => sample.goals), .5),
    goalsP10: quantile(samples.map(sample => sample.goals), .1),
    goalsP90: quantile(samples.map(sample => sample.goals), .9),
    zeroGoalMatchRate: samples.length
      ? samples.filter(sample => sample.goals === 0).length / samples.length
      : 0,
    shotsMedian: quantile(samples.map(sample => sample.shots), .5),
    shotsOnTargetMedian: quantile(samples.map(sample => sample.shotsOnTarget), .5),
  };
}

function averageSamples(samples: readonly MatchSample[]): CalibrationObservedAverages {
  const n = samples.length || 1;
  const sum = samples.reduce(
    (acc, s) => ({
      goals: acc.goals + s.goals,
      shots: acc.shots + s.shots,
      shotsOnTarget: acc.shotsOnTarget + s.shotsOnTarget,
      corners: acc.corners + s.corners,
      fouls: acc.fouls + s.fouls,
      yellowCards: acc.yellowCards + s.yellowCards,
      redCards: acc.redCards + s.redCards,
      xG: acc.xG + s.xG,
      averageShotDistance: acc.averageShotDistance + s.averageShotDistance,
      passes: acc.passes + s.passes,
      progressivePasses: acc.progressivePasses + s.progressivePasses,
      highPressRecoveries: acc.highPressRecoveries + s.highPressRecoveries,
      attacks: acc.attacks + s.attacks,
      possessionHome: acc.possessionHome + s.possessionHome,
    }),
    {
      goals: 0,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      xG: 0,
      averageShotDistance: 0,
      passes: 0,
      progressivePasses: 0,
      highPressRecoveries: 0,
      attacks: 0,
      possessionHome: 0,
    },
  );

  return {
    goals: sum.goals / n,
    shots: sum.shots / n,
    shotsOnTarget: sum.shotsOnTarget / n,
    corners: sum.corners / n,
    fouls: sum.fouls / n,
    yellowCards: sum.yellowCards / n,
    redCards: sum.redCards / n,
    xG: sum.xG / n,
    averageShotDistance: sum.averageShotDistance / n,
    passes: sum.passes / n,
    progressivePasses: sum.progressivePasses / n,
    highPressRecoveries: sum.highPressRecoveries / n,
    attacks: sum.attacks / n,
    possessionHome: sum.possessionHome / n,
  };
}
