import { buildSimulationConfig } from "../../helpers/builders";
import { AttackerVsGoalkeeperEnvironment } from "../../../src/application/match/scenario/AttackerVsGoalkeeperEnvironment";
import {
  createDefaultBaselines,
  isCommandAllowed,
  randomValidBaseline,
} from "../../../src/application/match/evaluation/BaselinePolicies";
import {
  createEvaluationSeedSplit,
  validateEvaluationSeedSplit,
} from "../../../src/application/match/evaluation/SeedSplit";
import {
  meanConfidenceInterval,
  wilsonInterval,
} from "../../../src/application/match/evaluation/ConfidenceIntervals";
import { InternalBaselineEvaluator } from "../../../src/application/match/evaluation/InternalBaselineEvaluator";

function environment(seed: number): AttackerVsGoalkeeperEnvironment {
  return new AttackerVsGoalkeeperEnvironment({
    attackerId: "home-10",
    goalkeeperId: "away-1",
    initialSeed: seed,
    configFactory: value => ({ ...buildSimulationConfig(value), maxDurationSeconds: 60 }),
    maxDecisionSteps: 6,
    // Keep this unit evaluation before the deliberately short test match's
    // halftime; production scenarios use a normal match duration.
    maxEpisodePhysicalTicks: 80,
    maxPhysicalTicksPerStep: 500,
  });
}

describe("internal baseline evaluation", () => {
  it("creates deterministic, unique and disjoint seed partitions", () => {
    const left = createEvaluationSeedSplit(8128, 5, 7);
    const right = createEvaluationSeedSplit(8128, 5, 7);
    expect(right).toEqual(left);
    expect(new Set([...left.development, ...left.evaluation]).size).toBe(12);
    expect(() => validateEvaluationSeedSplit({ development: [1, 2], evaluation: [2, 3] }))
      .toThrow(/both development and evaluation/);
    expect(() => validateEvaluationSeedSplit({ development: [1, 1], evaluation: [] }))
      .toThrow(/duplicate/);
  });

  it("keeps every default baseline inside the public action mask", () => {
    const reset = environment(41).reset(41);
    for (const baseline of createDefaultBaselines()) {
      const command = baseline.create(99).select({
        observation: reset.observation,
        actionMask: reset.actionMask,
        decisionStep: 0,
      });
      expect(isCommandAllowed(command, reset.actionMask)).toBe(true);
    }
    expect(createDefaultBaselines().find(item => item.id === "IMMEDIATE_SHOT")!
      .create(1).select({ observation: reset.observation, actionMask: reset.actionMask, decisionStep: 0 }))
      .toMatchObject({ actionId: "SHOT" });
  });

  it("reproduces the random-valid baseline from its isolated policy seed", () => {
    const reset = environment(52).reset(52);
    const left = randomValidBaseline().create(12345);
    const right = randomValidBaseline().create(12345);
    const context = { observation: reset.observation, actionMask: reset.actionMask, decisionStep: 0 };
    const leftSequence = Array.from({ length: 12 }, () => left.select(context));
    const rightSequence = Array.from({ length: 12 }, () => right.select(context));
    expect(rightSequence).toEqual(leftSequence);
  });

  it("evaluates all baselines on the same held-out seeds and publishes bounded intervals", () => {
    const split = { development: [11], evaluation: [21, 22] } as const;
    const report = new InternalBaselineEvaluator({
      environmentFactory: environment,
      seedSplit: split,
    }).evaluate();

    expect(report.version).toBe(1);
    expect(report.baselineIds).toEqual([
      "RANDOM_VALID", "IMMEDIATE_SHOT", "APPROACH_AND_SHOOT", "OBSERVABLE_HEURISTIC",
    ]);
    expect(report.reports).toHaveLength(8);
    for (const baselineId of report.baselineIds) {
      const heldOut = report.reports.find(item => item.baselineId === baselineId && item.partition === "EVALUATION")!;
      expect(heldOut.records.map(item => item.scenarioSeed)).toEqual([21, 22]);
      expect(heldOut.records.every(item => item.baselineId === baselineId)).toBe(true);
      expect(heldOut.goalRate.lower).toBeGreaterThanOrEqual(0);
      expect(heldOut.goalRate.upper).toBeLessThanOrEqual(1);
      expect(heldOut.goalRate.estimate).toBeGreaterThanOrEqual(heldOut.goalRate.lower);
      expect(heldOut.goalRate.estimate).toBeLessThanOrEqual(heldOut.goalRate.upper);
      expect(Number.isFinite(heldOut.return.estimate)).toBe(true);
      expect(heldOut.return.estimate).toBeGreaterThanOrEqual(heldOut.return.lower);
      expect(heldOut.return.estimate).toBeLessThanOrEqual(heldOut.return.upper);
      expect(Object.values(heldOut.outcomeCounts).reduce((sum, value) => sum + value, 0)).toBe(2);
    }
  }, 120_000);

  it("computes Wilson rate and mean confidence intervals", () => {
    const zero = wilsonInterval(0, 10);
    const all = wilsonInterval(10, 10);
    expect(zero.estimate).toBe(0);
    expect(zero.upper).toBeGreaterThan(0);
    expect(all.estimate).toBe(1);
    expect(all.lower).toBeLessThan(1);
    expect(meanConfidenceInterval([2, 4, 6]).estimate).toBe(4);
    expect(meanConfidenceInterval([3])).toEqual({ estimate: 3, lower: 3, upper: 3, confidence: 0.95 });
  });
});
