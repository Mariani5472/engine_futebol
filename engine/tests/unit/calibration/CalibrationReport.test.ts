import {
  BRASILEIRAO_2025_TARGETS,
  buildCalibrationReport,
  formatCalibrationReport,
  suggestAdjustments,
} from "../../../src/application/match/calibration";

describe("CalibrationReport", () => {
  const perfectAverages = {
    goals: 2.5,
    shots: 25,
    shotsOnTarget: 8.8,
    corners: 10.5,
    fouls: 28,
    yellowCards: 4.6,
    redCards: 0.22,
    xG: 2.5,
    averageShotDistance: 16,
    passes: 800,
    progressivePasses: 40,
    highPressRecoveries: 8,
    attacks: 20,
    possessionHome: 50,
  };

  it("marks all primary metrics within tolerance when on target", () => {
    const report = buildCalibrationReport(perfectAverages, 100, 1);

    expect(report.converged).toBe(true);
    expect(report.convergenceScore).toBe(1);
    for (const c of report.comparisons) {
      expect(c.withinTolerance).toBe(true);
    }
  });

  it("flags goals as out of band when far from target", () => {
    const report = buildCalibrationReport(
      { ...perfectAverages, goals: 0.2 },
      50,
      1,
    );

    const goals = report.comparisons.find((c) => c.key === "goals");
    expect(goals).toBeDefined();
    expect(goals!.withinTolerance).toBe(false);
    expect(report.converged).toBe(false);
  });

  it("formatCalibrationReport includes headers and check marks", () => {
    const report = buildCalibrationReport(perfectAverages, 20, 42);
    const text = formatCalibrationReport(report);

    expect(text).toContain("Calibration report");
    expect(text).toContain("Gols");
    expect(text).toContain("✓");
  });

  it("exposes Brasileirão target list", () => {
    expect(BRASILEIRAO_2025_TARGETS.length).toBeGreaterThanOrEqual(7);
    expect(BRASILEIRAO_2025_TARGETS.some((t) => t.key === "goals")).toBe(true);
  });

  it("suggestAdjustments returns actionable knobs", () => {
    const tips = suggestAdjustments("goals", 0.5, 2.5);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.join(" ")).toMatch(/shot|gk|Save|Utility/i);
  });
});
