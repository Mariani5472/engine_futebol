import { SmallSidedCheckpointLeague } from "../../../src/application/match/curriculum/SmallSidedCheckpointLeague";
import type { CurriculumCheckpoint } from "../../../src/application/match/curriculum/CurriculumPlan";

const checkpoint = (id: string, stage: "FIVE_V_FIVE" | "SEVEN_V_SEVEN"): CurriculumCheckpoint => ({
  id, kind: "COLLECTIVE", stage, policyVersion: 1, observationVersion: 1,
  actionSpaceVersion: 1, artifactPath: `${id}.zip`, artifactHash: `${id}-hash`, createdAt: "2026-01-01T00:00:00Z",
});

describe("SmallSidedCheckpointLeague", () => {
  it("creates deterministic double round-robin fixtures and Elo standings", () => {
    const league = new SmallSidedCheckpointLeague();
    league.register(checkpoint("five-a", "FIVE_V_FIVE"), "FIVE_V_FIVE");
    league.register(checkpoint("five-b", "FIVE_V_FIVE"), "FIVE_V_FIVE");
    const fixtures = league.fixtures("FIVE_V_FIVE", 500);
    expect(fixtures).toEqual([
      { division: "FIVE_V_FIVE", homeCheckpointId: "five-a", awayCheckpointId: "five-b", seed: 500 },
      { division: "FIVE_V_FIVE", homeCheckpointId: "five-b", awayCheckpointId: "five-a", seed: 501 },
    ]);
    league.record(fixtures[0], 2, 0);
    expect(league.standings("FIVE_V_FIVE")[0]).toMatchObject({ checkpoint: { id: "five-a" }, games: 1, wins: 1, goalsFor: 2 });
    expect(league.standings("FIVE_V_FIVE")[1]).toMatchObject({ checkpoint: { id: "five-b" }, games: 1, losses: 1, goalsAgainst: 2 });
  });

  it("keeps divisions and checkpoint stages compatible", () => {
    const league = new SmallSidedCheckpointLeague();
    expect(() => league.register(checkpoint("seven", "SEVEN_V_SEVEN"), "FIVE_V_FIVE")).toThrow("does not match");
  });
});
