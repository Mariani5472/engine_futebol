import {
  BallControlScenarioEnvironment,
  MovementScenarioEnvironment,
  PassingScenarioEnvironment,
  ShootingScenarioEnvironment,
  type FundamentalScenarioEnvironmentOptions,
} from "../../../src/application/match/scenario/FundamentalScenarioEnvironment";
import {
  FundamentalTrainingEvaluator,
  createFundamentalBaselines,
  createFundamentalSeedPartitions,
  evaluateFundamentalPromotionGate,
  fundamentalPromotionCriteria,
  sampleFundamentalDifficulty,
  selectFundamentalCurriculumLevel,
  scriptedFundamentalBaseline,
  type FundamentalDifficultySample,
} from "../../../src/application/match/curriculum/FundamentalTraining";
import type { FundamentalScenarioSkill } from "../../../src/application/match/scenario/MatchScenario";
import { isCommandAllowed } from "../../../src/application/match/evaluation/BaselinePolicies";
import { buildSimulationConfig } from "../../helpers/builders";

const counts = { training: 1, selection: 1, evaluation: 2, generalization: 1, regression: 1 } as const;

describe("FundamentalTraining", () => {
  it("selects deterministic rehearsal at the configured rate", () => {
    expect(selectFundamentalCurriculumLevel(.8, [.1, .3], 0, 10)).toBe(.8);
    const rehearsal = selectFundamentalCurriculumLevel(.8, [.1, .3], 1, 10);
    expect([.1, .3]).toContain(rehearsal);
    expect(selectFundamentalCurriculumLevel(.8, [.1, .3], 1, 10)).toBe(rehearsal);
  });

  it("uses skill-specific causal gates without weakening movement or passing", () => {
    expect(fundamentalPromotionCriteria("MOVEMENT")).toBe(fundamentalPromotionCriteria("PASSING"));
    expect(fundamentalPromotionCriteria("BALL_CONTROL").minimumEvaluationSuccessLowerBound).toBe(.55);
    expect(fundamentalPromotionCriteria("SHOOTING_EMPTY_GOAL").minimumGeneralizationSuccessLowerBound).toBe(.2);
  });
  it("creates deterministic partitions with no seed leakage", () => {
    const first = createFundamentalSeedPartitions(4_242, counts);
    const second = createFundamentalSeedPartitions(4_242, counts);
    expect(second).toEqual(first);
    const all = Object.values(first).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(["MOVEMENT", "BALL_CONTROL", "PASSING", "SHOOTING_EMPTY_GOAL"] as const)(
    "samples reproducible and progressively harder %s configurations",
    skill => {
      const easy = sampleFundamentalDifficulty(skill, 0, 91);
      const hard = sampleFundamentalDifficulty(skill, 1, 91);
      expect(sampleFundamentalDifficulty(skill, 1, 91)).toEqual(hard);
      expect(easy.skill).toBe(skill);
      if (skill === "MOVEMENT") {
        expect(hard.parameters.distanceMeters).toBeGreaterThan(easy.parameters.distanceMeters);
        expect(hard.parameters.targetRadiusMeters).toBeLessThan(easy.parameters.targetRadiusMeters);
      } else if (skill === "BALL_CONTROL") {
        expect(hard.parameters.ballDistanceMeters).toBeGreaterThan(easy.parameters.ballDistanceMeters);
      } else if (skill === "PASSING") {
        expect(hard.parameters.passDistanceMeters).toBeGreaterThan(easy.parameters.passDistanceMeters);
      } else {
        expect(hard.parameters.distanceFromGoalMeters).toBeGreaterThan(easy.parameters.distanceFromGoalMeters);
      }
    },
  );

  it.each([
    ["MOVEMENT", "MOVE"],
    ["BALL_CONTROL", "CONTROL"],
    ["PASSING", "PASS"],
    ["SHOOTING_EMPTY_GOAL", "SHOT"],
  ] as const)("scripted %s baseline selects its intended legal action", (skill, expectedAction) => {
    const environment = environmentFor(skill, 31, sampleFundamentalDifficulty(skill, 0.2, 31));
    const reset = environment.reset(31);
    const command = scriptedFundamentalBaseline(skill).create(10).select({
      observation: reset.observation, actionMask: reset.actionMask, decisionStep: 0,
    });
    expect(command.actionId).toBe(expectedAction);
    expect(isCommandAllowed(command, reset.actionMask)).toBe(true);
    expect(createFundamentalBaselines(skill).map(item => item.id)).toEqual(["RANDOM_VALID", "SCRIPTED_SKILL"]);
  });

  it("evaluates held-out partitions and applies confidence-based promotion gates", () => {
    const seedPartitions = createFundamentalSeedPartitions(808, counts);
    const report = new FundamentalTrainingEvaluator({
      skill: "MOVEMENT",
      baseline: scriptedFundamentalBaseline("MOVEMENT"),
      seedPartitions,
      environmentFactory: (seed, difficulty) => environmentFor("MOVEMENT", seed, difficulty),
    }).evaluate();
    expect(report.partitions.map(item => item.partition)).toEqual([
      "TRAINING", "SELECTION", "EVALUATION", "GENERALIZATION", "REGRESSION",
    ]);
    expect(report.partitions.flatMap(item => item.records.map(record => record.scenarioSeed)).sort())
      .toEqual(Object.values(seedPartitions).flat().sort());
    expect(evaluateFundamentalPromotionGate(report, {
      minimumEvaluationEpisodes: 2,
      minimumEvaluationSuccessLowerBound: 0,
      minimumGeneralizationSuccessLowerBound: 0,
      minimumRegressionSuccessLowerBound: 0,
      minimumEvaluationReturnLowerBound: -10,
      maximumSelectionEvaluationGap: 1,
    }).state).toBe("COMPLETE");
    expect(evaluateFundamentalPromotionGate(report, {
      minimumEvaluationEpisodes: 100,
      minimumEvaluationSuccessLowerBound: 0.99,
      minimumGeneralizationSuccessLowerBound: 0.99,
      minimumRegressionSuccessLowerBound: 0.99,
      minimumEvaluationReturnLowerBound: 10,
      maximumSelectionEvaluationGap: 0,
    })).toMatchObject({ state: "READY", reasons: expect.arrayContaining(["insufficient evaluation episodes"]) });
  }, 60_000);
});

function environmentFor(skill: FundamentalScenarioSkill, seed: number, difficulty: FundamentalDifficultySample) {
  const options: FundamentalScenarioEnvironmentOptions = {
    playerId: "home-10",
    ...difficulty.scenario,
    initialSeed: seed,
    configFactory: value => ({ ...buildSimulationConfig(value), maxDurationSeconds: 30 }),
    maxDecisionSteps: 20,
    maxEpisodePhysicalTicks: 600,
    maxPhysicalTicksPerStep: 200,
  };
  switch (skill) {
    case "MOVEMENT": return new MovementScenarioEnvironment(options);
    case "BALL_CONTROL": return new BallControlScenarioEnvironment(options);
    case "PASSING": return new PassingScenarioEnvironment(options);
    case "SHOOTING_EMPTY_GOAL": return new ShootingScenarioEnvironment(options);
  }
}
