import { OpponentPool } from "../../../src/application/match/curriculum/OpponentPool";
import type { CurriculumCheckpoint } from "../../../src/application/match/curriculum/CurriculumPlan";

const collective = (id: string): CurriculumCheckpoint => ({
  id,
  kind: "COLLECTIVE",
  stage: "COLLECTIVE_POLICY",
  policyVersion: 1,
  observationVersion: 1,
  actionSpaceVersion: 1,
  artifactPath: `/models/${id}.zip`,
  artifactHash: `sha256:${id}`,
  createdAt: "2026-07-30T00:00:00.000Z",
});

describe("OpponentPool", () => {
  it("samples deterministically without matching the learner against itself", () => {
    const pool = new OpponentPool();
    pool.add(collective("generation-0"), 0, 900);
    pool.add(collective("generation-1"), 1, 1_020);
    pool.add(collective("learner"), 2, 1_000);
    const first = pool.sample("learner", 1_000, 81);
    const second = pool.sample("learner", 1_000, 81);
    expect(first).toEqual(second);
    expect(first.opponent.checkpoint.id).not.toBe("learner");
  });

  it("keeps immutable checkpoints and records Elo-style outcomes", () => {
    const pool = new OpponentPool();
    pool.add(collective("old"), 0);
    const winner = pool.recordResult("old", 1, 1_000);
    expect(winner.rating).toBeGreaterThan(1_000);
    expect(winner.games).toBe(1);
    expect(() => pool.add(collective("old"), 1)).toThrow("already in the opponent pool");
    expect(() => pool.add({ ...collective("attacker"), kind: "ATTACKER" }, 1)).toThrow("COLLECTIVE");
  });
});
