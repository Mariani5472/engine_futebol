import { ENGINE_CALIBRATION_PARAMETERS } from "../../src/application/match/calibration/CalibrationParameters";
import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { buildSimulationConfig } from "../helpers/builders";

const FIXED_SEEDS = [1, 7, 19] as const;
const SAMPLE_DURATION_SECONDS = 3 * 60;

describe("calibration regression at the official 50ms timestep", () => {
  it("keeps fixed seeds deterministic and free from event explosions", () => {
    const samples = FIXED_SEEDS.map((seed) => {
      const result = new MatchEngine().simulate({
        ...buildSimulationConfig(seed),
        seed,
        tickDeltaSeconds: ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds,
        maxDurationSeconds: SAMPLE_DURATION_SECONDS,
      });

      expect(result.matchDurationSeconds).toBeCloseTo(SAMPLE_DURATION_SECONDS, 6);
      expect(Number.isFinite(result.metrics.totalxG)).toBe(true);
      expect(result.metrics.totalShots).toBeLessThan(15);
      expect(result.metrics.totalFouls).toBeLessThan(15);
      expect(result.metrics.totalRedCards).toBeLessThan(2);

      return {
        goals: result.metrics.totalGoals,
        shots: result.metrics.totalShots,
        fouls: result.metrics.totalFouls,
        xG: result.metrics.totalxG,
      };
    });

    const totals = samples.reduce(
      (sum, sample) => ({
        goals: sum.goals + sample.goals,
        shots: sum.shots + sample.shots,
        fouls: sum.fouls + sample.fouls,
        xG: sum.xG + sample.xG,
      }),
      { goals: 0, shots: 0, fouls: 0, xG: 0 },
    );

    expect(totals.shots).toBeGreaterThan(0);
    expect(totals.fouls).toBeGreaterThan(0);
    expect(totals.xG).toBeGreaterThan(0);
  }, 300_000);
});
