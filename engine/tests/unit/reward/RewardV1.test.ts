import {
  REWARD_V1_PARAMETERS,
  attackerVsGoalkeeperRewardV1,
  reconstructReward,
  verifyRewardBreakdown,
} from "../../../src/application/match/reward/RewardV1";
import type { AttackerVsGoalkeeperOutcome } from "../../../src/application/match/scenario/contracts/AttackerVsGoalkeeperOutcome";

const outcomes: readonly AttackerVsGoalkeeperOutcome[] = [
  "GOAL", "SAVED_CAUGHT", "SAVED_PARRIED", "BLOCKED", "OFF_TARGET", "POST", "CROSSBAR",
  "POSSESSION_LOST", "TIMEOUT",
];

describe("Reward v1", () => {
  it("is a pure, finite and reconstructible sum for every semantic outcome", () => {
    for (const outcome of outcomes) {
      const left = attackerVsGoalkeeperRewardV1(outcome);
      const right = attackerVsGoalkeeperRewardV1(outcome);
      expect(right).toEqual(left);
      expect(Number.isFinite(left.total)).toBe(true);
      expect(left.total).toBe(reconstructReward(left.components));
      expect(verifyRewardBreakdown(left)).toBe(true);
      expect(left.components).toHaveLength(2);
      expect(left.components[1]).toMatchObject({ id: "SEMANTIC_OUTCOME", source: "AUTHORITATIVE_OUTCOME" });
    }
  });

  it("charges only the decision cost while the episode is running", () => {
    const reward = attackerVsGoalkeeperRewardV1(null);
    expect(reward.outcome).toBeNull();
    expect(reward.total).toBe(REWARD_V1_PARAMETERS.decisionCost);
    expect(reward.components).toEqual([expect.objectContaining({ id: "DECISION_COST" })]);
  });

  it("keeps the ordering simple and independent from xG", () => {
    expect(REWARD_V1_PARAMETERS.outcomes.GOAL).toBeGreaterThan(REWARD_V1_PARAMETERS.outcomes.SAVED_PARRIED);
    expect(REWARD_V1_PARAMETERS.outcomes.SAVED_PARRIED).toBeGreaterThan(REWARD_V1_PARAMETERS.outcomes.OFF_TARGET);
    expect(REWARD_V1_PARAMETERS.outcomes.OFF_TARGET).toBeGreaterThan(REWARD_V1_PARAMETERS.outcomes.POSSESSION_LOST);
    expect(JSON.stringify(REWARD_V1_PARAMETERS).toLowerCase()).not.toContain("xg");
  });

  it("rejects invalid custom decision costs", () => {
    expect(() => attackerVsGoalkeeperRewardV1("GOAL", {
      ...REWARD_V1_PARAMETERS,
      decisionCost: 0.1,
    })).toThrow(/decisionCost/);
  });
});
