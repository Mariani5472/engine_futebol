import {
  fundamentalReward,
  reconstructFundamentalReward,
  verifyFundamentalReward,
} from "../../../src/application/match/reward/FundamentalReward";

describe("FundamentalReward", () => {
  it("is bounded, causal and exactly reconstructible", () => {
    const reward = fundamentalReward("TARGET_REACHED", 10);
    expect(reward.components.map(component => component.id)).toEqual([
      "DECISION_COST", "DISTANCE_PROGRESS", "SEMANTIC_OUTCOME",
    ]);
    expect(reward.components[1].value).toBe(0.1);
    expect(reconstructFundamentalReward(reward.components)).toBe(reward.total);
    expect(verifyFundamentalReward(reward)).toBe(true);
    expect(Object.isFrozen(reward.components)).toBe(true);
  });

  it("penalizes timeout without xG or hidden-state inputs", () => {
    const reward = fundamentalReward("TIMEOUT");
    expect(reward.total).toBe(-0.51);
    expect(reward.components.every(component => component.source !== undefined)).toBe(true);
  });
});
