import { CalibrationRunner } from "../../../src/application/match/calibration";
import { buildSimulationConfig } from "../../helpers/builders";

describe("CalibrationRunner", () => {
  it("runs a small batch and returns structured averages", () => {
    const runner = new CalibrationRunner();

    // Very short matches for unit speed (2 min @ 5s ticks).
    const result = runner.run({
      matchCount: 2,
      seedStart: 100,
      tickDeltaSeconds: 5,
      maxDurationSeconds: 120,
      buildConfig: (seed) => buildSimulationConfig(seed),
    });

    expect(result.samples).toHaveLength(2);
    expect(result.report.matchCount).toBe(2);
    expect(result.report.averages.goals).toBeGreaterThanOrEqual(0);
    expect(result.report.averages.shots).toBeGreaterThanOrEqual(0);
    expect(result.formatted).toContain("Calibration report");
    expect(result.report.comparisons.length).toBeGreaterThan(0);
  }, 120_000);
});
