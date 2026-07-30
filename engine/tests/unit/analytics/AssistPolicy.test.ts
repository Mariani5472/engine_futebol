import { AssistPolicy } from "../../../src/application/match/analytics/AssistPolicy";

describe("AssistPolicy", () => {
  const policy = new AssistPolicy({
    maxPassAgeSeconds: 8,
    allowDefenderDeflection: true,
    allowGoalkeeperParry: true,
    allowWoodworkRebound: true,
  });

  it("keeps a causal assist through configured deflections and rebounds", () => {
    expect(policy.resolve({
      passerId: "p1", receiverId: "p2", completedAtSecond: 10,
      interventions: ["DEFENDER_DEFLECTION", "GOALKEEPER_PARRY"],
    }, "p2", 16)).toBe("p1");
  });

  it("rejects stale passes and intervening control changes", () => {
    expect(policy.resolve({
      passerId: "p1", receiverId: "p2", completedAtSecond: 1, interventions: [],
    }, "p2", 10)).toBeNull();
    expect(policy.resolve({
      passerId: "p1", receiverId: "p2", completedAtSecond: 10,
      interventions: ["CONTROL_CHANGE"],
    }, "p2", 11)).toBeNull();
  });
});
