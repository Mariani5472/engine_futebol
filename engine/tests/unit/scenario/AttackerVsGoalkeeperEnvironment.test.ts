import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { MovementSystem } from "../../../src/core/movement/MovementSystem";
import { AttackerVsGoalkeeperEnvironment } from "../../../src/application/match/scenario/AttackerVsGoalkeeperEnvironment";
import { ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION } from "../../../src/application/match/scenario/MatchScenario";
import type { AttackerVsGoalkeeperStepResult } from "../../../src/application/match/scenario/AttackerVsGoalkeeperEnvironment";
import { reconstructReward, verifyRewardBreakdown } from "../../../src/application/match/reward/RewardV1";
import { buildSimulationConfig } from "../../helpers/builders";

const outcomes = [
  "GOAL", "SAVED_CAUGHT", "SAVED_PARRIED", "BLOCKED", "OFF_TARGET", "POST", "CROSSBAR",
];

function create(seed = 41, scenario = {}) {
  return new AttackerVsGoalkeeperEnvironment({
    attackerId: "home-10",
    goalkeeperId: "away-1",
    initialSeed: seed,
    configFactory: value => ({ ...buildSimulationConfig(value), maxDurationSeconds: 12 }),
    scenario,
    maxDecisionSteps: 5,
    maxPhysicalTicksPerStep: 500,
  });
}

function shoot(environment: AttackerVsGoalkeeperEnvironment): AttackerVsGoalkeeperStepResult {
  const reset = environment.reset();
  const shot = reset.actionMask.entries.find(entry => entry.id === "SHOT");
  expect(shot?.enabled).toBe(true);
  return environment.step({ actionId: "SHOT" });
}

describe("AttackerVsGoalkeeperEnvironment", () => {
  it("applies configurable positions and freezes the goalkeeper physically", () => {
    const config = {
      ...buildSimulationConfig(17),
      scenario: {
        kind: "ATTACKER_VS_GOALKEEPER" as const,
        version: ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION,
        attackerId: "home-10",
        goalkeeperId: "away-1",
        attackerDistanceFromGoal: 14,
        attackerLateralOffset: 4,
        goalkeeperDepthFromGoalLine: 1.5,
        goalkeeperLateralOffset: -1,
      },
    };
    const state = new MatchInitializer().initialize(config).state;
    const attacker = state.home.players.find(player => player.player.id === "home-10")!;
    const goalkeeper = state.away.players.find(player => player.player.id === "away-1")!;
    const origin = goalkeeper.position;

    expect(attacker.position).toMatchObject({ x: 91, y: 38 });
    expect(goalkeeper.position).toMatchObject({ x: 103.5, y: 33 });
    expect(goalkeeper.scenarioMovementFrozen).toBe(true);
    expect(goalkeeper.scenarioDecisionDisabled).toBe(true);
    goalkeeper.targetPosition = attacker.position;
    for (let index = 0; index < 100; index++) new MovementSystem().update(state, 0.05);
    expect(goalkeeper.position).toEqual(origin);
  });

  it("returns one semantic physical shot outcome and terminates the scenario", () => {
    const transition = shoot(create(41));

    expect(outcomes).toContain(transition.outcome);
    expect(transition.terminated).toBe(true);
    expect(transition.truncated).toBe(false);
    expect(transition.info.events.some(event => event.type === "SHOT_RESOLVED" || event.type === "GOAL")).toBe(true);
    expect(transition.reward).toBe(reconstructReward(transition.rewardBreakdown.components));
    expect(verifyRewardBreakdown(transition.rewardBreakdown)).toBe(true);
  });

  it("keeps the goalkeeper at the exact reset coordinate throughout the episode", () => {
    const environment = create(82, { goalkeeperPosition: { x: 103.75, y: 35.25 } });
    const reset = environment.reset();
    const hold = reset.actionMask.entries.find(entry => entry.id === "HOLD_BALL");
    expect(hold?.enabled).toBe(true);
    const transition = environment.step({ actionId: "HOLD_BALL" });

    expect(transition.goalkeeperPosition).toEqual(reset.goalkeeperPosition);
  });

  it("reproduces observations, events and outcome for the same seed", () => {
    const left = create(133);
    const right = create(133);
    const leftReset = left.reset();
    const rightReset = right.reset();
    expect(rightReset).toEqual(leftReset);

    const leftResult = left.step({ actionId: "SHOT" });
    const rightResult = right.step({ actionId: "SHOT" });
    expect(rightResult).toEqual(leftResult);
  });

  it("uses TIMEOUT as a truncation when no sporting outcome happens", () => {
    const environment = create(19);
    let boundary = environment.reset();
    let transition = environment.step({ actionId: "HOLD_BALL" });
    while (!transition.terminated && !transition.truncated) {
      boundary = transition;
      expect(boundary.actionMask.entries.find(entry => entry.id === "HOLD_BALL")?.enabled).toBe(true);
      transition = environment.step({ actionId: "HOLD_BALL" });
    }
    expect(transition.outcome).toBe("TIMEOUT");
    expect(transition.terminated).toBe(false);
    expect(transition.truncated).toBe(true);
    expect(transition.rewardBreakdown.outcome).toBe("TIMEOUT");
  });

  it("validates player roles and scenario geometry during reset", () => {
    expect(() => new AttackerVsGoalkeeperEnvironment({
      attackerId: "home-10",
      goalkeeperId: "away-2",
      configFactory: buildSimulationConfig,
    }).reset()).toThrow(/is not a goalkeeper/);

    expect(() => create(1, { attackerDistanceFromGoal: 500 }).reset()).toThrow(/attackerDistanceFromGoal/);
  });
});
