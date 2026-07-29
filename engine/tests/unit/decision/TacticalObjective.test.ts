import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { TacticalObjective } from "../../../src/application/match/decision/TacticalObjective";

describe("TacticalObjective", () => {
  it("makes every decision explain its tactical purpose", () => {
    expect(new Decision(DecisionType.SHOT, 100).objective).toBe(TacticalObjective.SCORE_GOAL);
    expect(new Decision(DecisionType.PASS, 60).objective).toBe(TacticalObjective.PROGRESS_BALL);
    expect(new Decision(DecisionType.CLEAR, 70).objective).toBe(TacticalObjective.PROTECT_GOAL);
  });
});
