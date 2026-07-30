import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import {
  PLAYER_ACTION_IDS,
  PLAYER_ACTION_SPACE,
  PLAYER_ACTION_SPACE_VERSION,
} from "../../../src/application/match/policy/PlayerActionSpace";

describe("PlayerActionSpace", () => {
  it("keeps the versioned discrete IDs and indices stable", () => {
    expect(PLAYER_ACTION_SPACE_VERSION).toBe(1);
    expect(PLAYER_ACTION_IDS).toEqual([
      "NONE", "PASS", "CROSS", "SHOT", "DRIBBLE", "HOLD_BALL", "CLEAR",
      "RECEIVE", "HEADER", "CONTROL", "SKILL_MOVE", "MOVE", "MARK", "COVER",
      "PRESS", "INTERCEPT", "TACKLE", "BLOCK", "POSITION", "SET_PIECE",
      "GK_CLAIM", "GK_DISTRIBUTE", "FAKE", "TACTICAL_FOUL",
    ]);
    expect(PLAYER_ACTION_SPACE.actions.map(action => action.index)).toEqual(
      Array.from({ length: 24 }, (_, index) => index),
    );
    expect(PLAYER_ACTION_SPACE.actions.map(action => action.decisionType)).toEqual(
      Array.from({ length: 24 }, (_, index) => index),
    );
  });

  it("publishes one mask bit per stable action and the exact valid targets", () => {
    const valid = [
      new Decision(DecisionType.PASS, 40, "home-7"),
      new Decision(DecisionType.PASS, 35, "home-8"),
      new Decision(DecisionType.HOLD_BALL, 10),
    ];
    const mask = PLAYER_ACTION_SPACE.mask("home-10", 18.4, valid);

    expect(mask.bits).toHaveLength(24);
    expect(mask.bits[DecisionType.NONE]).toBe(0);
    expect(mask.bits[DecisionType.PASS]).toBe(1);
    expect(mask.bits[DecisionType.HOLD_BALL]).toBe(1);
    expect(mask.bits[DecisionType.SHOT]).toBe(0);
    expect(mask.entries[DecisionType.PASS].validTargetIds).toEqual(["home-7", "home-8"]);
    expect(mask.entries[DecisionType.HOLD_BALL].validTargetIds).toEqual([null]);
  });

  it("uses the same exact type-target rule for mask and resolution", () => {
    const pass = new Decision(DecisionType.PASS, 40, "home-7");
    const hold = new Decision(DecisionType.HOLD_BALL, 10);
    const valid = [pass, hold];
    const mask = PLAYER_ACTION_SPACE.mask("home-10", 20, valid);

    for (const entry of mask.entries.filter(item => item.enabled)) {
      for (const targetId of entry.validTargetIds) {
        const requested = new Decision(entry.decisionType, 1, targetId ?? undefined);
        expect(PLAYER_ACTION_SPACE.resolve(requested, valid)).toBeDefined();
      }
    }
    expect(PLAYER_ACTION_SPACE.resolve(new Decision(DecisionType.PASS, 1, "home-8"), valid)).toBeUndefined();
    expect(PLAYER_ACTION_SPACE.resolve(new Decision(DecisionType.SHOT, 1), valid)).toBeUndefined();
  });
});
