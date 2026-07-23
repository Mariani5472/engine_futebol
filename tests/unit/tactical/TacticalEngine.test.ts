import { TacticalEngine } from "../../../src/application/match/tactical/TacticalEngine";
import { buildMinimalMatchState, buildPlayerMatchState } from "../../helpers/builders";
import { Vector2 } from "../../../src/core/geometry/Vector2";

describe("TacticalEngine", () => {
  const engine = new TacticalEngine();

  it("does not crash on update", () => {
    const state = buildMinimalMatchState();
    expect(() => engine.update(state)).not.toThrow();
  });

  it("does not change target for the ball carrier", () => {
    const state = buildMinimalMatchState();
    const carrier = state.home.players[0];
    carrier.hasBall = true;
    (state.ball as any).owner = carrier;

    const originalTarget = carrier.targetPosition;
    engine.update(state);

    // Target should be unchanged for ball carrier.
    expect(carrier.targetPosition).toBe(originalTarget);
  });

  it("sets a target for non-ball-carriers", () => {
    const state = buildMinimalMatchState();

    // Add a second home player not in possession.
    const nonCarrier = buildPlayerMatchState({
      position: new Vector2(40, 34),
      hasBall: false
    });
    state.home.players.push(nonCarrier);

    engine.update(state);

    // The non-carrier should have a target set.
    expect(nonCarrier.targetPosition).toBeDefined();
  });

  it("correctly identifies ball in attacking half", () => {
    const state = buildMinimalMatchState();
    (state.ball as any).position = new Vector2(80, 34); // attacking half for home (attackingDir = 1)
    expect(engine.isBallInAttackingHalf(state, state.home)).toBe(true);
  });

  it("correctly identifies ball in defensive half", () => {
    const state = buildMinimalMatchState();
    (state.ball as any).position = new Vector2(20, 34); // defensive half for home
    expect(engine.isBallInAttackingHalf(state, state.home)).toBe(false);
  });
});
