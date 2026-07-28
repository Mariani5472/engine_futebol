import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { buildSimulationConfig } from "../helpers/builders";

describe("MatchEngine — 50ms fixed-step smoke", () => {
  it("completes fifteen simulated minutes without event explosions", () => {
    const result = new MatchEngine().simulate({
      ...buildSimulationConfig(1),
      seed: 1,
      tickDeltaSeconds: 0.05,
      maxDurationSeconds: 15 * 60,
    });

    // eslint-disable-next-line no-console
    console.log({
      tick: 0.05,
      goals: result.metrics.totalGoals,
      shots: result.metrics.totalShots,
      fouls: result.metrics.totalFouls,
      yellows: result.metrics.totalYellowCards,
      reds: result.metrics.totalRedCards,
      xG: result.metrics.totalxG,
    });

    expect(result.matchDurationSeconds).toBeCloseTo(15 * 60, 6);
    expect(Number.isFinite(result.metrics.totalxG)).toBe(true);
    expect(result.metrics.totalShots).toBeGreaterThan(0);
    expect(result.metrics.totalFouls).toBeLessThan(25);
    expect(result.metrics.totalRedCards).toBeLessThan(3);
  }, 600_000);
});
