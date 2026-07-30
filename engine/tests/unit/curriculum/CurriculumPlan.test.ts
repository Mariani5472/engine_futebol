import {
  buildCurriculumPlan,
  CURRICULUM_STAGE_ORDER,
  evaluateCurriculumGate,
  type CurriculumCheckpoint,
} from "../../../src/application/match/curriculum/CurriculumPlan";

const checkpoint = (kind: CurriculumCheckpoint["kind"], id = kind): CurriculumCheckpoint => ({
  id,
  kind,
  stage: kind === "GOALKEEPER" ? "LEARNED_GOALKEEPER" : kind === "COLLECTIVE" ? "COLLECTIVE_POLICY" : "PASS",
  policyVersion: 1,
  observationVersion: 1,
  actionSpaceVersion: 1,
  artifactPath: `/models/${id}.zip`,
  artifactHash: `sha256:${id}`,
  createdAt: "2026-07-30T00:00:00.000Z",
});

describe("CurriculumPlan", () => {
  it("defines every requested stage in stable order and expands controlled actors", () => {
    const plan = buildCurriculumPlan();
    expect(plan.map(stage => stage.id)).toEqual(CURRICULUM_STAGE_ORDER);
    expect(plan.find(stage => stage.id === "PASS")?.controlledPlayerIds).toEqual(["home-10"]);
    expect(plan.find(stage => stage.id === "TWO_V_ONE")?.controlledPlayerIds).toHaveLength(2);
    expect(plan.find(stage => stage.id === "THREE_V_TWO")?.controlledPlayerIds).toHaveLength(3);
    expect(plan.find(stage => stage.id === "FIVE_V_FIVE")?.controlledPlayerIds).toHaveLength(5);
    expect(plan.find(stage => stage.id === "ELEVEN_V_ELEVEN")?.controlledPlayerIds).toHaveLength(11);
    expect(plan.find(stage => stage.id === "SELF_PLAY")?.controlledPlayerIds).toHaveLength(22);
    expect(plan.find(stage => stage.id === "COLLECTIVE_POLICY")?.policyMode).toBe("SHARED_TEAM");
    expect(plan.find(stage => stage.id === "SELF_PLAY")?.policyMode).toBe("SELF_PLAY");
  });

  it("locks stages by predecessor and blocks learned components without checkpoints", () => {
    const plan = buildCurriculumPlan();
    const goalkeeper = plan.find(stage => stage.id === "LEARNED_GOALKEEPER")!;
    expect(evaluateCurriculumGate(goalkeeper, new Set(), [])).toMatchObject({ state: "LOCKED" });
    expect(evaluateCurriculumGate(goalkeeper, new Set(["FIVE_V_FIVE"]), [])).toMatchObject({
      state: "BLOCKED",
      reasons: ["missing ATTACKER checkpoint"],
    });
    expect(evaluateCurriculumGate(goalkeeper, new Set(["FIVE_V_FIVE"]), [checkpoint("ATTACKER")])).toMatchObject({ state: "READY" });
  });

  it("promotes only from held-out evidence whose confidence bounds pass", () => {
    const passing = buildCurriculumPlan()[0];
    const seeds = Array.from({ length: 50 }, (_, index) => 10_000 + index);
    const completed = evaluateCurriculumGate(passing, new Set(), [], {
      stage: "PASS",
      evaluationSeeds: seeds,
      successes: 50,
      returns: seeds.map(() => 1),
      trainingSuccessRate: 1,
    });
    expect(completed.state).toBe("COMPLETE");
    expect(completed.successRate!.lower).toBeGreaterThan(0.7);

    const insufficient = evaluateCurriculumGate(passing, new Set(), [], {
      stage: "PASS",
      evaluationSeeds: seeds.slice(0, 10),
      successes: 10,
      returns: seeds.slice(0, 10).map(() => 1),
    });
    expect(insufficient.state).toBe("READY");
    expect(insufficient.reasons[0]).toContain("at least 50");
  });
});
