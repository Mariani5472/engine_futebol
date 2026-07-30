import { calibrationDistribution, type MatchSample } from "../../../src/application/match/calibration";

describe("calibrationDistribution", () => {
  it("reports quantiles and zero-goal rate instead of hiding variance in the mean", () => {
    const samples = [0, 1, 3, 6, 10].map((goals, index) => ({
      seed: index + 1, goals, shots: 20 + index, shotsOnTarget: 5 + index,
      corners: 0, fouls: 0, yellowCards: 0, redCards: 0, xG: 0,
      averageShotDistance: 0, passes: 0, progressivePasses: 0,
      highPressRecoveries: 0, attacks: 0, possessionHome: 50,
      shotOutcomes: { blocked: 0, offTarget: 0, woodwork: 0, savedCaught: 0, savedParried: 0, goals, unresolved: 0 },
      unresolvedShotIds: [],
    })) satisfies MatchSample[];

    const distribution = calibrationDistribution(samples);
    expect(distribution.goalsMedian).toBe(3);
    expect(distribution.goalsP10).toBeCloseTo(.4);
    expect(distribution.goalsP90).toBeCloseTo(8.4);
    expect(distribution.zeroGoalMatchRate).toBe(.2);
    expect(distribution.shotsMedian).toBe(22);
  });
});
