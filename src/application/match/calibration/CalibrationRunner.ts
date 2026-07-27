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

export interface CalibrationRunOptions {
  /** Number of matches to simulate. Default 50 for CI-friendly runs. */
  readonly matchCount?: number;
  /** First RNG seed; subsequent matches use seedStart + i. */
  readonly seedStart?: number;
  /** Tick size in seconds (larger = faster, coarser). Default 2. */
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
    const tickDeltaSeconds = options.tickDeltaSeconds ?? 2;
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
      const m = result.metrics;

      samples.push({
        seed,
        goals: m.totalGoals,
        shots: m.totalShots,
        shotsOnTarget: m.totalShotsOnTarget,
        corners: m.totalCorners,
        fouls: m.totalFouls,
        yellowCards: m.totalYellowCards,
        redCards: m.totalRedCards,
        xG: m.totalxG,
        averageShotDistance: m.averageShotDistance,
        passes: m.home.passes + m.away.passes,
        progressivePasses:
          m.home.progressivePasses + m.away.progressivePasses,
        highPressRecoveries:
          m.home.highPressRecoveries + m.away.highPressRecoveries,
        attacks: m.home.attacks + m.away.attacks,
        possessionHome: m.home.possessionPercent,
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
